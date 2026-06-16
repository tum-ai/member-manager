import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Label } from "./label";
import { RadioGroup, RadioGroupItem } from "./radio-group";

const meta = {
	title: "UI/RadioGroup",
	component: RadioGroup,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof RadioGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<RadioGroup defaultValue="comfortable">
			<Label htmlFor="r1">
				<RadioGroupItem value="default" id="r1" />
				Default
			</Label>
			<Label htmlFor="r2">
				<RadioGroupItem value="comfortable" id="r2" />
				Comfortable
			</Label>
			<Label htmlFor="r3">
				<RadioGroupItem value="compact" id="r3" />
				Compact
			</Label>
		</RadioGroup>
	),
};

export const Disabled: Story = {
	render: () => (
		<RadioGroup defaultValue="one" disabled>
			<Label htmlFor="d1">
				<RadioGroupItem value="one" id="d1" />
				Option one
			</Label>
			<Label htmlFor="d2">
				<RadioGroupItem value="two" id="d2" />
				Option two
			</Label>
		</RadioGroup>
	),
};

export const Controlled: Story = {
	render: () => {
		const [value, setValue] = useState("light");
		return (
			<div className="grid gap-3">
				<RadioGroup value={value} onValueChange={setValue}>
					<Label htmlFor="c1">
						<RadioGroupItem value="light" id="c1" />
						Light
					</Label>
					<Label htmlFor="c2">
						<RadioGroupItem value="dark" id="c2" />
						Dark
					</Label>
					<Label htmlFor="c3">
						<RadioGroupItem value="system" id="c3" />
						System
					</Label>
				</RadioGroup>
				<p className="text-sm text-muted-foreground">Selected: {value}</p>
			</div>
		);
	},
};
