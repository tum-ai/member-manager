import type { Meta, StoryObj } from "@storybook/react-vite";

import GlassCard from "./GlassCard";

const meta = {
	title: "UI/GlassCard",
	component: GlassCard,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	argTypes: {
		variant: {
			control: "select",
			options: ["default", "elevated", "interactive"],
		},
	},
	args: {
		variant: "default",
		className: "max-w-sm p-6",
		children: (
			<>
				<h3 className="font-semibold">Card title</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					A clean, solid surface used across the app as a content container.
				</p>
			</>
		),
	},
} satisfies Meta<typeof GlassCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Elevated: Story = {
	args: { variant: "elevated" },
};

export const Interactive: Story = {
	args: { variant: "interactive" },
};

export const AllVariants: Story = {
	render: () => (
		<div className="flex flex-wrap gap-4">
			<GlassCard className="w-56 p-6">
				<p className="font-medium">Default</p>
			</GlassCard>
			<GlassCard variant="elevated" className="w-56 p-6">
				<p className="font-medium">Elevated</p>
			</GlassCard>
			<GlassCard variant="interactive" className="w-56 p-6">
				<p className="font-medium">Interactive</p>
			</GlassCard>
		</div>
	),
};
