import type { DoorPinImportResult } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { AdminDoorPinImportDialog } from "./AdminDoorPinImportDialog";

const preview: DoorPinImportResult = {
	dry_run: true,
	total: 276,
	matched: 270,
	created: 268,
	updated: 2,
	unchanged: 0,
	unmatched: [
		{ row_number: 41, email: "ada.l@gmail.com", name: "Ada Lovelace" },
		{ row_number: 87, email: "grace@example.org", name: "Grace Hopper" },
	],
	rejected: [
		{
			row_number: 120,
			email: "alan@example.com",
			name: "Alan Turing",
			reason: "pin_in_use",
		},
	],
	members_without_pin: [
		{ user_id: "u-1", name: "Nora Newjoiner", email: "nora@example.com" },
	],
};

const meta = {
	title: "Admin/Door PIN Import Dialog",
	component: AdminDoorPinImportDialog,
	args: {
		isOpen: true,
		openDialog: fn(),
		closeDialog: fn(),
		step: "select",
		fileName: "",
		selectFile: fn(),
		isReadingFile: false,
		isApplying: false,
		fileError: null,
		skipped: [],
		result: null,
		pendingChanges: 0,
		applyImport: fn(),
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof AdminDoorPinImportDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// The dialog renders in a portal outside the story canvas.
async function findDialog(canvasElement: HTMLElement) {
	return within(
		await within(canvasElement.ownerDocument.body).findByRole("dialog", {
			name: "Import door PINs",
		}),
	);
}

export const SelectFile: Story = {
	play: async ({ canvasElement }) => {
		const dialog = await findDialog(canvasElement);
		await expect(dialog.getByLabelText("Traka21 sheet")).toBeEnabled();
		await expect(
			dialog.getByRole("button", { name: "Apply 0 PINs" }),
		).toBeDisabled();
	},
};

export const Preview: Story = {
	args: {
		step: "preview",
		fileName: "traka.xlsx",
		result: preview,
		pendingChanges: 270,
		skipped: [
			{
				row_number: 9,
				email: "it@example.com",
				name: "admin tum.ai",
				reason: "cabinet_admin",
			},
		],
	},
	play: async ({ args, canvasElement }) => {
		const dialog = await findDialog(canvasElement);
		await userEvent.click(
			dialog.getByText("No member account with this email (2)"),
		);
		await expect(dialog.getByText("ada.l@gmail.com")).toBeVisible();
		await userEvent.click(
			dialog.getByRole("button", { name: "Apply 270 PINs" }),
		);
		await expect(args.applyImport).toHaveBeenCalledOnce();
	},
};

export const ReadingFile: Story = {
	args: { isReadingFile: true, fileName: "traka.xlsx" },
};

export const NotACabinetSheet: Story = {
	args: {
		fileError:
			"This doesn't look like the Traka21 user sheet: no header row with Kontakt and PIN columns.",
	},
};

export const Done: Story = {
	args: {
		step: "done",
		result: { ...preview, dry_run: false },
		pendingChanges: 270,
	},
	play: async ({ args, canvasElement }) => {
		const dialog = await findDialog(canvasElement);
		await expect(dialog.getByText("Were added")).toBeVisible();
		await userEvent.click(dialog.getByRole("button", { name: "Done" }));
		await expect(args.closeDialog).toHaveBeenCalled();
	},
};
