import type { User } from "@supabase/supabase-js";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileSepaInput } from "@/lib/schemas";
import { type UseProfileFormResult, useProfileForm } from "./useProfileForm";

const showToast = vi.fn();

let memberData: Record<string, unknown> | undefined;
let isLoadingMember = false;
const updateMemberAsync = vi.fn();

let isAdmin = false;
let isLoadingAdminRole = false;

let researchProjects: unknown[] | undefined = [];
let isLoadingResearchProjects = false;

let sepaData: Record<string, unknown> | undefined;
let isLoadingSepa = false;
const updateSepaAsync = vi.fn();

vi.mock("../../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("../../../hooks/useMemberData", () => ({
	useMemberData: () => ({
		member: memberData,
		isLoading: isLoadingMember,
		updateMemberAsync,
		isUpdating: false,
	}),
}));

vi.mock("../../../hooks/useIsAdmin", () => ({
	useIsAdmin: () => ({ isAdmin, isLoading: isLoadingAdminRole }),
}));

vi.mock("../../../hooks/useResearchProjects", () => ({
	useResearchProjects: () => ({
		researchProjects,
		isLoading: isLoadingResearchProjects,
	}),
}));

vi.mock("../../../hooks/useSepaData", () => ({
	useSepaData: () => ({
		sepa: sepaData,
		isLoading: isLoadingSepa,
		updateSepaAsync,
		isUpdating: false,
	}),
}));

const user = {
	id: "user-1",
	email: "ada@tum.ai",
	user_metadata: { given_name: "Ada", family_name: "Lovelace" },
} as unknown as User;

beforeEach(() => {
	vi.clearAllMocks();
	memberData = undefined;
	isLoadingMember = false;
	isAdmin = false;
	isLoadingAdminRole = false;
	researchProjects = [];
	isLoadingResearchProjects = false;
	sepaData = undefined;
	isLoadingSepa = false;
	updateMemberAsync.mockResolvedValue(undefined);
	updateSepaAsync.mockResolvedValue(undefined);
});

describe("useProfileForm", () => {
	it("stays loading until member, sepa and role queries settle", () => {
		isLoadingMember = true;
		const { result } = renderHook(() => useProfileForm(user));
		expect(result.current.isLoading).toBe(true);
	});

	it("hydrates the member form from Slack metadata when no member exists", async () => {
		const { result } = renderHook(() => useProfileForm(user));

		await waitFor(() =>
			expect(result.current.memberForm.getValues("given_name")).toBe("Ada"),
		);
		expect(result.current.memberForm.getValues("surname")).toBe("Lovelace");
		expect(result.current.isLoading).toBe(false);
	});

	it("hydrates member, linkedin and sepa forms from fetched data", async () => {
		memberData = {
			given_name: "Grace",
			surname: "Hopper",
			active: false,
			batch: "WS25",
			linkedin_profile_url: "https://linkedin.com/in/grace",
			public_location: "Munich",
			reimbursement_slack_notifications_enabled: true,
		};
		sepaData = {
			iban: "DE89370400440532013000",
			bic: "COBADEFFXXX",
			bank_name: "Test Bank",
			mandate_agreed: true,
			privacy_agreed: true,
			data_privacy_notice_agreed: true,
		};

		const { result } = renderHook(() => useProfileForm(user));

		await waitFor(() =>
			expect(result.current.memberForm.getValues("given_name")).toBe("Grace"),
		);
		expect(result.current.memberForm.getValues("member_status")).toBe(
			"inactive",
		);
		expect(result.current.linkedinForm.getValues("linkedin_profile_url")).toBe(
			"https://linkedin.com/in/grace",
		);
		expect(result.current.sepaForm.getValues("iban")).toBe(
			"DE89370400440532013000",
		);
		expect(
			result.current.memberForm.getValues(
				"reimbursement_slack_notifications_enabled",
			),
		).toBe(true);
		expect(result.current.normalizedLinkedinUrl).toBe(
			"https://linkedin.com/in/grace",
		);
		expect(result.current.isLinkedinUrlValid).toBe(true);
	});

	it("blocks submit and toasts when required member fields are missing", async () => {
		const { result } = renderHook(() => useProfileForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.memberForm.setValue("given_name", "");
			result.current.memberForm.setValue("surname", "");
		});

		await act(async () => {
			await result.current.onSubmit();
		});

		expect(updateMemberAsync).not.toHaveBeenCalled();
		expect(showToast).toHaveBeenCalledWith(
			"Please complete all required profile fields before saving.",
			"error",
		);
	});

	describe("optional bank details (#304)", () => {
		// GET /api/sepa/:userId for a member who never saved bank details.
		const noBankDetails = {
			user_id: "user-1",
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: false,
			privacy_agreed: false,
			data_privacy_notice_agreed: false,
		};
		const savedBankDetails = {
			user_id: "user-1",
			iban: "DE89370400440532013000",
			bic: "COBADEFFXXX",
			bank_name: "Test Bank",
			mandate_agreed: true,
			privacy_agreed: true,
			data_privacy_notice_agreed: true,
		};

		async function renderLoaded() {
			const rendered = renderHook(() => useProfileForm(user));
			await waitFor(() =>
				expect(rendered.result.current.isLoading).toBe(false),
			);
			await waitFor(() =>
				expect(rendered.result.current.memberForm.getValues("given_name")).toBe(
					"Ada",
				),
			);
			return rendered;
		}

		// getFieldState reads the form's live errors; formState.errors is a
		// render snapshot that only updates when a component subscribes to it.
		function fieldError(
			result: { current: UseProfileFormResult },
			name: keyof ProfileSepaInput,
		): string | undefined {
			return result.current.sepaForm.getFieldState(name).error?.message;
		}

		async function submit(result: {
			current: { onSubmit: () => Promise<void> };
		}) {
			await act(async () => {
				await result.current.onSubmit();
			});
		}

		beforeEach(() => {
			memberData = { given_name: "Ada", surname: "Lovelace", degree: "" };
		});

		it("saves a degree change without bank details and without a SEPA request", async () => {
			sepaData = { ...noBankDetails };
			const { result } = await renderLoaded();

			act(() => {
				result.current.memberForm.setValue("degree", "Bachelor Informatics");
			});
			await submit(result);

			expect(updateMemberAsync).toHaveBeenCalledTimes(1);
			expect(updateMemberAsync.mock.calls[0][0].degree).toBe(
				"Bachelor Informatics",
			);
			expect(updateSepaAsync).not.toHaveBeenCalled();
			expect(showToast).toHaveBeenCalledWith(
				"Profile saved successfully!",
				"success",
			);
		});

		it("saves agreements alone when no bank details are entered", async () => {
			sepaData = { ...noBankDetails };
			const { result } = await renderLoaded();

			act(() => {
				result.current.sepaForm.setValue("privacy_agreed", true, {
					shouldDirty: true,
				});
				result.current.sepaForm.setValue("data_privacy_notice_agreed", true, {
					shouldDirty: true,
				});
			});
			await submit(result);

			expect(updateMemberAsync).toHaveBeenCalledTimes(1);
			expect(updateSepaAsync).toHaveBeenCalledWith({
				iban: "",
				bic: "",
				bank_name: "",
				mandate_agreed: false,
				privacy_agreed: true,
				data_privacy_notice_agreed: true,
			});
			expect(showToast).toHaveBeenCalledWith(
				"Profile saved successfully!",
				"success",
			);
		});

		it("sends normalized bank details when a member adds them", async () => {
			sepaData = { ...noBankDetails };
			const { result } = await renderLoaded();

			act(() => {
				result.current.sepaForm.setValue("iban", "de89 3704 0044 0532 0130 00");
				result.current.sepaForm.setValue("bank_name", "Test Bank");
				result.current.sepaForm.setValue("mandate_agreed", true);
			});
			await submit(result);

			expect(updateSepaAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					iban: "DE89370400440532013000",
					bank_name: "Test Bank",
					mandate_agreed: true,
					privacy_agreed: false,
				}),
			);
		});

		it.each([
			["a partial IBAN", "DE8937"],
			["an IBAN with a bad checksum", "DE89370400440532013001"],
		])("blocks the whole save for %s", async (_label, iban) => {
			sepaData = { ...noBankDetails };
			const { result } = await renderLoaded();

			act(() => {
				result.current.sepaForm.setValue("iban", iban);
				result.current.sepaForm.setValue("bank_name", "Test Bank");
				result.current.sepaForm.setValue("mandate_agreed", true);
			});
			await submit(result);

			expect(updateMemberAsync).not.toHaveBeenCalled();
			expect(updateSepaAsync).not.toHaveBeenCalled();
			expect(fieldError(result, "iban")).toBe("Invalid IBAN");
			expect(showToast).toHaveBeenCalledWith(
				"Please complete all required fields and agreements before saving.",
				"error",
			);
		});

		it("requires IBAN, bank name and mandate once any bank field is filled", async () => {
			sepaData = { ...noBankDetails };
			const { result } = await renderLoaded();

			act(() => {
				result.current.sepaForm.setValue("bic", "COBADEFFXXX");
			});
			await submit(result);

			expect(updateMemberAsync).not.toHaveBeenCalled();
			expect(fieldError(result, "iban")).toBe("Invalid IBAN");
			expect(fieldError(result, "bank_name")).toBe("Bank name is required");
			expect(fieldError(result, "mandate_agreed")).toBe(
				"You must agree to the SEPA mandate",
			);
		});

		it("refuses to clear bank details that are already saved", async () => {
			sepaData = { ...savedBankDetails };
			const { result } = await renderLoaded();
			await waitFor(() =>
				expect(result.current.sepaForm.getValues("iban")).toBe(
					"DE89370400440532013000",
				),
			);

			act(() => {
				result.current.sepaForm.setValue("iban", "");
				result.current.sepaForm.setValue("bic", "");
				result.current.sepaForm.setValue("bank_name", "");
			});
			await submit(result);

			const removalMessage =
				"Bank details can't be removed once saved — edit them instead";
			expect(updateMemberAsync).not.toHaveBeenCalled();
			expect(updateSepaAsync).not.toHaveBeenCalled();
			expect(fieldError(result, "iban")).toBe(removalMessage);
			expect(showToast).toHaveBeenCalledWith(removalMessage, "error");
		});

		it("still lets members edit saved bank details", async () => {
			sepaData = { ...savedBankDetails };
			const { result } = await renderLoaded();
			await waitFor(() =>
				expect(result.current.sepaForm.getValues("bank_name")).toBe(
					"Test Bank",
				),
			);

			act(() => {
				result.current.sepaForm.setValue("iban", "GB82WEST12345698765432");
				result.current.sepaForm.setValue("bank_name", "New Bank");
			});
			await submit(result);

			expect(updateSepaAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					iban: "GB82WEST12345698765432",
					bank_name: "New Bank",
				}),
			);
		});
	});

	it("submits only the member payload for a self-service member without sepa", async () => {
		const { result } = renderHook(() => useProfileForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.memberForm.setValue("given_name", "Ada");
			result.current.memberForm.setValue("surname", "Lovelace");
			// Admin-managed fields must be stripped from the self-service payload.
			result.current.memberForm.setValue("department", "Venture");
			result.current.memberForm.setValue("member_role", "Team Lead");
			result.current.memberForm.setValue("research_project_id", "rp-1");
			result.current.memberForm.setValue(
				"reimbursement_slack_notifications_enabled",
				true,
			);
		});

		await act(async () => {
			await result.current.onSubmit();
		});

		await waitFor(() => expect(updateMemberAsync).toHaveBeenCalledTimes(1));
		expect(updateSepaAsync).not.toHaveBeenCalled();
		const payload = updateMemberAsync.mock.calls[0][0];
		expect(payload).not.toHaveProperty("department");
		expect(payload).not.toHaveProperty("member_role");
		// Non-admin, non-research effective department drops research_project_id.
		expect(payload).not.toHaveProperty("research_project_id");
		expect(payload.reimbursement_slack_notifications_enabled).toBe(true);
		expect(showToast).toHaveBeenCalledWith(
			"Profile saved successfully!",
			"success",
		);
	});

	it("includes admin-managed fields and resolves research department for admins", async () => {
		isAdmin = true;
		const { result } = renderHook(() => useProfileForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.memberForm.setValue("given_name", "Ada");
			result.current.memberForm.setValue("surname", "Lovelace");
			result.current.memberForm.setValue("batch", "SS25");
			result.current.memberForm.setValue("member_role", "Member");
			result.current.memberForm.setValue("department", "Research");
			result.current.memberForm.setValue("research_project_id", "rp-99");
		});

		await act(async () => {
			await result.current.onSubmit();
		});

		await waitFor(() => expect(updateMemberAsync).toHaveBeenCalledTimes(1));
		const payload = updateMemberAsync.mock.calls[0][0];
		expect(payload.batch).toBe("SS25");
		expect(payload.member_role).toBe("Member");
		expect(payload.department).toBe("Research");
		expect(payload.research_project_id).toBe("rp-99");
	});

	it("nulls research_project_id for admins outside the research department", async () => {
		isAdmin = true;
		const { result } = renderHook(() => useProfileForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.memberForm.setValue("given_name", "Ada");
			result.current.memberForm.setValue("surname", "Lovelace");
			result.current.memberForm.setValue("member_role", "Member");
			result.current.memberForm.setValue("department", "Venture");
		});

		await act(async () => {
			await result.current.onSubmit();
		});

		await waitFor(() => expect(updateMemberAsync).toHaveBeenCalledTimes(1));
		const payload = updateMemberAsync.mock.calls[0][0];
		expect(payload.research_project_id).toBeNull();
	});

	it("submits both member and sepa updates when sepa data exists and is valid", async () => {
		sepaData = {
			iban: "DE89370400440532013000",
			bic: "COBADEFFXXX",
			bank_name: "Test Bank",
			mandate_agreed: true,
			privacy_agreed: true,
			data_privacy_notice_agreed: true,
		};
		memberData = { given_name: "Ada", surname: "Lovelace" };

		const { result } = renderHook(() => useProfileForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		await waitFor(() =>
			expect(result.current.sepaForm.getValues("iban")).toBe(
				"DE89370400440532013000",
			),
		);

		await act(async () => {
			await result.current.onSubmit();
		});

		await waitFor(() => expect(updateMemberAsync).toHaveBeenCalledTimes(1));
		expect(updateSepaAsync).toHaveBeenCalledTimes(1);
		expect(showToast).toHaveBeenCalledWith(
			"Profile saved successfully!",
			"success",
		);
	});

	it("surfaces a toast when a mutation rejects", async () => {
		updateMemberAsync.mockRejectedValue(new Error("network down"));
		const { result } = renderHook(() => useProfileForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.memberForm.setValue("given_name", "Ada");
			result.current.memberForm.setValue("surname", "Lovelace");
		});

		await act(async () => {
			await result.current.onSubmit();
		});

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Error saving: network down",
				"error",
			),
		);
	});

	it("falls back to Unknown error when the rejection is not an Error", async () => {
		updateMemberAsync.mockRejectedValue("boom");
		const { result } = renderHook(() => useProfileForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.memberForm.setValue("given_name", "Ada");
			result.current.memberForm.setValue("surname", "Lovelace");
		});

		await act(async () => {
			await result.current.onSubmit();
		});

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Error saving: Unknown error",
				"error",
			),
		);
	});

	it("filters research project options by active status and computes completeness", async () => {
		researchProjects = [
			{ id: "rp-active", title: "Active", status: "ongoing" },
			{ id: "rp-done", title: "Done", status: "completed" },
			{ id: "rp-blank", title: "Blank", status: "" },
		];
		const { result } = renderHook(() => useProfileForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(result.current.researchProjectOptions.map((p) => p.id)).toEqual([
			"rp-active",
			"rp-blank",
		]);
		expect(typeof result.current.completeness).toBe("number");
		expect(Array.isArray(result.current.missingProfileFields)).toBe(true);
	});

	it("flags the research department when the current role resolves to research", async () => {
		const { result } = renderHook(() => useProfileForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.memberForm.setValue("department", "Research");
		});

		await waitFor(() =>
			expect(result.current.isResearchDepartmentSelected).toBe(true),
		);
	});
});
