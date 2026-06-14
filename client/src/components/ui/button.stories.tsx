import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight } from "lucide-react";
import { Button } from "./button";

const meta = {
	title: "UI/Button",
	component: Button,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
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
