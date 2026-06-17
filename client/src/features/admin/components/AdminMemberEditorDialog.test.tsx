import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AdminMember } from "@/features/admin/adminUtils";
import { AdminMemberEditorDialog } from "./AdminMemberEditorDialog";

const member = {
	user_id: "m1",
	given_name: "Alice",
	surname: "Example",
} as unknown as AdminMember;

function makeProps(
	overrides: Partial<React.ComponentProps<typeof AdminMemberEditorDialog>> = {},
): React.ComponentProps<typeof AdminMemberEditorDialog> {
	return {
		memberBeingEdited: member,
		openMemberEditor: vi.fn(),
		closeMemberEditor: vi.fn(),
		isSavingMember: false,
		isLoadingResearchProjects: false,
		editDepartment: "Software Development",
		setEditDepartment: vi.fn(),
		editRole: "Member",
		setEditRole: vi.fn(),
		editBatch: "",
		setEditBatch: vi.fn(),
		editResearchProjectId: "",
		setEditResearchProjectId: vi.fn(),
		editIsBoardMember: false,
		setEditIsBoardMember: vi.fn(),
		editStatus: "active",
		setEditStatus: vi.fn(),
		editAccessRole: "user",
		setEditAccessRole: vi.fn(),
		editLinkedinUrl: "",
		setEditLinkedinUrl: vi.fn(),
		editLocation: "",
		setEditLocation: vi.fn(),
		editRoleIsExecutive: false,
		isMissingRequiredDepartment: false,
		isPreservingMissingRequiredDepartment: false,
		editIsResearchDepartment: false,
		researchProjectOptions: [],
		editResearchProjectSelectValue: "",
		isEditLinkedinUrlInvalid: false,
		isMemberSaveDisabled: false,
		saveMemberChanges: vi.fn(),
		...overrides,
	} as React.ComponentProps<typeof AdminMemberEditorDialog>;
}

describe("AdminMemberEditorDialog", () => {
	it("is closed when no member is being edited", () => {
		render(
			<AdminMemberEditorDialog {...makeProps({ memberBeingEdited: null })} />,
		);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("opens with the member name in the description", () => {
		render(<AdminMemberEditorDialog {...makeProps()} />);

		expect(
			screen.getByRole("heading", { name: /edit member/i }),
		).toBeInTheDocument();
		expect(screen.getByText(/update alice example/i)).toBeInTheDocument();
	});

	it("forwards LinkedIn edits", async () => {
		const user = userEvent.setup();
		const setEditLinkedinUrl = vi.fn();
		render(<AdminMemberEditorDialog {...makeProps({ setEditLinkedinUrl })} />);

		await user.type(screen.getByLabelText(/linkedin profile url/i), "x");

		expect(setEditLinkedinUrl).toHaveBeenCalledWith("x");
	});

	it("shows a validation hint for an invalid LinkedIn url", () => {
		render(
			<AdminMemberEditorDialog
				{...makeProps({ isEditLinkedinUrlInvalid: true })}
			/>,
		);

		expect(screen.getByText(/use a linkedin profile url/i)).toBeInTheDocument();
	});

	it("toggles the board-member checkbox", async () => {
		const user = userEvent.setup();
		const setEditIsBoardMember = vi.fn();
		render(
			<AdminMemberEditorDialog {...makeProps({ setEditIsBoardMember })} />,
		);

		await user.click(screen.getByLabelText(/board member/i));

		expect(setEditIsBoardMember).toHaveBeenCalledWith(true);
	});

	it("saves changes", async () => {
		const user = userEvent.setup();
		const saveMemberChanges = vi.fn();
		render(<AdminMemberEditorDialog {...makeProps({ saveMemberChanges })} />);

		await user.click(
			screen.getByRole("button", { name: /save member changes/i }),
		);

		expect(saveMemberChanges).toHaveBeenCalledOnce();
	});

	it("disables save when the form is invalid and shows saving copy", () => {
		render(
			<AdminMemberEditorDialog
				{...makeProps({ isMemberSaveDisabled: true, isSavingMember: true })}
			/>,
		);

		expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
	});

	it("shows the research-project picker when the department is research", () => {
		render(
			<AdminMemberEditorDialog
				{...makeProps({
					editIsResearchDepartment: true,
					researchProjectOptions: [
						{ id: "p1", title: "Alpha", description: "", status: "ongoing" },
						// biome-ignore lint/suspicious/noExplicitAny: minimal fixture
					] as any,
				})}
			/>,
		);

		expect(screen.getByLabelText(/research project/i)).toBeInTheDocument();
	});
});
