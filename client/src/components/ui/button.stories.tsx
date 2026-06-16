import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "./button";

const meta = {
	title: "UI/Button",
	component: Button,
	tags: ["autodocs"],
	// These stories are a11y-clean, so opt into enforced a11y checks (the global
	// default is "todo"). See .storybook/preview.tsx for the rationale.
	parameters: { layout: "centered", a11y: { test: "error" } },
	argTypes: {
		variant: {
			control: "select",
			options: [
				"default",
				"secondary",
				"destructive",
				"outline",
				"ghost",
				"link",
			],
		},
		size: {
			control: "select",
			options: ["default", "sm", "lg", "icon"],
		},
		disabled: { control: "boolean" },
	},
	args: {
		children: "Button",
		variant: "default",
		size: "default",
	},
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// Interaction test: clicking the button fires its onClick handler exactly once.
export const ClickFiresHandler: Story = {
	args: { onClick: fn(), children: "Click me" },
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole("button", { name: "Click me" });
		await userEvent.click(button);
		await expect(args.onClick).toHaveBeenCalledTimes(1);
	},
};

// Interaction test: a disabled button does not fire its handler when clicked.
export const DisabledBlocksClick: Story = {
	args: { onClick: fn(), disabled: true, children: "Disabled" },
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole("button", { name: "Disabled" });
		await expect(button).toBeDisabled();
		// The disabled button has `pointer-events: none`; userEvent.click would
		// throw before dispatching. Skip the pointer-events check so the click is
		// attempted — a disabled button still fires no handler.
		await userEvent.click(button, { pointerEventsCheck: 0 });
		await expect(args.onClick).not.toHaveBeenCalled();
	},
};

export const Secondary: Story = {
	args: { variant: "secondary" },
};

export const Destructive: Story = {
	args: { variant: "destructive" },
};

export const Outline: Story = {
	args: { variant: "outline" },
};

export const Ghost: Story = {
	args: { variant: "ghost" },
};

export const Link: Story = {
	args: { variant: "link" },
};

export const WithIcon: Story = {
	args: {
		children: (
			<>
				Continue
				<ArrowRight />
			</>
		),
	},
};

export const AllVariants: Story = {
	render: () => (
		<div className="flex flex-wrap items-center gap-3">
			<Button>Default</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="destructive">Destructive</Button>
			<Button variant="outline">Outline</Button>
			<Button variant="ghost">Ghost</Button>
			<Button variant="link">Link</Button>
		</div>
	),
};

export const Sizes: Story = {
	render: () => (
		<div className="flex flex-wrap items-center gap-3">
			<Button size="sm">Small</Button>
			<Button size="default">Default</Button>
			<Button size="lg">Large</Button>
			<Button size="icon" aria-label="Next">
				<ArrowRight />
			</Button>
		</div>
	),
};
