import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useDoorPin } from "./useDoorPin";

vi.mock("../../../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

describe("useDoorPin", () => {
	it("loads the PIN hidden and toggles showing it", async () => {
		server.use(
			http.get("/api/members/:id/door-pin", () =>
				HttpResponse.json({
					status: "available",
					pin: "482913",
					updated_at: "2026-10-13T10:00:00Z",
				}),
			),
		);

		const { result } = renderHookWithClient(() => useDoorPin("user-1"));

		await waitFor(() =>
			expect(result.current.doorPin?.status).toBe("available"),
		);
		expect(result.current.isRevealed).toBe(false);
		expect(result.current.hasError).toBe(false);

		act(() => result.current.toggleRevealed());
		expect(result.current.isRevealed).toBe(true);
		act(() => result.current.toggleRevealed());
		expect(result.current.isRevealed).toBe(false);
	});

	it("flags a failed request", async () => {
		server.use(
			http.get("/api/members/:id/door-pin", () =>
				HttpResponse.json({ error: "Database error" }, { status: 500 }),
			),
		);

		const { result } = renderHookWithClient(() => useDoorPin("user-1"));

		await waitFor(() => expect(result.current.hasError).toBe(true));
	});
});
