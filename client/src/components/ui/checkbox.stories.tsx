import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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
	// The bare control stories below render a Checkbox with no associated label,
	// so give them an accessible name to satisfy the button-name a11y rule.
	// Stories that pair the checkbox with a <Label> override this with their own
	// render and don't need it.
	args: {
		"aria-label": "Example checkbox",
	},
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// Interaction test: clicking toggles the checkbox between checked/unchecked.
export const TogglesOnClick: Story = {
	render: () => (
		<Label htmlFor="terms">
			<Checkbox id="terms" />
			Accept terms
		</Label>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const checkbox = canvas.getByRole("checkbox", { name: "Accept terms" });
		await expect(checkbox).not.toBeChecked();
		await userEvent.click(checkbox);
		await expect(checkbox).toBeChecked();
		await userEvent.click(checkbox);
		await expect(checkbox).not.toBeChecked();
	},
};

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
