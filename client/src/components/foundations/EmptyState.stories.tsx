import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inbox } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";

const handleCreateRequest = fn();

const meta = {
	title: "Foundations/EmptyState",
	component: EmptyState,
	tags: ["autodocs"],
	parameters: { layout: "padded", a11y: { test: "error" } },
	args: {
		icon: Inbox,
		title: "No requests yet",
		description: "When a member submits a request, it shows up here.",
	},
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutIcon: Story = {
	args: { icon: undefined },
};

export const WithAction: Story = {
	args: {
		action: <Button size="sm">Create request</Button>,
	},
};

export const DarkMode: Story = {
	...WithAction,
	globals: { theme: "dark" },
};

export const ActionIsClickable: Story = {
	args: {
		action: (
			<Button size="sm" onClick={handleCreateRequest}>
				Create request
			</Button>
		),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole("button", { name: "Create request" });
		await userEvent.tab();
		await expect(button).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect(handleCreateRequest).toHaveBeenCalled();
	},
};
