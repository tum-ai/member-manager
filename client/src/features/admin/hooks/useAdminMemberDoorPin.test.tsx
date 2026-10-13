import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memberDoorPinQueryKey } from "@/hooks/useMemberDoorPin";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useAdminMemberDoorPin } from "./useAdminMemberDoorPin";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

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

const available = {
	status: "available",
	pin: "482913",
	updated_at: "2026-10-13T10:00:00Z",
};

beforeEach(() => {
	showToast.mockReset();
});

describe("useAdminMemberDoorPin", () => {
	it("only fetches the PIN once the admin asks to see it", async () => {
		const handler = vi.fn(() => HttpResponse.json(available));
		server.use(http.get("/api/members/:id/door-pin", handler));

		const { result } = renderHookWithClient(() => useAdminMemberDoorPin("m1"));

		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(handler).not.toHaveBeenCalled();
		expect(result.current.doorPin).toBeUndefined();

		act(() => result.current.toggleRevealed());

		await waitFor(() => expect(result.current.doorPin).toEqual(available));
		expect(handler).toHaveBeenCalledTimes(1);

		act(() => result.current.toggleRevealed());
		expect(result.current.doorPin).toBeUndefined();
	});

	it("validates the new PIN before it can be saved", () => {
		const { result } = renderHookWithClient(() => useAdminMemberDoorPin("m1"));

		expect(result.current.canSavePin).toBe(false);
		expect(result.current.draftError).toBeNull();

		act(() => result.current.setDraftPin("12a"));
		expect(result.current.canSavePin).toBe(false);
		expect(result.current.draftError).toBe("A door PIN has 4 to 10 digits");

		act(() => result.current.setDraftPin(" 482913 "));
		expect(result.current.canSavePin).toBe(true);
		expect(result.current.draftError).toBeNull();
	});

	it("saves a PIN, shows it and caches the result", async () => {
		let putBody: unknown;
		server.use(
			http.put("/api/admin/members/:id/door-pin", async ({ request }) => {
				putBody = await request.json();
				return HttpResponse.json(available);
			}),
			http.get("/api/members/:id/door-pin", () => HttpResponse.json(available)),
		);
		const { result, queryClient } = renderHookWithClient(() =>
			useAdminMemberDoorPin("m1"),
		);

		act(() => result.current.setDraftPin(" 482913 "));
		await act(async () => {
			await result.current.savePin();
		});

		expect(putBody).toEqual({ pin: "482913" });
		expect(result.current.draftPin).toBe("");
		expect(result.current.isRevealed).toBe(true);
		expect(queryClient.getQueryData(memberDoorPinQueryKey("m1"))).toEqual(
			available,
		);
		expect(showToast).toHaveBeenCalledWith("Door PIN saved.", "success");
	});

	it("reports a PIN another member already has", async () => {
		server.use(
			http.put("/api/admin/members/:id/door-pin", () =>
				HttpResponse.json(
					{ error: "Another member already has this door PIN" },
					{ status: 409 },
				),
			),
		);
		const { result } = renderHookWithClient(() => useAdminMemberDoorPin("m1"));

		act(() => result.current.setDraftPin("482913"));
		await act(async () => {
			await result.current.savePin();
		});

		expect(showToast).toHaveBeenCalledWith(
			"Another member already has this door PIN",
			"error",
		);
		expect(result.current.draftPin).toBe("482913");
	});

	it("clears the PIN after confirmation", async () => {
		const handler = vi.fn(() => new HttpResponse(null, { status: 204 }));
		server.use(http.delete("/api/admin/members/:id/door-pin", handler));
		const { result, queryClient } = renderHookWithClient(() =>
			useAdminMemberDoorPin("m1"),
		);

		act(() => result.current.requestClear());
		expect(result.current.isConfirmingClear).toBe(true);
		act(() => result.current.cancelClear());
		expect(result.current.isConfirmingClear).toBe(false);

		act(() => result.current.requestClear());
		await act(async () => {
			await result.current.clearPin();
		});

		expect(handler).toHaveBeenCalledTimes(1);
		expect(result.current.isConfirmingClear).toBe(false);
		expect(queryClient.getQueryData(memberDoorPinQueryKey("m1"))).toEqual({
			status: "not_assigned",
		});
		expect(showToast).toHaveBeenCalledWith("Door PIN cleared.", "success");
	});

	it("starts over, hidden, for another member", async () => {
		server.use(
			http.get("/api/members/:id/door-pin", () => HttpResponse.json(available)),
		);
		const { result, rerender } = renderHookWithClient(
			({ userId }: { userId: string | null }) => useAdminMemberDoorPin(userId),
			{ initialProps: { userId: "m1" as string | null } },
		);

		act(() => {
			result.current.toggleRevealed();
			result.current.setDraftPin("1234");
			result.current.requestClear();
		});
		await waitFor(() => expect(result.current.doorPin).toEqual(available));

		rerender({ userId: "m2" });

		expect(result.current.isRevealed).toBe(false);
		expect(result.current.draftPin).toBe("");
		expect(result.current.isConfirmingClear).toBe(false);
		expect(result.current.doorPin).toBeUndefined();
	});

	it("does nothing without a member", async () => {
		const { result } = renderHookWithClient(() => useAdminMemberDoorPin(null));

		act(() => result.current.setDraftPin("482913"));
		await act(async () => {
			await result.current.savePin();
			await result.current.clearPin();
		});

		expect(showToast).not.toHaveBeenCalled();
	});
});
