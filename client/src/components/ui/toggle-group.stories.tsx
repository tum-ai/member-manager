import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Italic,
	Underline,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

const meta = {
	title: "UI/ToggleGroup",
	component: ToggleGroup,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { type: "single" },
} satisfies Meta<typeof ToggleGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Multiple: Story = {
	render: () => (
		<ToggleGroup type="multiple" defaultValue={["bold"]}>
			<ToggleGroupItem value="bold" aria-label="Bold">
				<Bold />
			</ToggleGroupItem>
			<ToggleGroupItem value="italic" aria-label="Italic">
				<Italic />
			</ToggleGroupItem>
			<ToggleGroupItem value="underline" aria-label="Underline">
				<Underline />
			</ToggleGroupItem>
		</ToggleGroup>
	),
};

export const Single: Story = {
	render: () => (
		<ToggleGroup type="single" defaultValue="left">
			<ToggleGroupItem value="left" aria-label="Align left">
				<AlignLeft />
			</ToggleGroupItem>
			<ToggleGroupItem value="center" aria-label="Align center">
				<AlignCenter />
			</ToggleGroupItem>
			<ToggleGroupItem value="right" aria-label="Align right">
				<AlignRight />
			</ToggleGroupItem>
		</ToggleGroup>
	),
};

export const Outline: Story = {
	render: () => (
		<ToggleGroup type="single" variant="outline" defaultValue="center">
			<ToggleGroupItem value="left" aria-label="Align left">
				<AlignLeft />
			</ToggleGroupItem>
			<ToggleGroupItem value="center" aria-label="Align center">
				<AlignCenter />
			</ToggleGroupItem>
			<ToggleGroupItem value="right" aria-label="Align right">
				<AlignRight />
			</ToggleGroupItem>
		</ToggleGroup>
	),
};

export const Spacing: Story = {
	render: () => (
		<ToggleGroup
			type="single"
			variant="outline"
			spacing={1}
			defaultValue="center"
		>
			<ToggleGroupItem value="left" aria-label="Align left">
				<AlignLeft />
			</ToggleGroupItem>
			<ToggleGroupItem value="center" aria-label="Align center">
				<AlignCenter />
			</ToggleGroupItem>
			<ToggleGroupItem value="right" aria-label="Align right">
				<AlignRight />
			</ToggleGroupItem>
		</ToggleGroup>
	),
};

export const Disabled: Story = {
	render: () => (
		<ToggleGroup type="single" disabled defaultValue="left">
			<ToggleGroupItem value="left" aria-label="Align left">
				<AlignLeft />
			</ToggleGroupItem>
			<ToggleGroupItem value="center" aria-label="Align center">
				<AlignCenter />
			</ToggleGroupItem>
		</ToggleGroup>
	),
};
