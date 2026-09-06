import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ClaimRow } from "./ClaimRow";

const meta = {
	title: "Expertise/Claim Row",
	component: ClaimRow,
	args: {
		title: "Swift",
		subtitle: "Advanced",
		status: "pending",
		confidence: 0.72,
		source: {
			id: "11111111-1111-4111-8111-111111111111",
			kind: "linkedin",
			url: null,
			title: "LinkedIn",
			identity_confirmed: true,
		},
		editable: true,
		onConfirm: fn(),
		onReject: fn(),
		onEdit: fn(),
		onDelete: fn(),
	},
	parameters: { layout: "padded", a11y: { test: "error" } },
} satisfies Meta<typeof ClaimRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnverifiedClaim: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Unverified")).toBeVisible();
		await userEvent.click(canvas.getByRole("button", { name: "Confirm" }));
		await expect(args.onConfirm).toHaveBeenCalled();
	},
};
