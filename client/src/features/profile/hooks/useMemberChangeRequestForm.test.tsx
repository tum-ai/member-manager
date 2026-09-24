import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMemberChangeRequestForm } from "./useMemberChangeRequestForm";

const showToast = vi.fn();
const submitChangeRequestAsync = vi.fn();
let requests: unknown[] = [];

vi.mock("../../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));
vi.mock("../../../hooks/useMemberChangeRequests", () => ({
	useMemberChangeRequests: () => ({
		requests,
		submitChangeRequestAsync,
		isSubmitting: false,
	}),
}));

beforeEach(() => {
	vi.clearAllMocks();
	requests = [];
	submitChangeRequestAsync.mockResolvedValue(undefined);
});

describe("useMemberChangeRequestForm", () => {
	it("warns and skips submission when nothing is requested", async () => {
		const { result } = renderHook(() => useMemberChangeRequestForm("user-1"));

		await act(async () => {
			await result.current.handleSubmitMemberChangeRequest();
		});

		expect(submitChangeRequestAsync).not.toHaveBeenCalled();
		expect(showToast).toHaveBeenCalledWith(
			"Select a role, department, or alumni status change to request.",
			"warning",
		);
	});

	it("submits requested changes and resets the form", async () => {
		const { result } = renderHook(() => useMemberChangeRequestForm("user-1"));

		act(() => {
			result.current.setRequestedRole("Team Lead");
			result.current.setRequestedDepartment("Venture");
			result.current.setIsRequestingAlumniStatus(true);
			result.current.setChangeRequestReason("  promotion  ");
		});

		await act(async () => {
			await result.current.handleSubmitMemberChangeRequest();
		});

		expect(submitChangeRequestAsync).toHaveBeenCalledWith({
			changes: {
				member_role: "Team Lead",
				department: "Venture",
				member_status: "alumni",
			},
			reason: "promotion",
		});
		expect(showToast).toHaveBeenCalledWith(
			"Change request sent to the admin and LnF team.",
			"success",
		);

		await waitFor(() => expect(result.current.requestedRole).toBe(""));
		expect(result.current.requestedDepartment).toBe("");
		expect(result.current.isRequestingAlumniStatus).toBe(false);
		expect(result.current.changeRequestReason).toBe("");
	});

	it("exposes every change request, not just the newest (#325)", () => {
		requests = [
			{
				id: "r-vp",
				status: "pending",
				changes: { member_role: "Vice-President" },
			},
			{
				id: "r-president",
				status: "pending",
				changes: { member_role: "President" },
			},
		];
		const { result } = renderHook(() => useMemberChangeRequestForm("user-1"));
		expect(result.current.memberChangeRequests).toEqual(requests);
		expect(result.current.memberChangeRequests).toHaveLength(2);
	});
});
