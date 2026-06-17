import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdminMember } from "../adminUtils";
import { useAdminMemberEditor } from "./useAdminMemberEditor";

const { updateMemberAsync, showToast } = vi.hoisted(() => ({
	updateMemberAsync: vi.fn(),
	showToast: vi.fn(),
}));

vi.mock("../../../hooks/useAdminData", () => ({
	useAdminData: () => ({ updateMemberAsync, isSavingMember: false }),
}));

vi.mock("../../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("../../../hooks/useResearchProjects", () => ({
	useResearchProjects: () => ({ researchProjects: [], isLoading: false }),
}));

function member(overrides: Partial<AdminMember> = {}): AdminMember {
	return {
		user_id: "u-1",
		given_name: "Alice",
		surname: "Example",
		email: "alice@example.com",
		department: "Software Development",
		member_role: "Member",
		board_role: null,
		member_status: "active",
		access_role: "user",
		active: true,
		batch: "WS23",
		research_project_id: null,
		sepa: null,
		...overrides,
	} as AdminMember;
}

describe("useAdminMemberEditor", () => {
	it("opens the editor seeded from the member", () => {
		const { result } = renderHook(() => useAdminMemberEditor());

		act(() => result.current.openMemberEditor(member()));

		expect(result.current.memberBeingEdited?.user_id).toBe("u-1");
		expect(result.current.editRole).toBe("Member");
		expect(result.current.editDepartment).toBe("Software Development");
		expect(result.current.editBatch).toBe("WS23");
	});

	it("flags a missing required department after clearing it", () => {
		const { result } = renderHook(() => useAdminMemberEditor());

		act(() => result.current.openMemberEditor(member()));
		act(() => result.current.setEditDepartment(""));

		expect(result.current.isMissingRequiredDepartment).toBe(true);
		expect(result.current.isMemberSaveDisabled).toBe(true);
	});

	it("preserves a missing department when the role is unchanged", () => {
		const { result } = renderHook(() => useAdminMemberEditor());

		act(() => result.current.openMemberEditor(member({ department: null })));

		expect(result.current.isPreservingMissingRequiredDepartment).toBe(true);
		expect(result.current.isMemberSaveDisabled).toBe(false);
	});

	it("disables save for an invalid LinkedIn URL", () => {
		const { result } = renderHook(() => useAdminMemberEditor());

		act(() => result.current.openMemberEditor(member()));
		act(() => result.current.setEditLinkedinUrl("not-a-url"));

		expect(result.current.isEditLinkedinUrlInvalid).toBe(true);
		expect(result.current.isMemberSaveDisabled).toBe(true);
	});

	it("saves member changes with resolved fields and closes", async () => {
		updateMemberAsync.mockResolvedValueOnce(undefined);
		const { result } = renderHook(() => useAdminMemberEditor());

		act(() => result.current.openMemberEditor(member()));
		await act(async () => {
			await result.current.saveMemberChanges();
		});

		expect(updateMemberAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "u-1",
				member_role: "Member",
				department: "Software Development",
				board_role: null,
				batch: "WS23",
			}),
		);
		await waitFor(() => expect(result.current.memberBeingEdited).toBeNull());
	});
});
