import type { Meta, StoryObj } from "@storybook/react-vite";
import { Info } from "lucide-react";

import { InfoBox } from "./info-box";

const meta = {
	title: "UI/InfoBox",
	component: InfoBox,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	argTypes: {
		variant: {
			control: "select",
			options: ["muted", "card", "brand", "destructive"],
		},
	},
	args: {
		variant: "muted",
		children: "Heads up — this is some contextual information.",
	},
} satisfies Meta<typeof InfoBox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Muted: Story = {};

export const Card: Story = {
	args: { variant: "card" },
};

export const Brand: Story = {
	args: { variant: "brand" },
};

export const Destructive: Story = {
	args: {
		variant: "destructive",
		className: "text-sm text-destructive",
		children: "Something went wrong. Please try again.",
	},
};

export const WithIcon: Story = {
	args: {
		variant: "brand",
		className: "flex items-center gap-3",
		children: (
			<>
				<Info className="size-4 shrink-0 text-brand" />
				<span>You can edit these details until the deadline.</span>
			</>
		),
	},
};

export const AllVariants: Story = {
	render: () => (
		<div className="flex max-w-md flex-col gap-3">
			<InfoBox variant="muted">Muted — neutral background note.</InfoBox>
			<InfoBox variant="card">Card — sits on the page surface.</InfoBox>
			<InfoBox variant="brand">Brand — highlights a key hint.</InfoBox>
			<InfoBox variant="destructive">Destructive — error or warning.</InfoBox>
		</div>
	),
};
