import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { expectToast, readEnvFileValue } from "./helpers";

// The OAuth 2.1 flow an MCP client (Claude Code, claude.ai, ...) runs against
// Supabase Auth to reach nomcp, with member-manager's consent page in the
// middle, and what the resulting token can and can't do afterwards.

const SUPABASE_URL = readEnvFileValue("client/.env.local", "VITE_SUPABASE_URL");
const ANON_KEY = readEnvFileValue(
	"client/.env.local",
	"VITE_SUPABASE_ANON_KEY",
);
const SERVER_URL = process.env.E2E_SERVER_URL ?? "http://127.0.0.1:8787";
const SEED_ADMIN_ID = "00000000-0000-0000-0000-000000000001";
// Nothing listens here; the test answers the callback itself.
const REDIRECT_URI = "http://localhost:9999/callback";

test("a member connects an app through the consent page and disconnects it", async ({
	page,
	request,
}) => {
	test.skip(
		!SUPABASE_URL || !ANON_KEY,
		"client/.env.local is missing; run pnpm setup:local",
	);
	const apikey = { apikey: ANON_KEY ?? "" };
	const clientName = `E2E agent ${randomBytes(3).toString("hex")}`;

	// The app registers itself (dynamic client registration).
	const registration = await request.post(
		`${SUPABASE_URL}/auth/v1/oauth/clients/register`,
		{
			headers: apikey,
			data: {
				client_name: clientName,
				redirect_uris: [REDIRECT_URI],
				token_endpoint_auth_method: "none",
				grant_types: ["authorization_code", "refresh_token"],
				response_types: ["code"],
			},
		},
	);
	expect(registration.status()).toBe(201);
	const { client_id: clientId } = (await registration.json()) as {
		client_id: string;
	};

	// It sends the member to /authorize, which redirects to the consent page
	// on the Site URL. Open that path on the origin the suite runs on.
	const verifier = randomBytes(32).toString("base64url");
	const authorize = await request.get(
		`${SUPABASE_URL}/auth/v1/oauth/authorize?${new URLSearchParams({
			response_type: "code",
			client_id: clientId,
			redirect_uri: REDIRECT_URI,
			code_challenge: createHash("sha256").update(verifier).digest("base64url"),
			code_challenge_method: "S256",
			state: "e2e-state",
		})}`,
		{ headers: apikey, maxRedirects: 0 },
	);
	expect(authorize.status()).toBe(302);
	const consentUrl = new URL(authorize.headers().location ?? "");
	expect(consentUrl.pathname).toBe("/oauth/consent");

	await page.route(/^http:\/\/localhost:9999\/callback/, (route) =>
		route.fulfill({ status: 200, body: "callback" }),
	);
	await page.goto(`${consentUrl.pathname}${consentUrl.search}`);

	// Logged out: sign in first, then the consent page comes back.
	await page.getByRole("button", { name: /continue as local admin/i }).click();
	// A loopback redirect (like Claude Code's) is an approved MCP client.
	await expect(
		page.getByRole("heading", {
			name: "Allow this app to act as you on a TUM.ai MCP server?",
		}),
	).toBeVisible();
	await expect(page.getByTestId("oauth-redirect-target")).toHaveText(
		"localhost:9999",
	);
	await expect(page.getByText(`calls itself “${clientName}”`)).toBeVisible();
	await expect(page.getByText(/Notion MCP \(nomcp\).*Dev MCP/)).toBeVisible();

	await page.getByRole("button", { name: "Approve", exact: true }).click();
	await page.waitForURL(/localhost:9999\/callback\?/);
	const callback = new URL(page.url());
	expect(callback.searchParams.get("state")).toBe("e2e-state");

	// The app exchanges the code for a token.
	const tokenResponse = await request.post(
		`${SUPABASE_URL}/auth/v1/oauth/token`,
		{
			headers: apikey,
			form: {
				grant_type: "authorization_code",
				code: callback.searchParams.get("code") ?? "",
				redirect_uri: REDIRECT_URI,
				client_id: clientId,
				code_verifier: verifier,
			},
		},
	);
	expect(tokenResponse.ok()).toBe(true);
	const { access_token: appToken } = (await tokenResponse.json()) as {
		access_token: string;
	};
	const asApp = { ...apikey, authorization: `Bearer ${appToken}` };

	// nomcp's identity lookup works; member data and the API stay closed.
	const principal = await request.post(
		`${SUPABASE_URL}/rest/v1/rpc/mcp_principal`,
		{ headers: asApp, data: {} },
	);
	expect(await principal.json()).toMatchObject({
		user_id: SEED_ADMIN_ID,
		email: "admin@example.com",
		member_status: "active",
		slack_team_ok: false,
	});
	const members = await request.get(
		`${SUPABASE_URL}/rest/v1/members?select=user_id`,
		{ headers: asApp },
	);
	expect(await members.json()).toEqual([]);
	const api = await request.get(`${SERVER_URL}/api/members/${SEED_ADMIN_ID}`, {
		headers: { authorization: `Bearer ${appToken}` },
	});
	expect(api.status()).toBe(401);

	// The member disconnects the app; its token stops identifying them.
	await page.goto("/connected-apps");
	await page
		.getByRole("button", { name: `Disconnect ${clientName}`, exact: true })
		.click();
	await page
		.getByRole("dialog")
		.getByRole("button", { name: "Disconnect", exact: true })
		.click();
	await expectToast(page, `${clientName} was disconnected.`);
	await expect(
		page.getByRole("button", { name: `Disconnect ${clientName}`, exact: true }),
	).toHaveCount(0);

	const afterRevoke = await request.post(
		`${SUPABASE_URL}/rest/v1/rpc/mcp_principal`,
		{ headers: asApp, data: {} },
	);
	expect(await afterRevoke.json()).toBeNull();
});
