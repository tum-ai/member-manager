import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckIcon } from "lucide-react";
import { Badge } from "./badge";

const meta = {
	title: "UI/Badge",
	component: Badge,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	argTypes: {
		variant: {
			control: "select",
			options: [
				"default",
				"brand",
				"secondary",
				"destructive",
				"outline",
				"ghost",
				"link",
				"success",
				"warning",
				"danger",
				"info",
				"accent",
				"neutral",
			],
		},
	},
	args: {
		children: "Badge",
		variant: "default",
	},
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Brand: Story = {
	args: { variant: "brand" },
};

export const Secondary: Story = {
	args: { variant: "secondary" },
};

export const Destructive: Story = {
	args: { variant: "destructive" },
};

export const Outline: Story = {
	args: { variant: "outline" },
};

export const Ghost: Story = {
	args: { variant: "ghost" },
};

export const Link: Story = {
	args: { variant: "link" },
};

export const WithIcon: Story = {
	args: {
		variant: "brand",
		children: (
			<>
				<CheckIcon />
				Verified
			</>
		),
	},
};

export const AllVariants: Story = {
	render: () => (
		<div className="flex flex-wrap items-center gap-3">
			<Badge>Default</Badge>
			<Badge variant="brand">Brand</Badge>
			<Badge variant="secondary">Secondary</Badge>
			<Badge variant="destructive">Destructive</Badge>
			<Badge variant="outline">Outline</Badge>
			<Badge variant="ghost">Ghost</Badge>
			<Badge variant="link">Link</Badge>
		</div>
	),
};

export const Tones: Story = {
	render: () => (
		<div className="flex flex-wrap items-center gap-3">
			<Badge variant="success">Success</Badge>
			<Badge variant="warning">Warning</Badge>
			<Badge variant="danger">Danger</Badge>
			<Badge variant="info">Info</Badge>
			<Badge variant="accent">Accent</Badge>
			<Badge variant="neutral">Neutral</Badge>
		</div>
	),
};
