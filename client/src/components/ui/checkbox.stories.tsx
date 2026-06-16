import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

const meta = {
	title: "UI/Checkbox",
	component: Checkbox,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	argTypes: {
		disabled: { control: "boolean" },
	},
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
	args: { defaultChecked: true },
};

export const Disabled: Story = {
	args: { disabled: true },
};

export const DisabledChecked: Story = {
	args: { disabled: true, defaultChecked: true },
};

export const WithLabel: Story = {
	render: () => (
		<Label htmlFor="newsletter">
			<Checkbox id="newsletter" defaultChecked />
			Subscribe to the newsletter
		</Label>
	),
};

export const Controlled: Story = {
	render: () => {
		const [checked, setChecked] = useState(false);
		return (
			<Label htmlFor="controlled">
				<Checkbox
					id="controlled"
					checked={checked}
					onCheckedChange={(value) => setChecked(value === true)}
				/>
				{checked ? "Enabled" : "Disabled"}
			</Label>
		);
	},
};
