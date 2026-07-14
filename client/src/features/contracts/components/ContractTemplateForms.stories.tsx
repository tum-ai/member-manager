import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { NewVariableForm } from "./ContractTemplateForms";

const meta = {
	title: "Contracts/TemplateVariableForm",
	component: NewVariableForm,
	parameters: {
		layout: "padded",
		a11y: { test: "error" },
	},
	args: {
		onSubmit: fn(),
		submitting: false,
		error: null,
	},
} satisfies Meta<typeof NewVariableForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CreateVariable: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.type(
			canvas.getByLabelText("Variable name"),
			"partner_name",
		);
		await userEvent.type(canvas.getByLabelText("Label"), "Partner name");
		await userEvent.click(
			canvas.getByRole("button", { name: "Save variable" }),
		);
		await expect(args.onSubmit).toHaveBeenCalledWith({
			variable_name: "partner_name",
			label: "Partner name",
			data_type: "TEXT",
			help_text: null,
			options: null,
			is_required: false,
			is_multiselect: false,
			show_if_variable: null,
			show_if_value: null,
			sort_order: 0,
		});
	},
};
