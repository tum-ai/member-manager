import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Label } from "./label";
import { Switch } from "./switch";

const meta = {
	title: "UI/Switch",
	component: Switch,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	argTypes: {
		size: { control: "select", options: ["default", "sm"] },
		disabled: { control: "boolean" },
	},
	args: {
		size: "default",
	},
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
	args: { defaultChecked: true },
};

export const Disabled: Story = {
	args: { disabled: true },
};

export const Small: Story = {
	args: { size: "sm", defaultChecked: true },
};

export const Sizes: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			<Switch size="sm" defaultChecked />
			<Switch size="default" defaultChecked />
		</div>
	),
};

export const WithLabel: Story = {
	render: () => (
		<Label htmlFor="airplane">
			<Switch id="airplane" />
			Airplane mode
		</Label>
	),
};

export const Controlled: Story = {
	render: () => {
		const [checked, setChecked] = useState(true);
		return (
			<Label htmlFor="notifications">
				<Switch
					id="notifications"
					checked={checked}
					onCheckedChange={setChecked}
				/>
				{checked ? "On" : "Off"}
			</Label>
		);
	},
};
