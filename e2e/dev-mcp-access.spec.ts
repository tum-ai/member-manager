import { type APIRequestContext, expect, test } from "@playwright/test";
import {
	expectToast,
	loginAsLocalAdmin,
	loginWithSeedEmail,
	readEnvFileValue,
	SEED_DEV_MCP_MEMBER_EMAIL,
	SEED_DEV_MCP_SLACK_USER_ID,
} from "./helpers";

// dev-mcp (Dev Claude's MCP server) asks member-manager who may use it. Here
// dev-mcp's side is played by the spec: it files Sofia's access request
// through the service API, as Dev Claude's "request access" does, an admin
// decides it on the Dev tab of /admin/mcp-access (the tool catalog comes from
// e2e/dev-mcp-stub.mjs), and the service API and /connected-apps show the
// outcome.

const SUPABASE_URL = readEnvFileValue("server/.env.local", "SUPABASE_URL");
const SERVICE_ROLE_KEY = readEnvFileValue(
	"server/.env.local",
	"SUPABASE_SERVICE_ROLE_KEY",
);
const SERVER_URL = process.env.E2E_SERVER_URL ?? "http://127.0.0.1:8787";
// playwright.config.ts gives the API server the same token.
const SERVICE_TOKEN = "e2e-dev-mcp-service-token";
// software-development-lead@example.com (supabase/seed.sql).
const MEMBER_ID = "00000000-0000-0000-0000-000000000019";
const MEMBER_NAME = "Sofia Software";
const ACCESS_URL = `${SERVER_URL}/api/internal/dev-mcp/access/${SEED_DEV_MCP_SLACK_USER_ID}`;
const service = { authorization: `Bearer ${SERVICE_TOKEN}` };

/** Removes Sofia's row (and grants); events stay, they're append-only. */
async function clearAccess(request: APIRequestContext): Promise<void> {
	const deleted = await request.delete(
		`${SUPABASE_URL}/rest/v1/dev_mcp_access?user_id=eq.${MEMBER_ID}`,
		{
			headers: {
				apikey: SERVICE_ROLE_KEY ?? "",
				authorization: `Bearer ${SERVICE_ROLE_KEY ?? ""}`,
			},
		},
	);
	expect(deleted.ok()).toBe(true);
}

async function readAccess(request: APIRequestContext) {
	const response = await request.get(ACCESS_URL, { headers: service });
	expect(response.status()).toBe(200);
	return (await response.json()).access;
}

test.describe("dev-mcp access", () => {
	test.skip(
		!SUPABASE_URL || !SERVICE_ROLE_KEY,
		"server/.env.local is missing; run pnpm setup:local",
	);

	test.beforeEach(async ({ request }) => {
		await clearAccess(request);
	});

	// Back to the seeded state: a waiting request.
	test.afterEach(async ({ request }) => {
		await clearAccess(request);
		await request.post(`${ACCESS_URL}/request`, { headers: service });
	});

	test("the service API needs dev-mcp's token and finds members by Slack ID", async ({
		request,
	}) => {
		expect((await request.get(ACCESS_URL)).status()).toBe(401);
		expect(
			(
				await request.get(ACCESS_URL, {
					headers: { authorization: "Bearer wrong" },
				})
			).status(),
		).toBe(401);

		const unknown = await request.get(
			`${SERVER_URL}/api/internal/dev-mcp/access/U0NOBODY1`,
			{ headers: service },
		);
		expect(unknown.status()).toBe(404);
		expect(await unknown.json()).toEqual({ error: "not_found" });

		expect(await readAccess(request)).toMatchObject({
			user_id: MEMBER_ID,
			slack_user_id: SEED_DEV_MCP_SLACK_USER_ID,
			display_name: MEMBER_NAME,
			slack_team_ok: true,
			status: "none",
			role: null,
			tools: [],
		});
	});

	test("a request is approved, edited and suspended by an admin", async ({
		page,
		request,
	}) => {
		const filed = await request.post(`${ACCESS_URL}/request`, {
			headers: service,
			data: { display_name: "Sofia" },
		});
		expect(filed.status()).toBe(201);
		expect((await filed.json()).created).toBe(true);
		const again = await request.post(`${ACCESS_URL}/request`, {
			headers: service,
		});
		expect(again.status()).toBe(200);

		await loginAsLocalAdmin(page);
		await page.goto("/admin/mcp-access?tab=dev");

		const waiting = page.getByRole("region", { name: "Waiting for approval" });
		await expect(waiting.getByText(MEMBER_NAME, { exact: true })).toBeVisible();
		await waiting
			.getByRole("group", { name: `Dev MCP role for ${MEMBER_NAME}` })
			.getByRole("radio", { name: "Lead" })
			.click();
		await waiting
			.getByRole("button", {
				name: `Approve ${MEMBER_NAME} for Dev MCP as lead`,
			})
			.click();
		await expectToast(page, `${MEMBER_NAME} can now use Dev MCP as a lead.`);

		// The lead preset: everything a lead may run except destructive tools.
		expect(await readAccess(request)).toMatchObject({
			status: "active",
			role: "lead",
			tools: [
				"add_to_github_org",
				"create_mailbox",
				"create_notion_page",
				"whoami",
			],
		});

		const active = page.getByRole("region", { name: "Active" });
		await expect(active.getByText(MEMBER_NAME, { exact: true })).toBeVisible();
		await active
			.getByRole("button", { name: `Edit Dev MCP tools for ${MEMBER_NAME}` })
			.click();
		const tools = page.getByRole("dialog", {
			name: `Dev MCP tools for ${MEMBER_NAME}`,
		});
		await tools.getByLabel("Create a mailbox").click();
		await tools.getByRole("button", { name: "Save tools" }).click();
		await expectToast(page, `${MEMBER_NAME}'s Dev MCP tools were saved.`);
		expect((await readAccess(request)).tools).toEqual([
			"add_to_github_org",
			"create_notion_page",
			"whoami",
		]);

		// A demotion drops the grants a member may not have.
		// Seeded admins are active too, so pick Sofia's own role picker.
		await active
			.getByRole("group", { name: `Dev MCP role for ${MEMBER_NAME}` })
			.getByRole("radio", { name: "Member" })
			.click();
		await expectToast(page, `${MEMBER_NAME} is now a member in Dev MCP.`);
		expect(await readAccess(request)).toMatchObject({
			role: "member",
			tools: ["create_notion_page", "whoami"],
		});

		await active
			.getByRole("button", {
				name: `Suspend Dev MCP access for ${MEMBER_NAME}`,
			})
			.click();
		const confirm = page.getByRole("dialog");
		await confirm.getByLabel("Note for admins (optional)").fill("E2E suspend");
		await confirm.getByRole("button", { name: "Suspend", exact: true }).click();
		await expectToast(page, `${MEMBER_NAME}'s Dev MCP access was suspended.`);

		const suspended = page.getByRole("region", { name: "Suspended" });
		await expect(
			suspended.getByText(MEMBER_NAME, { exact: true }),
		).toBeVisible();
		await expect(suspended.getByText("Note: E2E suspend")).toBeVisible();
		expect(await readAccess(request)).toMatchObject({
			status: "suspended",
			role: null,
			tools: [],
		});
	});

	test("a member sees their Dev MCP access on Connected apps", async ({
		page,
		request,
	}) => {
		await request.post(`${ACCESS_URL}/request`, { headers: service });
		await loginWithSeedEmail(page, SEED_DEV_MCP_MEMBER_EMAIL);
		await page.goto("/connected-apps");

		await expect(page.getByTestId("dev-mcp-access-status")).toContainText(
			"Dev MCP access: waiting for approval",
		);
	});
});
