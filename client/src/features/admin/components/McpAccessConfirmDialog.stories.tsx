import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import { mcpAccessEntry } from "@/test/mcpAccessFixtures";
import { McpAccessConfirmDialog } from "./McpAccessConfirmDialog";

const meta = {
	title: "Admin/Notion MCP Access Confirm Dialog",
	component: McpAccessConfirmDialog,
	args: {
		confirmation: { entry: mcpAccessEntry(), action: "deny" },
		onCancel: fn(),
		onConfirm: fn(),
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof McpAccessConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Deny: Story = {
	play: async ({ args }) => {
		// The dialog renders in a portal outside the canvas.
		const dialog = await screen.findByRole("dialog", {
			name: "Deny Ada Lovelace's request?",
		});
		await userEvent.type(
			within(dialog).getByLabelText("Note for admins (optional)"),
			"Not in a project yet",
		);
		await userEvent.click(within(dialog).getByRole("button", { name: "Deny" }));
		await expect(args.onConfirm).toHaveBeenCalledWith("Not in a project yet");
	},
};

export const Revoke: Story = {
	args: {
		confirmation: {
			entry: mcpAccessEntry({ status: "approved", role: "editor" }),
			action: "revoke",
		},
	},
	play: async ({ args }) => {
		const dialog = await screen.findByRole("dialog", {
			name: "Revoke Ada Lovelace's Notion MCP access?",
		});
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Cancel" }),
		);
		await expect(args.onCancel).toHaveBeenCalledTimes(1);
	},
};
