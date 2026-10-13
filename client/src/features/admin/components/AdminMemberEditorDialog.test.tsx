import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AdminMember } from "@/features/admin/adminUtils";
import type { AdminMemberDoorPinState } from "@/features/admin/hooks/useAdminMemberDoorPin";
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
		doorPin: makeDoorPinState(),
		...overrides,
	} as React.ComponentProps<typeof AdminMemberEditorDialog>;
}

function makeDoorPinState(
	overrides: Partial<AdminMemberDoorPinState> = {},
): AdminMemberDoorPinState {
	return {
		doorPin: undefined,
		isRevealed: false,
		isLoadingPin: false,
		hasLoadError: false,
		toggleRevealed: vi.fn(),
		draftPin: "",
		setDraftPin: vi.fn(),
		draftError: null,
		canSavePin: false,
		isSavingPin: false,
		savePin: vi.fn(),
		isConfirmingClear: false,
		requestClear: vi.fn(),
		cancelClear: vi.fn(),
		clearPin: vi.fn(),
		isClearingPin: false,
		...overrides,
	};
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

	describe("door PIN", () => {
		it("keeps the PIN hidden until asked and shows it when revealed", async () => {
			const user = userEvent.setup();
			const toggleRevealed = vi.fn();
			const { rerender } = render(
				<AdminMemberEditorDialog
					{...makeProps({ doorPin: makeDoorPinState({ toggleRevealed }) })}
				/>,
			);

			expect(screen.getByRole("heading", { name: "Door PIN" })).toBeVisible();
			await user.click(
				screen.getByRole("button", { name: "Show current PIN" }),
			);
			expect(toggleRevealed).toHaveBeenCalledOnce();

			rerender(
				<AdminMemberEditorDialog
					{...makeProps({
						doorPin: makeDoorPinState({
							isRevealed: true,
							doorPin: {
								status: "available",
								pin: "482913",
								updated_at: "2026-10-13T10:00:00Z",
							},
						}),
					})}
				/>,
			);
			expect(screen.getByText("482913")).toBeVisible();
			expect(
				screen.getByRole("button", { name: "Hide current PIN" }),
			).toHaveAttribute("aria-pressed", "true");
		});

		it("says when a member has no PIN, or it failed to load", () => {
			const { rerender } = render(
				<AdminMemberEditorDialog
					{...makeProps({
						doorPin: makeDoorPinState({
							isRevealed: true,
							doorPin: { status: "not_assigned" },
						}),
					})}
				/>,
			);
			expect(screen.getByText("No PIN assigned.")).toBeVisible();

			rerender(
				<AdminMemberEditorDialog
					{...makeProps({
						doorPin: makeDoorPinState({ isRevealed: true, hasLoadError: true }),
					})}
				/>,
			);
			expect(screen.getByText("The PIN couldn't be loaded.")).toBeVisible();

			rerender(
				<AdminMemberEditorDialog
					{...makeProps({
						doorPin: makeDoorPinState({ isRevealed: true, isLoadingPin: true }),
					})}
				/>,
			);
			expect(screen.getByText("Loading…")).toBeVisible();
		});

		it("types, validates and saves a new PIN", async () => {
			const user = userEvent.setup();
			const setDraftPin = vi.fn();
			const savePin = vi.fn();
			const { rerender } = render(
				<AdminMemberEditorDialog
					{...makeProps({ doorPin: makeDoorPinState({ setDraftPin }) })}
				/>,
			);

			await user.type(screen.getByLabelText("New PIN"), "4");
			expect(setDraftPin).toHaveBeenCalledWith("4");
			expect(screen.getByRole("button", { name: "Save PIN" })).toBeDisabled();

			rerender(
				<AdminMemberEditorDialog
					{...makeProps({
						doorPin: makeDoorPinState({
							draftPin: "12a",
							draftError: "A door PIN has 4 to 10 digits",
						}),
					})}
				/>,
			);
			expect(screen.getByLabelText("New PIN")).toHaveAttribute(
				"aria-invalid",
				"true",
			);
			expect(screen.getByText("A door PIN has 4 to 10 digits")).toBeVisible();

			rerender(
				<AdminMemberEditorDialog
					{...makeProps({
						doorPin: makeDoorPinState({
							draftPin: "482913",
							canSavePin: true,
							savePin,
						}),
					})}
				/>,
			);
			await user.click(screen.getByRole("button", { name: "Save PIN" }));
			await user.type(screen.getByLabelText("New PIN"), "{Enter}");
			expect(savePin).toHaveBeenCalledTimes(2);
		});

		it("asks before clearing the PIN", async () => {
			const user = userEvent.setup();
			const requestClear = vi.fn();
			const clearPin = vi.fn();
			const cancelClear = vi.fn();
			const { rerender } = render(
				<AdminMemberEditorDialog
					{...makeProps({ doorPin: makeDoorPinState({ requestClear }) })}
				/>,
			);

			await user.click(screen.getByRole("button", { name: "Clear PIN" }));
			expect(requestClear).toHaveBeenCalledOnce();

			rerender(
				<AdminMemberEditorDialog
					{...makeProps({
						doorPin: makeDoorPinState({
							isConfirmingClear: true,
							clearPin,
							cancelClear,
						}),
					})}
				/>,
			);
			expect(screen.getByText(/Clear this member's door PIN\?/)).toBeVisible();
			await user.click(screen.getByRole("button", { name: "Keep PIN" }));
			await user.click(screen.getByRole("button", { name: "Clear PIN" }));
			expect(cancelClear).toHaveBeenCalledOnce();
			expect(clearPin).toHaveBeenCalledOnce();
		});
	});
});
