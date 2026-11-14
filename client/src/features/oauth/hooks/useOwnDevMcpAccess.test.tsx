import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useOwnDevMcpAccess } from "./useOwnDevMcpAccess";

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

describe("useOwnDevMcpAccess", () => {
	it("loads the member's own dev-mcp access", async () => {
		server.use(
			http.get("/api/dev-mcp-access/me", () =>
				HttpResponse.json({
					status: "active",
					role: "lead",
					tools: ["whoami"],
				}),
			),
		);
		const { result } = renderHookWithClient(() => useOwnDevMcpAccess());

		expect(result.current.isLoading).toBe(true);
		await waitFor(() =>
			expect(result.current.access).toEqual({
				status: "active",
				role: "lead",
				tools: ["whoami"],
			}),
		);
		expect(result.current.hasError).toBe(false);
	});

	it("reports a failure", async () => {
		server.use(
			http.get("/api/dev-mcp-access/me", () =>
				HttpResponse.json({ error: "boom" }, { status: 500 }),
			),
		);
		const { result } = renderHookWithClient(() => useOwnDevMcpAccess());

		await waitFor(() => expect(result.current.hasError).toBe(true));
		expect(result.current.access).toBeNull();
	});
});
