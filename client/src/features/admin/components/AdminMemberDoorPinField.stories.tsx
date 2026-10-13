import type { MemberDoorPin } from "@member-manager/shared";
import { doorPinSchema } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { AdminMemberDoorPinField } from "./AdminMemberDoorPinField";

const meta = {
	title: "Admin/Member Door PIN Field",
	component: AdminMemberDoorPinField,
	args: {
		doorPin: undefined,
		isRevealed: false,
		isLoadingPin: false,
		hasLoadError: false,
		toggleRevealed: fn(),
		draftPin: "",
		setDraftPin: fn(),
		draftError: null,
		canSavePin: false,
		isSavingPin: false,
		savePin: fn(),
		isConfirmingClear: false,
		requestClear: fn(),
		cancelClear: fn(),
		clearPin: fn(),
		isClearingPin: false,
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof AdminMemberDoorPinField>;

export default meta;
type Story = StoryObj<typeof meta>;

const STORED: MemberDoorPin = {
	status: "available",
	pin: "482913",
	updated_at: "2026-10-13T10:00:00Z",
};

/** Holds the field's state the way useAdminMemberDoorPin does. */
export const Interactive: Story = {
	render: function InteractiveStory(args) {
		const [isRevealed, setIsRevealed] = useState(false);
		const [draftPin, setDraftPin] = useState("");
		const parsed = doorPinSchema.safeParse(draftPin);
		return (
			<AdminMemberDoorPinField
				{...args}
				isRevealed={isRevealed}
				doorPin={isRevealed ? STORED : undefined}
				toggleRevealed={() => setIsRevealed((current) => !current)}
				draftPin={draftPin}
				setDraftPin={setDraftPin}
				draftError={
					draftPin && !parsed.success
						? (parsed.error.issues[0]?.message ?? null)
						: null
				}
				canSavePin={parsed.success}
			/>
		);
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByText("482913")).not.toBeInTheDocument();

		await userEvent.click(
			canvas.getByRole("button", { name: "Show current PIN" }),
		);
		await expect(canvas.getByText("482913")).toBeVisible();

		const input = canvas.getByLabelText("New PIN");
		const save = canvas.getByRole("button", { name: "Save PIN" });
		await userEvent.type(input, "12a");
		await expect(
			canvas.getByText("A door PIN has 4 to 10 digits"),
		).toBeVisible();
		await expect(save).toBeDisabled();

		await userEvent.clear(input);
		await userEvent.type(input, "135790");
		await expect(save).toBeEnabled();
		await userEvent.click(save);
		await expect(args.savePin).toHaveBeenCalledOnce();
	},
};

export const NoPinAssigned: Story = {
	args: { isRevealed: true, doorPin: { status: "not_assigned" } },
};

export const ConfirmClear: Story = {
	args: { isConfirmingClear: true },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Clear PIN" }));
		await expect(args.clearPin).toHaveBeenCalledOnce();
	},
};
