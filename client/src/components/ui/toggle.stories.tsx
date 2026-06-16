import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bold, Italic, Underline } from "lucide-react";
import { Toggle } from "./toggle";

const meta = {
	title: "UI/Toggle",
	component: Toggle,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	argTypes: {
		variant: { control: "select", options: ["default", "outline"] },
		size: { control: "select", options: ["default", "sm", "lg"] },
		disabled: { control: "boolean" },
	},
	args: {
		variant: "default",
		size: "default",
		children: "Toggle",
	},
} satisfies Meta<typeof Toggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = {
	args: { variant: "outline" },
};

export const Pressed: Story = {
	args: { defaultPressed: true },
};

export const Disabled: Story = {
	args: { disabled: true },
};

export const WithIcon: Story = {
	args: {
		"aria-label": "Toggle bold",
		children: <Bold />,
	},
};

export const Sizes: Story = {
	render: () => (
		<div className="flex items-center gap-3">
			<Toggle size="sm" aria-label="Bold">
				<Bold />
			</Toggle>
			<Toggle size="default" aria-label="Italic">
				<Italic />
			</Toggle>
			<Toggle size="lg" aria-label="Underline">
				<Underline />
			</Toggle>
		</div>
	),
};

export const AllVariants: Story = {
	render: () => (
		<div className="flex items-center gap-3">
			<Toggle aria-label="Italic">
				<Italic />
			</Toggle>
			<Toggle variant="outline" aria-label="Italic">
				<Italic />
			</Toggle>
		</div>
	),
};
