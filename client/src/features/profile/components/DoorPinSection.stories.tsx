import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect, fn, userEvent, within } from "storybook/test";
import { DoorPinSection } from "./DoorPinSection";

const meta = {
	title: "Profile/Door PIN Section",
	component: DoorPinSection,
	decorators: [
		(Story) => (
			<MemoryRouter>
				<Story />
			</MemoryRouter>
		),
	],
	args: {
		doorPin: {
			status: "available",
			pin: "482913",
			updated_at: "2026-10-13T10:00:00Z",
		},
		isLoading: false,
		hasError: false,
		isRevealed: false,
		onToggleRevealed: fn(),
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof DoorPinSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {
	// Hold the reveal state like the profile hook does, so the play function
	// exercises the real Show/Hide round trip.
	render: function AvailableStory(args) {
		const [isRevealed, setIsRevealed] = useState(false);
		return (
			<DoorPinSection
				{...args}
				isRevealed={isRevealed}
				onToggleRevealed={() => {
					args.onToggleRevealed();
					setIsRevealed((current) => !current);
				}}
			/>
		);
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByText("482913")).not.toBeInTheDocument();
		await expect(canvas.getByText("Hidden")).toBeInTheDocument();

		const toggle = canvas.getByRole("button", { name: "Show PIN" });
		await expect(toggle).toHaveAttribute("aria-pressed", "false");
		await userEvent.click(toggle);

		await expect(args.onToggleRevealed).toHaveBeenCalledTimes(1);
		await expect(canvas.getByText("482913")).toBeVisible();
		const hide = canvas.getByRole("button", { name: "Hide PIN" });
		await expect(hide).toHaveAttribute("aria-pressed", "true");

		await userEvent.click(hide);
		await expect(canvas.queryByText("482913")).not.toBeInTheDocument();
	},
};

export const WelcomeRequired: Story = {
	args: { doorPin: { status: "welcome_required" } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("Finish your welcome steps to see your door PIN."),
		).toBeVisible();
		await expect(
			canvas.getByRole("link", { name: "Go to welcome" }),
		).toHaveAttribute("href", "/welcome");
	},
};

export const NotAssigned: Story = {
	args: { doorPin: { status: "not_assigned" } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(/You don't have a door PIN yet/),
		).toBeVisible();
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
	},
};

export const Loading: Story = {
	args: { doorPin: undefined, isLoading: true },
};

export const LoadError: Story = {
	args: { doorPin: undefined, hasError: true },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(/Your door PIN couldn't be loaded/),
		).toBeVisible();
	},
};
