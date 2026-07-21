import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { TemplateListItem } from "./ContractTemplateDialogs";

const meta = {
	title: "Contracts/TemplateListItem",
	component: TemplateListItem,
	parameters: {
		layout: "padded",
		a11y: { test: "error" },
	},
	args: {
		template: {
			id: "tmpl-1",
			name: "Sponsorship agreement",
			description: null,
			contract_text: "",
			is_active: true,
			created_at: "2026-07-01T00:00:00Z",
			updated_at: "2026-07-01T00:00:00Z",
		},
		selected: false,
		onSelect: fn(),
		onDelete: fn(),
	},
} satisfies Meta<typeof TemplateListItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SelectAndDelete: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { pressed: false }));
		await expect(args.onSelect).toHaveBeenCalledOnce();
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Delete template Sponsorship agreement",
			}),
		);
		await expect(args.onDelete).toHaveBeenCalledOnce();
	},
};
