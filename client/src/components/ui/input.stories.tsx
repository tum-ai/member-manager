import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
	title: "UI/Input",
	component: Input,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	argTypes: {
		type: {
			control: "select",
			options: ["text", "email", "password", "number", "search", "file"],
		},
		placeholder: { control: "text" },
		disabled: { control: "boolean" },
	},
	args: {
		type: "text",
		placeholder: "Enter text...",
	},
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Email: Story = {
	args: { type: "email", placeholder: "name@example.com" },
};

export const Password: Story = {
	args: { type: "password", placeholder: "Password" },
};

export const Disabled: Story = {
	args: { disabled: true, placeholder: "Disabled" },
};

export const Invalid: Story = {
	args: { "aria-invalid": true, defaultValue: "Invalid value" },
};

export const File: Story = {
	args: { type: "file" },
};

export const WithLabel: Story = {
	render: (args) => (
		<div className="grid w-72 gap-2">
			<Label htmlFor="email">Email</Label>
			<Input {...args} id="email" type="email" placeholder="name@example.com" />
		</div>
	),
};
