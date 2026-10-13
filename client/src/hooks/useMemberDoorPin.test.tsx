import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { memberDoorPinQueryKey, useMemberDoorPin } from "./useMemberDoorPin";

vi.mock("../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

describe("useMemberDoorPin", () => {
	it("loads the member's door PIN", async () => {
		const available = {
			status: "available",
			pin: "482913",
			updated_at: "2026-10-13T10:00:00Z",
		};
		server.use(
			http.get("/api/members/:id/door-pin", ({ params }) =>
				params.id === "user-1"
					? HttpResponse.json(available)
					: HttpResponse.json({ error: "Forbidden" }, { status: 403 }),
			),
		);

		const { result } = renderHookWithClient(() => useMemberDoorPin("user-1"));

		await waitFor(() => expect(result.current.doorPin).toEqual(available));
		expect(result.current.error).toBeNull();
	});

	it("passes the /welcome gate through as a status", async () => {
		server.use(
			http.get("/api/members/:id/door-pin", () =>
				HttpResponse.json({ status: "welcome_required" }),
			),
		);

		const { result } = renderHookWithClient(() => useMemberDoorPin("user-1"));

		await waitFor(() =>
			expect(result.current.doorPin).toEqual({ status: "welcome_required" }),
		);
	});

	it("doesn't fetch while disabled", async () => {
		const handler = vi.fn(() => HttpResponse.json({ status: "not_assigned" }));
		server.use(http.get("/api/members/:id/door-pin", handler));

		const { result, queryClient } = renderHookWithClient(() =>
			useMemberDoorPin("user-1", { enabled: false }),
		);

		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(handler).not.toHaveBeenCalled();
		expect(result.current.doorPin).toBeUndefined();
		expect(
			queryClient.getQueryData(memberDoorPinQueryKey("user-1")),
		).toBeUndefined();
	});

	it("surfaces a failed request", async () => {
		server.use(
			http.get("/api/members/:id/door-pin", () =>
				HttpResponse.json({ error: "Database error" }, { status: 500 }),
			),
		);

		const { result } = renderHookWithClient(() => useMemberDoorPin("user-1"));

		await waitFor(() => expect(result.current.error).toBeTruthy());
	});
});
