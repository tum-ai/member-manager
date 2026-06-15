import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "./separator";

const meta = {
	title: "UI/Separator",
	component: Separator,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	argTypes: {
		orientation: { control: "select", options: ["horizontal", "vertical"] },
	},
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
	render: () => (
		<div className="w-64">
			<div className="space-y-1">
				<h4 className="text-sm font-medium leading-none">Radix Primitives</h4>
				<p className="text-sm text-muted-foreground">
					An open-source UI component library.
				</p>
			</div>
			<Separator className="my-4" />
			<div className="flex h-5 items-center gap-4 text-sm">
				<span>Blog</span>
				<Separator orientation="vertical" />
				<span>Docs</span>
				<Separator orientation="vertical" />
				<span>Source</span>
			</div>
		</div>
	),
};

export const Vertical: Story = {
	render: () => (
		<div className="flex h-10 items-center gap-4 text-sm">
			<span>Home</span>
			<Separator orientation="vertical" />
			<span>About</span>
			<Separator orientation="vertical" />
			<span>Contact</span>
		</div>
	),
};
