import { afterEach, describe, expect, it, vi } from "vitest";
import {
	fetchAuthorizationRequest,
	fetchConnectedApps,
	revokeConnectedApp,
	submitConsentDecision,
} from "./oauthApi";

const oauth = vi.hoisted(() => ({
	getAuthorizationDetails: vi.fn(),
	approveAuthorization: vi.fn(),
	denyAuthorization: vi.fn(),
	listGrants: vi.fn(),
	revokeGrant: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({ supabase: { auth: { oauth } } }));

const authError = Object.assign(new Error("authorization not found"), {
	status: 404,
});

describe("oauthApi", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("maps a request that needs consent", async () => {
		// The shape the local auth server returns: no client uri or logo.
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: {
				authorization_id: "auth-1",
				redirect_uri: "https://claude.ai/api/mcp/auth_callback",
				client: { id: "client-1", name: " Claude " },
				user: { id: "user-1", email: "ada@example.com" },
				scope: "openid email",
			},
			error: null,
		});

		await expect(fetchAuthorizationRequest("auth-1")).resolves.toEqual({
			kind: "consent",
			authorizationId: "auth-1",
			clientName: "Claude",
			redirectUri: "https://claude.ai/api/mcp/auth_callback",
			scopes: ["openid", "email"],
			userEmail: "ada@example.com",
		});
		expect(oauth.getAuthorizationDetails).toHaveBeenCalledWith("auth-1");
	});

	it("names an app without a name", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: {
				authorization_id: "auth-1",
				redirect_uri: "http://localhost:1/cb",
				client: { id: "client-1", name: "" },
				scope: "",
			},
			error: null,
		});

		await expect(fetchAuthorizationRequest("auth-1")).resolves.toMatchObject({
			clientName: "An unnamed app",
			scopes: [],
			userEmail: null,
		});
	});

	it("maps an app the member already approved to its redirect", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: { redirect_url: "https://claude.ai/cb?code=abc" },
			error: null,
		});

		await expect(fetchAuthorizationRequest("auth-1")).resolves.toEqual({
			kind: "redirect",
			redirectUrl: "https://claude.ai/cb?code=abc",
		});
	});

	it("throws the auth error", async () => {
		oauth.getAuthorizationDetails.mockResolvedValue({
			data: null,
			error: authError,
		});

		await expect(fetchAuthorizationRequest("auth-1")).rejects.toBe(authError);
	});

	it.each([
		["approve", "approveAuthorization"],
		["deny", "denyAuthorization"],
	] as const)("%s returns the redirect without leaving the page", async (decision, method) => {
		oauth[method].mockResolvedValue({
			data: { redirect_url: "https://claude.ai/cb?x=1" },
			error: null,
		});

		await expect(submitConsentDecision("auth-1", decision)).resolves.toBe(
			"https://claude.ai/cb?x=1",
		);
		expect(oauth[method]).toHaveBeenCalledWith("auth-1", {
			skipBrowserRedirect: true,
		});
	});

	it("throws when a decision fails", async () => {
		oauth.approveAuthorization.mockResolvedValue({
			data: null,
			error: authError,
		});

		await expect(submitConsentDecision("auth-1", "approve")).rejects.toBe(
			authError,
		);
	});

	it("lists connected apps", async () => {
		oauth.listGrants.mockResolvedValue({
			data: [
				{
					client: { id: "client-1", name: "Claude" },
					scopes: ["email"],
					granted_at: "2026-11-02T18:32:57Z",
				},
				{
					client: { id: "client-2", name: "  " },
					scopes: [],
					granted_at: "2026-11-01T10:00:00Z",
				},
			],
			error: null,
		});

		await expect(fetchConnectedApps()).resolves.toEqual([
			{
				clientId: "client-1",
				name: "Claude",
				scopes: ["email"],
				grantedAt: "2026-11-02T18:32:57Z",
			},
			{
				clientId: "client-2",
				name: "An unnamed app",
				scopes: [],
				grantedAt: "2026-11-01T10:00:00Z",
			},
		]);
	});

	it("throws when listing fails", async () => {
		oauth.listGrants.mockResolvedValue({ data: null, error: authError });

		await expect(fetchConnectedApps()).rejects.toBe(authError);
	});

	it("revokes an app by client id", async () => {
		oauth.revokeGrant.mockResolvedValue({ data: {}, error: null });

		await revokeConnectedApp("client-1");

		expect(oauth.revokeGrant).toHaveBeenCalledWith({ clientId: "client-1" });
	});

	it("throws when revoking fails", async () => {
		oauth.revokeGrant.mockResolvedValue({ data: null, error: authError });

		await expect(revokeConnectedApp("client-1")).rejects.toBe(authError);
	});
});
