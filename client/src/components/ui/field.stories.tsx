import type { Meta, StoryObj } from "@storybook/react-vite";
import { Field } from "./field";
import { Input } from "./input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";

const meta = {
	title: "UI/Field",
	component: Field,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	argTypes: {
		label: { control: "text" },
		description: { control: "text" },
		error: { control: "text" },
		required: { control: "boolean" },
	},
	args: {
		label: "First name",
		htmlFor: "first-name",
	},
	decorators: [
		(Story) => (
			<div className="w-72">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: (args) => (
		<Field {...args}>
			<Input id="first-name" placeholder="John" />
		</Field>
	),
};

export const Required: Story = {
	args: { required: true },
	render: (args) => (
		<Field {...args}>
			<Input id="first-name" placeholder="John" required />
		</Field>
	),
};

export const WithDescription: Story = {
	args: {
		label: "Email",
		htmlFor: "email",
		description: "Managed by your account login",
	},
	render: (args) => (
		<Field {...args}>
			<Input id="email" type="email" value="ada@tum.ai" disabled readOnly />
		</Field>
	),
};

export const WithError: Story = {
	args: {
		required: true,
		error: "First name is required.",
	},
	render: (args) => (
		<Field {...args}>
			<Input id="first-name" aria-invalid placeholder="John" />
		</Field>
	),
};

export const WithSelect: Story = {
	args: { label: "Salutation", htmlFor: "salutation" },
	render: (args) => (
		<Field {...args}>
			<Select>
				<SelectTrigger id="salutation" className="w-full">
					<SelectValue placeholder="Select..." />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="Mr.">Mr.</SelectItem>
					<SelectItem value="Ms.">Ms.</SelectItem>
					<SelectItem value="Mx.">Mx.</SelectItem>
				</SelectContent>
			</Select>
		</Field>
	),
};
