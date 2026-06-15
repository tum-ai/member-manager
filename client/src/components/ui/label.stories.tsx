import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
	title: "UI/Label",
	component: Label,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: {
		children: "Label",
	},
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithInput: Story = {
	render: () => (
		<div className="grid w-72 gap-2">
			<Label htmlFor="name">Full name</Label>
			<Input id="name" placeholder="Jane Doe" />
		</div>
	),
};

export const WithCheckbox: Story = {
	render: () => (
		<Label htmlFor="terms">
			<Checkbox id="terms" />
			Accept terms and conditions
		</Label>
	),
};
