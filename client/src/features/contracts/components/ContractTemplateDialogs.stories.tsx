import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { NewTemplateDialog } from "./ContractTemplateDialogs";

const meta = {
	title: "Contracts/TemplateDialog",
	component: NewTemplateDialog,
	parameters: {
		layout: "centered",
		a11y: { test: "error" },
	},
	args: {
		open: true,
		onClose: fn(),
		onCreate: fn(),
		submitting: false,
		error: null,
	},
} satisfies Meta<typeof NewTemplateDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CreateTemplate: Story = {
	play: async ({ args }) => {
		const body = within(document.body);
		await userEvent.type(body.getByLabelText("Name"), "Sponsorship");
		await userEvent.click(body.getByRole("button", { name: "Create" }));
		await expect(args.onCreate).toHaveBeenCalledWith("Sponsorship");
	},
};
