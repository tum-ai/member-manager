import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { mcpAccessEntry } from "@/test/mcpAccessFixtures";
import { McpAccessCard } from "./McpAccessCard";

const meta = {
	title: "Admin/Notion MCP Access Card",
	component: McpAccessCard,
	decorators: [
		(Story) => (
			<div className="max-w-md">
				<Story />
			</div>
		),
	],
	args: {
		entry: mcpAccessEntry(),
		isBusy: false,
		onApprove: fn(),
		onSetRole: fn(),
		onDeny: fn(),
		onRevoke: fn(),
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof McpAccessCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("radio", { name: "Reader" }));
		await userEvent.click(
			canvas.getByRole("button", { name: "Approve Ada Lovelace as reader" }),
		);
		await expect(args.onApprove).toHaveBeenCalledWith("reader");
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Deny Notion MCP access for Ada Lovelace",
			}),
		);
		await expect(args.onDeny).toHaveBeenCalledTimes(1);
	},
};

export const Approved: Story = {
	args: {
		entry: mcpAccessEntry({
			status: "approved",
			role: "editor",
			decided_at: "2026-11-02T12:00:00Z",
			decided_by_name: "Grace Hopper",
		}),
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("radio", { name: "Reader" }));
		await expect(args.onSetRole).toHaveBeenCalledWith("reader");
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Revoke Notion MCP access for Ada Lovelace",
			}),
		);
		await expect(args.onRevoke).toHaveBeenCalledTimes(1);
	},
};

export const Declined: Story = {
	args: {
		entry: mcpAccessEntry({
			status: "denied",
			decided_at: "2026-11-02T12:00:00Z",
			decided_by_name: "Grace Hopper",
			decision_note: "Not in a project yet",
		}),
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Approve Ada Lovelace as editor" }),
		);
		await expect(args.onApprove).toHaveBeenCalledWith("editor");
	},
};

export const Alumni: Story = {
	args: {
		entry: mcpAccessEntry({ member_status: "alumni", last_seen_at: null }),
	},
};

export const Saving: Story = {
	args: { isBusy: true },
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const approve = canvas.getByRole("button", {
			name: "Approve Ada Lovelace as editor",
		});
		await expect(approve).toBeDisabled();
		await userEvent.click(approve, { pointerEventsCheck: 0 });
		await expect(args.onApprove).not.toHaveBeenCalled();
	},
};
