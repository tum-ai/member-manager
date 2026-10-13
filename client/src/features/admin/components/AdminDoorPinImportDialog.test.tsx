import type { DoorPinImportResult } from "@member-manager/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AdminDoorPinImportState } from "@/features/admin/hooks/useAdminDoorPinImport";
import { AdminDoorPinImportDialog } from "./AdminDoorPinImportDialog";

const preview: DoorPinImportResult = {
	dry_run: true,
	total: 5,
	matched: 2,
	created: 1,
	updated: 1,
	unchanged: 0,
	unmatched: [
		{ row_number: 11, email: "stranger@example.com", name: "Some One" },
	],
	rejected: [
		{
			row_number: 12,
			email: "twice@example.com",
			name: "",
			reason: "duplicate_pin",
		},
	],
	members_without_pin: [
		{ user_id: "u-9", name: "Grace Hopper", email: "grace@example.com" },
	],
};

function makeState(
	overrides: Partial<AdminDoorPinImportState> = {},
): AdminDoorPinImportState {
	return {
		isOpen: true,
		openDialog: vi.fn(),
		closeDialog: vi.fn(),
		step: "select",
		fileName: "",
		selectFile: vi.fn(),
		isReadingFile: false,
		isApplying: false,
		fileError: null,
		skipped: [],
		result: null,
		pendingChanges: 0,
		applyImport: vi.fn(),
		...overrides,
	};
}

describe("AdminDoorPinImportDialog", () => {
	it("asks for the cabinet sheet and can't apply yet", async () => {
		const user = userEvent.setup();
		const selectFile = vi.fn();
		render(<AdminDoorPinImportDialog {...makeState({ selectFile })} />);

		expect(
			screen.getByRole("dialog", { name: "Import door PINs" }),
		).toBeVisible();
		expect(screen.getByRole("button", { name: "Apply 0 PINs" })).toBeDisabled();

		const sheet = new File(["xlsx"], "traka.xlsx");
		await user.upload(screen.getByLabelText("Traka21 sheet"), sheet);
		expect(selectFile).toHaveBeenCalledWith(sheet);
	});

	it("shows progress while reading and the reason a file was refused", () => {
		const { rerender } = render(
			<AdminDoorPinImportDialog
				{...makeState({ isReadingFile: true, fileName: "traka.xlsx" })}
			/>,
		);
		expect(screen.getByText(/Reading traka\.xlsx/)).toBeVisible();
		expect(screen.getByLabelText("Traka21 sheet")).toBeDisabled();

		rerender(
			<AdminDoorPinImportDialog
				{...makeState({ fileError: "This doesn't look like the sheet." })}
			/>,
		);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"This doesn't look like the sheet.",
		);
	});

	it("previews the counts and the rows that need attention, then applies", async () => {
		const user = userEvent.setup();
		const applyImport = vi.fn();
		render(
			<AdminDoorPinImportDialog
				{...makeState({
					step: "preview",
					result: preview,
					pendingChanges: 2,
					applyImport,
					skipped: [
						{
							row_number: 9,
							email: "it@example.com",
							name: "admin tum.ai",
							reason: "cabinet_admin",
						},
					],
				})}
			/>,
		);

		expect(screen.getByText("Will be added").nextSibling).toHaveTextContent(
			"1",
		);
		expect(screen.getByText("Will be changed").nextSibling).toHaveTextContent(
			"1",
		);
		expect(screen.getByText("Not imported").nextSibling).toHaveTextContent("2");

		const unmatched = screen
			.getByText("No member account with this email (1)")
			.closest("details");
		expect(unmatched).not.toBeNull();
		await user.click(screen.getByText("No member account with this email (1)"));
		expect(
			within(unmatched as HTMLElement).getByText("stranger@example.com"),
		).toBeVisible();
		expect(screen.getByText("Rejected rows (1)")).toBeInTheDocument();
		expect(screen.getByText("Skipped in the sheet (1)")).toBeInTheDocument();
		expect(
			screen.getByText("Active members still without a PIN (1)"),
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Apply 2 PINs" }));
		expect(applyImport).toHaveBeenCalledOnce();
	});

	it("confirms the import and only offers to close", async () => {
		const user = userEvent.setup();
		const closeDialog = vi.fn();
		render(
			<AdminDoorPinImportDialog
				{...makeState({
					step: "done",
					result: { ...preview, dry_run: false },
					closeDialog,
				})}
			/>,
		);

		expect(screen.getByRole("status")).toHaveTextContent("Imported.");
		expect(screen.getByText("Were added")).toBeVisible();
		expect(screen.queryByLabelText("Traka21 sheet")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Done" }));
		expect(closeDialog).toHaveBeenCalled();
	});

	it("labels a single pending change", () => {
		render(
			<AdminDoorPinImportDialog
				{...makeState({
					step: "preview",
					result: preview,
					pendingChanges: 1,
					isApplying: false,
				})}
			/>,
		);
		expect(screen.getByRole("button", { name: "Apply 1 PIN" })).toBeEnabled();
	});
});
