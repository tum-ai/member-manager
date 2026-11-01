import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";
import { takeAuthNotice, WORKSPACE_NOT_ALLOWED_NOTICE } from "./authNotice";
import { supabase } from "./supabaseClient";

vi.mock("./supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn().mockResolvedValue({ error: null }),
		},
	},
}));

describe("apiClient", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("does not send a JSON content-type for empty requests", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await apiClient("/api/members/bootstrap-local-admin", { method: "POST" });

		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers["Content-Type"]).toBeUndefined();
		expect(headers.Authorization).toBe("Bearer test-token");
	});

	it("sends a JSON content-type when a body is present", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await apiClient("/api/example", {
			method: "POST",
			body: JSON.stringify({ ok: true }),
		});

		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers["Content-Type"]).toBe("application/json");
	});

	it("lets fetch set the multipart boundary for FormData", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const body = new FormData();
		body.append("file", new Blob(["docx"]), "contract.docx");

		await apiClient("/api/contracts/templates/template-1/documents", {
			method: "POST",
			body,
		});

		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers["Content-Type"]).toBeUndefined();
		expect(headers.Authorization).toBe("Bearer test-token");
	});

	it("signs out and remembers a notice when the workspace is not allowed", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: "Slack workspace not allowed" }), {
					status: 401,
					headers: { "content-type": "application/json" },
				}),
			),
		);

		await expect(apiClient("/api/members/me")).rejects.toThrow(
			"Slack workspace not allowed",
		);
		expect(supabase.auth.signOut).toHaveBeenCalled();
		expect(takeAuthNotice()).toBe(WORKSPACE_NOT_ALLOWED_NOTICE);
	});

	it("signs out without a notice for an ordinary invalid token", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: "Invalid token" }), {
					status: 401,
					headers: { "content-type": "application/json" },
				}),
			),
		);

		await expect(apiClient("/api/members/me")).rejects.toThrow("Invalid token");
		expect(supabase.auth.signOut).toHaveBeenCalled();
		expect(takeAuthNotice()).toBeNull();
	});
});
