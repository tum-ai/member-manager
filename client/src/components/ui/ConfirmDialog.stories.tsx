import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "./button";
import { ConfirmDialog } from "./ConfirmDialog";

const meta = {
	title: "UI/ConfirmDialog",
	component: ConfirmDialog,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: {
		open: false,
		onOpenChange: () => {},
		title: "Save changes?",
		onConfirm: () => {},
	},
} satisfies Meta<typeof ConfirmDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => {
		const [open, setOpen] = useState(false);
		return (
			<>
				<Button variant="outline" onClick={() => setOpen(true)}>
					Open confirm
				</Button>
				<ConfirmDialog
					open={open}
					onOpenChange={setOpen}
					title="Save changes?"
					description="Your edits will be applied immediately."
					confirmLabel="Save"
					onConfirm={() => {}}
				/>
			</>
		);
	},
};

export const Destructive: Story = {
	render: () => {
		const [open, setOpen] = useState(false);
		return (
			<>
				<Button variant="destructive" onClick={() => setOpen(true)}>
					Delete item
				</Button>
				<ConfirmDialog
					open={open}
					onOpenChange={setOpen}
					title="Delete this item?"
					description="This action cannot be undone."
					confirmLabel="Delete"
					destructive
					onConfirm={() => {}}
				/>
			</>
		);
	},
};
