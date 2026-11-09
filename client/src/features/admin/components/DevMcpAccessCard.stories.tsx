import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { devMcpAccessEntry } from "@/test/devMcpAccessFixtures";
import { DevMcpAccessCard } from "./DevMcpAccessCard";

const meta = {
	title: "Admin/Dev MCP Access Card",
	component: DevMcpAccessCard,
	decorators: [
		(Story) => (
			<div className="max-w-md">
				<Story />
			</div>
		),
	],
	args: {
		entry: devMcpAccessEntry(),
		isBusy: false,
		destructiveTools: new Set(["suspend_mailbox"]),
		onApprove: fn(),
		onSetRole: fn(),
		onEditTools: fn(),
		onSuspend: fn(),
		onDeny: fn(),
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof DevMcpAccessCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Requested: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("radio", { name: "Lead" }));
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Approve Ada Lovelace for Dev MCP as lead",
			}),
		);
		await expect(args.onApprove).toHaveBeenCalledWith("lead");
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Deny Dev MCP access for Ada Lovelace",
			}),
		);
		await expect(args.onDeny).toHaveBeenCalledTimes(1);
	},
};

export const Active: Story = {
	args: {
		entry: devMcpAccessEntry({
			status: "active",
			role: "admin",
			tools: ["create_notion_page", "suspend_mailbox", "whoami"],
			decided_at: "2026-11-09T12:00:00Z",
			decided_by_name: "Grace Hopper",
			last_seen_at: "2026-11-09T13:00:00Z",
			last_client_name: "Claude Code",
		}),
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("suspend_mailbox (destructive)"),
		).toBeVisible();
		await userEvent.click(canvas.getByRole("radio", { name: "Lead" }));
		await expect(args.onSetRole).toHaveBeenCalledWith("lead");
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Edit Dev MCP tools for Ada Lovelace",
			}),
		);
		await expect(args.onEditTools).toHaveBeenCalledTimes(1);
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Suspend Dev MCP access for Ada Lovelace",
			}),
		);
		await expect(args.onSuspend).toHaveBeenCalledTimes(1);
	},
};

export const Suspended: Story = {
	args: {
		entry: devMcpAccessEntry({
			status: "suspended",
			decided_at: "2026-11-09T12:00:00Z",
			decision_note: "Left the team",
		}),
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Approve Ada Lovelace for Dev MCP as member",
			}),
		);
		await expect(args.onApprove).toHaveBeenCalledWith("member");
		await expect(canvas.queryByRole("button", { name: /Deny/ })).toBeNull();
	},
};

export const Alumni: Story = {
	args: {
		entry: devMcpAccessEntry({ member_status: "alumni" }),
	},
};

export const Saving: Story = {
	args: { isBusy: true },
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const approve = canvas.getByRole("button", {
			name: "Approve Ada Lovelace for Dev MCP as member",
		});
		await expect(approve).toBeDisabled();
		await userEvent.click(approve, { pointerEventsCheck: 0 });
		await expect(args.onApprove).not.toHaveBeenCalled();
	},
};
