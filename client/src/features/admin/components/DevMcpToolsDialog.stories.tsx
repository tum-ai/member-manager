import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import {
	DEV_MCP_CATALOG,
	devMcpAccessEntry,
} from "@/test/devMcpAccessFixtures";
import { DevMcpToolsDialog } from "./DevMcpToolsDialog";

const meta = {
	title: "Admin/Dev MCP Tools Dialog",
	component: DevMcpToolsDialog,
	args: {
		entry: devMcpAccessEntry({
			status: "active",
			role: "lead",
			tools: ["whoami", "create_mailbox"],
		}),
		catalog: DEV_MCP_CATALOG,
		onCancel: fn(),
		onSave: fn(),
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof DevMcpToolsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Lead: Story = {
	play: async ({ args }) => {
		// The dialog renders in a portal outside the canvas.
		const dialog = await screen.findByRole("dialog", {
			name: "Dev MCP tools for Ada Lovelace",
		});
		const dialogScope = within(dialog);
		// A lead isn't offered admin-only tools.
		await expect(dialogScope.getAllByRole("checkbox")).toHaveLength(4);
		await userEvent.click(dialogScope.getByLabelText("Create a mailbox"));
		await userEvent.click(dialogScope.getByLabelText("Invite to GitHub"));
		await userEvent.click(
			dialogScope.getByRole("button", { name: "Save tools" }),
		);
		await expect(args.onSave).toHaveBeenCalledWith([
			"add_to_github_org",
			"whoami",
		]);
	},
};

export const AdminWithDestructiveTool: Story = {
	args: {
		entry: devMcpAccessEntry({
			status: "active",
			role: "admin",
			tools: ["suspend_mailbox"],
		}),
	},
	play: async () => {
		const dialog = await screen.findByRole("dialog");
		await expect(within(dialog).getByText("Destructive")).toBeVisible();
	},
};

export const CatalogUnavailable: Story = {
	args: { catalog: [] },
	play: async ({ args }) => {
		const dialog = await screen.findByRole("dialog");
		const save = within(dialog).getByRole("button", { name: "Save tools" });
		await expect(save).toBeDisabled();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Cancel" }),
		);
		await expect(args.onCancel).toHaveBeenCalledTimes(1);
	},
};
