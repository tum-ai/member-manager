import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useOwnMcpAccess } from "./useOwnMcpAccess";

vi.mock("@/lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

describe("useOwnMcpAccess", () => {
	it("loads the member's own nomcp access", async () => {
		server.use(
			http.get("/api/mcp-access/me", () =>
				HttpResponse.json({ status: "approved", role: "reader" }),
			),
		);
		const { result } = renderHookWithClient(() => useOwnMcpAccess());

		expect(result.current.isLoading).toBe(true);
		await waitFor(() =>
			expect(result.current.access).toEqual({
				status: "approved",
				role: "reader",
			}),
		);
		expect(result.current.hasError).toBe(false);
	});

	it("reports a failure", async () => {
		server.use(
			http.get("/api/mcp-access/me", () =>
				HttpResponse.json({ error: "boom" }, { status: 500 }),
			),
		);
		const { result } = renderHookWithClient(() => useOwnMcpAccess());

		await waitFor(() => expect(result.current.hasError).toBe(true));
		expect(result.current.access).toBeNull();
	});
});
