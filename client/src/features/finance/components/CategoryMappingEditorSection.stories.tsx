import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { FinanceCategoryMappingRow } from "@/features/finance/financeTypes";
import { CategoryMappingEditorSection } from "./CategoryMappingEditorSection";

const rows: FinanceCategoryMappingRow[] = [
	{
		cost_location_two: "1",
		label: null,
		note: null,
		posting_count: 12,
		net: -9800,
		sample_texts: ["Makeathon catering", "Onboarding food"],
	},
	{
		cost_location_two: "5",
		label: "Software",
		note: null,
		posting_count: 40,
		net: -1200,
		sample_texts: ["Notion subscription", "Vercel subscription"],
	},
];

const meta = {
	title: "Features/Finance/CategoryMappingEditorSection",
	component: CategoryMappingEditorSection,
	parameters: { layout: "padded" },
} satisfies Meta<typeof CategoryMappingEditorSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		rows,
		isLoading: false,
		error: null,
		savingCostLocationTwo: null,
		onSave: fn(),
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Uncategorized")).toBeInTheDocument();

		const input = canvas.getByLabelText(
			"Category for cost center 2 (Kostenstelle 2) 1",
		);
		await userEvent.type(input, "Catering");
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Save category for cost center 2 (Kostenstelle 2) 1",
			}),
		);
		await expect(args.onSave).toHaveBeenCalledWith({
			costLocationTwo: "1",
			label: "Catering",
			note: null,
		});
	},
};

export const Loading: Story = {
	args: {
		rows: [],
		isLoading: true,
		error: null,
		savingCostLocationTwo: null,
		onSave: () => undefined,
	},
};
