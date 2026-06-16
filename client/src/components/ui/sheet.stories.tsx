import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "./sheet";

const meta = {
	title: "UI/Sheet",
	component: Sheet,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Sheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Sheet>
			<SheetTrigger asChild>
				<Button variant="outline">Open settings</Button>
			</SheetTrigger>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Edit settings</SheetTitle>
					<SheetDescription>
						Update your preferences here. Click save when you're done.
					</SheetDescription>
				</SheetHeader>
				<div className="grid gap-4 px-4">
					<div className="grid gap-2">
						<label className="text-sm font-medium" htmlFor="sheet-username">
							Username
						</label>
						<input
							id="sheet-username"
							defaultValue="@ada"
							className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
						/>
					</div>
				</div>
				<SheetFooter>
					<Button>Save changes</Button>
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	),
};

export const Left: Story = {
	render: () => (
		<Sheet>
			<SheetTrigger asChild>
				<Button variant="outline">Open left</Button>
			</SheetTrigger>
			<SheetContent side="left">
				<SheetHeader>
					<SheetTitle>Navigation</SheetTitle>
					<SheetDescription>A sheet anchored to the left.</SheetDescription>
				</SheetHeader>
			</SheetContent>
		</Sheet>
	),
};
