import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "./popover";

const meta = {
	title: "UI/Popover",
	component: Popover,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="outline">Open dimensions</Button>
			</PopoverTrigger>
			<PopoverContent>
				<PopoverHeader>
					<PopoverTitle>Dimensions</PopoverTitle>
					<PopoverDescription>
						Set the dimensions for the layer.
					</PopoverDescription>
				</PopoverHeader>
				<div className="mt-4 grid gap-3">
					<div className="grid grid-cols-3 items-center gap-2">
						<label className="text-sm" htmlFor="popover-width">
							Width
						</label>
						<input
							id="popover-width"
							defaultValue="100%"
							className="col-span-2 h-8 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
						/>
					</div>
					<div className="grid grid-cols-3 items-center gap-2">
						<label className="text-sm" htmlFor="popover-height">
							Height
						</label>
						<input
							id="popover-height"
							defaultValue="25px"
							className="col-span-2 h-8 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
						/>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	),
};
