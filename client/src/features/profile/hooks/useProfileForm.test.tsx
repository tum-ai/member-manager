import type { User } from "@supabase/supabase-js";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProfileForm } from "./useProfileForm";

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

	it("uses the sepa-specific validation message when sepa data exists", async () => {
		sepaData = {
			iban: "",
			bank_name: "",
			mandate_agreed: false,
			privacy_agreed: false,
			data_privacy_notice_agreed: false,
		};
		const { result } = renderHook(() => useProfileForm(user));
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await act(async () => {
			await result.current.onSubmit();
		});

		expect(updateMemberAsync).not.toHaveBeenCalled();
		expect(updateSepaAsync).not.toHaveBeenCalled();
		expect(showToast).toHaveBeenCalledWith(
			"Please complete all required fields and agreements before saving.",
			"error",
		);
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
