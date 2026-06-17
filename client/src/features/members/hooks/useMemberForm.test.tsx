import type { User } from "@supabase/supabase-js";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useMemberForm } from "./useMemberForm";

const showToast = vi.fn();
vi.mock("../../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

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

const user = { id: "user-1", email: "ada@tum.ai" } as User;

function stubData() {
	server.use(
		http.get("/api/members/user-1", () =>
			HttpResponse.json({
				active: true,
				salutation: "Ms.",
				given_name: "Ada",
				surname: "Lovelace",
				email: "ada@tum.ai",
			}),
		),
		http.get("/api/sepa/user-1", () =>
			HttpResponse.json({
				iban: "DE89370400440532013000",
				bic: "COBADEFFXXX",
				bank_name: "Test Bank",
				mandate_agreed: false,
				privacy_agreed: false,
				data_privacy_notice_agreed: false,
				user_id: "user-1",
			}),
		),
	);
}

describe("useMemberForm", () => {
	beforeEach(() => {
		showToast.mockClear();
	});

	it("hydrates both forms from fetched data", async () => {
		stubData();
		const { result } = renderHookWithClient(() => useMemberForm(user));

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.memberForm.getValues("given_name")).toBe("Ada");
		expect(result.current.sepaForm.getValues("iban")).toBe(
			"DE89370400440532013000",
		);
		expect(result.current.email).toBe("ada@tum.ai");
	});

	it("submits both updates in parallel and toasts success", async () => {
		let memberPut: unknown = null;
		let sepaPut: unknown = null;
		stubData();
		server.use(
			http.put("/api/members/user-1", async ({ request }) => {
				memberPut = await request.json();
				return new HttpResponse(null, { status: 204 });
			}),
			http.put("/api/sepa/user-1", async ({ request }) => {
				sepaPut = await request.json();
				return HttpResponse.json({});
			}),
		);

		const { result } = renderHookWithClient(() => useMemberForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		// Make the SEPA form valid so both mutations fire.
		act(() => {
			result.current.sepaForm.setValue("mandate_agreed", true);
			result.current.sepaForm.setValue("privacy_agreed", true);
			result.current.sepaForm.setValue("data_privacy_notice_agreed", true);
		});

		await act(async () => {
			await result.current.onSubmit();
		});

		await waitFor(() => expect(memberPut).not.toBeNull());
		expect(sepaPut).not.toBeNull();
		expect(showToast).toHaveBeenCalledWith(
			"Data saved successfully!",
			"success",
		);
	});

	it("custom events update the form and listeners clean up on unmount", async () => {
		stubData();
		const { result, unmount } = renderHookWithClient(() => useMemberForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			window.dispatchEvent(
				new CustomEvent("sepa-updated", { detail: { mandate_agreed: true } }),
			);
			window.dispatchEvent(
				new CustomEvent("privacy-updated", {
					detail: { privacy_agreed: true },
				}),
			);
			window.dispatchEvent(
				new CustomEvent("data-privacy-notice-updated", {
					detail: { data_privacy_notice_agreed: true },
				}),
			);
		});

		await waitFor(() => expect(result.current.mandateAgreed).toBe(true));
		expect(result.current.privacyAgreed).toBe(true);
		expect(result.current.dataPrivacyNoticeAgreed).toBe(true);

		const removeSpy = vi.spyOn(window, "removeEventListener");
		unmount();
		expect(removeSpy).toHaveBeenCalledWith(
			"sepa-updated",
			expect.any(Function),
		);
		expect(removeSpy).toHaveBeenCalledWith(
			"privacy-updated",
			expect.any(Function),
		);
		expect(removeSpy).toHaveBeenCalledWith(
			"data-privacy-notice-updated",
			expect.any(Function),
		);
		removeSpy.mockRestore();
	});

	it("status change request only confirms and toasts when accepted", async () => {
		stubData();
		const { result } = renderHookWithClient(() => useMemberForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
		act(() => result.current.handleStatusChangeRequest());
		expect(result.current.statusRequestMessage).toBe("");
		expect(showToast).not.toHaveBeenCalled();

		confirmSpy.mockReturnValue(true);
		act(() => result.current.handleStatusChangeRequest());
		await waitFor(() =>
			expect(result.current.statusRequestMessage).toContain("inactive"),
		);
		expect(showToast).toHaveBeenCalledWith(
			"Status change request sent!",
			"info",
		);
		confirmSpy.mockRestore();
	});

	it("cancel resets forms and toasts", async () => {
		stubData();
		const { result } = renderHookWithClient(() => useMemberForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => result.current.handleCancel());
		expect(showToast).toHaveBeenCalledWith(
			"Changes reverted to last saved state.",
			"info",
		);
	});
});
