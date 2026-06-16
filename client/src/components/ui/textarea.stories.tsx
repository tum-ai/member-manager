import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "./label";
import { Textarea } from "./textarea";

const meta = {
	title: "UI/Textarea",
	component: Textarea,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	argTypes: {
		placeholder: { control: "text" },
		disabled: { control: "boolean" },
		rows: { control: "number" },
	},
	args: {
		placeholder: "Type your message here...",
	},
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: (args) => <Textarea {...args} className="w-80" />,
};

export const Disabled: Story = {
	render: (args) => <Textarea {...args} className="w-80" disabled />,
};

export const Invalid: Story = {
	render: (args) => (
		<Textarea {...args} className="w-80" aria-invalid defaultValue="Oops" />
	),
};

export const WithLabel: Story = {
	render: (args) => (
		<div className="grid w-80 gap-2">
			<Label htmlFor="message">Your message</Label>
			<Textarea {...args} id="message" />
		</div>
	),
};
