import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { Button } from "./button";
import Modal from "./Modal";

const meta = {
	title: "UI/Modal",
	component: Modal,
	tags: ["autodocs"],
	// These stories are a11y-clean, so opt into enforced a11y checks (the global
	// default is "todo"). See .storybook/preview.tsx for the rationale.
	parameters: { layout: "centered", a11y: { test: "error" } },
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

// Interaction test: opening the modal reveals its title, and clicking Save
// fires onConfirm. The dialog renders in a Radix portal (outside the story
// canvas), so we query `document.body` rather than `canvasElement`.
export const OpensAndConfirms: Story = {
	render: (args) => {
		const [open, setOpen] = useState(false);
		return (
			<>
				<Button onClick={() => setOpen(true)}>Open modal</Button>
				{open && (
					<Modal
						title="Edit details"
						onClose={() => setOpen(false)}
						onConfirm={args.onConfirm}
						confirmLabel="Save"
					>
						<p>Body content</p>
					</Modal>
				)}
			</>
		);
	},
	args: { onConfirm: fn() },
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Open modal" }));

		const body = within(document.body);
		await expect(
			await body.findByRole("dialog", { name: "Edit details" }),
		).toBeInTheDocument();

		await userEvent.click(body.getByRole("button", { name: "Save" }));
		await expect(args.onConfirm).toHaveBeenCalledTimes(1);
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
