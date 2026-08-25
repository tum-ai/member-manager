import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";

vi.mock("./supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
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
});
