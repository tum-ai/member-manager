import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { CheckboxCard } from "./checkbox-card";
import { LinkButton } from "./link-button";

const meta = {
	title: "UI/CheckboxCard",
	component: CheckboxCard,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	args: {
		children: "I agree to the membership terms.",
	},
} satisfies Meta<typeof CheckboxCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: (args) => {
		const [checked, setChecked] = useState(false);
		return (
			<div className="max-w-md">
				<CheckboxCard
					{...args}
					checked={checked}
					onCheckedChange={(value) => setChecked(value === true)}
				/>
			</div>
		);
	},
};

export const WithLinkContent: Story = {
	render: () => {
		const [checked, setChecked] = useState(false);
		return (
			<div className="max-w-md">
				<CheckboxCard
					checked={checked}
					onCheckedChange={(value) => setChecked(value === true)}
				>
					I agree to the{" "}
					<LinkButton className="font-medium" onClick={() => {}}>
						Privacy Policy
					</LinkButton>{" "}
					*
				</CheckboxCard>
			</div>
		);
	},
};

export const Checked: Story = {
	args: { checked: true },
	render: (args) => (
		<div className="max-w-md">
			<CheckboxCard {...args} />
		</div>
	),
};

export const Disabled: Story = {
	args: { checked: true, disabled: true },
	render: (args) => (
		<div className="max-w-md">
			<CheckboxCard {...args} />
		</div>
	),
};
