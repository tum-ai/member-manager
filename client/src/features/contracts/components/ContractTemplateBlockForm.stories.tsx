import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { NewBlockForm } from "./ContractTemplateForms";

const meta = {
	title: "Contracts/TemplateBlockForm",
	component: NewBlockForm,
	parameters: {
		layout: "padded",
		a11y: { test: "error" },
	},
	args: {
		onSubmit: fn(),
		submitting: false,
		error: null,
	},
} satisfies Meta<typeof NewBlockForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CreateAlwaysBlock: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.type(canvas.getByLabelText("Name"), "Legal footer");
		await userEvent.type(
			canvas.getByLabelText("Block Text"),
			"Standard legal terms",
		);
		await userEvent.click(canvas.getByRole("button", { name: "Save block" }));
		await expect(args.onSubmit).toHaveBeenCalledWith({
			name: "Legal footer",
			condition_type: "ALWAYS",
			condition_variable: null,
			condition_value: null,
			block_text: "Standard legal terms",
			sort_order: 0,
		});
	},
};
