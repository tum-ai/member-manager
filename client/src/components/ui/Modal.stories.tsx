import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "./button";
import Modal from "./Modal";

const meta = {
	title: "UI/Modal",
	component: Modal,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: {
		title: "Edit details",
		onClose: () => {},
		onConfirm: () => {},
		children: null,
	},
} satisfies Meta<typeof Modal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => {
		const [open, setOpen] = useState(false);
		return (
			<>
				<Button onClick={() => setOpen(true)}>Open modal</Button>
				{open && (
					<Modal
						title="Edit details"
						onClose={() => setOpen(false)}
						onConfirm={() => setOpen(false)}
						confirmLabel="Save"
					>
						<p className="text-sm text-muted-foreground">
							This is the scrollable body of the modal. The MUI-era API (
							<code>title</code>, <code>onClose</code>, <code>onConfirm</code>)
							is preserved so existing callers stay unchanged.
						</p>
					</Modal>
				)}
			</>
		);
	},
};

export const ConfirmDisabled: Story = {
	render: () => {
		const [open, setOpen] = useState(false);
		return (
			<>
				<Button onClick={() => setOpen(true)}>Open modal</Button>
				{open && (
					<Modal
						title="Confirm is disabled"
						onClose={() => setOpen(false)}
						onConfirm={() => setOpen(false)}
						confirmDisabled
					>
						<p className="text-sm text-muted-foreground">
							The confirm button is disabled until the form is valid.
						</p>
					</Modal>
				)}
			</>
		);
	},
};
