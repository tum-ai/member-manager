import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import { devMcpAccessEntry } from "@/test/devMcpAccessFixtures";
import { DevMcpAccessConfirmDialog } from "./DevMcpAccessConfirmDialog";

const meta = {
	title: "Admin/Dev MCP Access Confirm Dialog",
	component: DevMcpAccessConfirmDialog,
	args: {
		confirmation: {
			entry: devMcpAccessEntry({ status: "active", role: "lead" }),
			action: "suspend",
		},
		onCancel: fn(),
		onConfirm: fn(),
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof DevMcpAccessConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Suspend: Story = {
	play: async ({ args }) => {
		// The dialog renders in a portal outside the canvas.
		const dialog = await screen.findByRole("dialog", {
			name: "Suspend Ada Lovelace's Dev MCP access?",
		});
		await userEvent.type(
			within(dialog).getByLabelText("Note for admins (optional)"),
			"Left the team",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Suspend" }),
		);
		await expect(args.onConfirm).toHaveBeenCalledWith("Left the team");
	},
};

export const Deny: Story = {
	args: {
		confirmation: { entry: devMcpAccessEntry(), action: "deny" },
	},
	play: async ({ args }) => {
		const dialog = await screen.findByRole("dialog", {
			name: "Deny Ada Lovelace's Dev MCP request?",
		});
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Cancel" }),
		);
		await expect(args.onCancel).toHaveBeenCalledTimes(1);
	},
};
