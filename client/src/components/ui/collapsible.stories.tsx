import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronsUpDown } from "lucide-react";

import { Button } from "./button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "./collapsible";

const meta = {
	title: "UI/Collapsible",
	component: Collapsible,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Collapsible>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Collapsible className="w-72 space-y-2">
			<div className="flex items-center justify-between gap-4 rounded-md border px-4 py-2">
				<span className="text-sm font-medium">Project members</span>
				<CollapsibleTrigger asChild>
					<Button variant="ghost" size="icon-sm" aria-label="Toggle">
						<ChevronsUpDown />
					</Button>
				</CollapsibleTrigger>
			</div>
			<CollapsibleContent className="space-y-2">
				{["Ada Lovelace", "Alan Turing", "Grace Hopper"].map((name) => (
					<div key={name} className="rounded-md border px-4 py-2 text-sm">
						{name}
					</div>
				))}
			</CollapsibleContent>
		</Collapsible>
	),
};

export const OpenByDefault: Story = {
	render: () => (
		<Collapsible defaultOpen className="w-72 space-y-2">
			<CollapsibleTrigger asChild>
				<Button variant="outline" className="w-full justify-between">
					Details
					<ChevronsUpDown className="size-4" />
				</Button>
			</CollapsibleTrigger>
			<CollapsibleContent className="rounded-md border px-4 py-2 text-sm text-muted-foreground">
				Expanded content shown on first render.
			</CollapsibleContent>
		</Collapsible>
	),
};
