import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "./spinner";

const meta = {
	title: "UI/Spinner",
	component: Spinner,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			<Spinner className="size-4" />
			<Spinner className="size-6" />
			<Spinner className="size-8" />
		</div>
	),
};

export const WithLabel: Story = {
	render: () => (
		<div className="flex items-center gap-2 text-sm text-muted-foreground">
			<Spinner />
			Loading...
		</div>
	),
};
