import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { FinanceDepartmentMappingRow } from "@/features/finance/financeTypes";
import { DepartmentMappingEditorSection } from "./DepartmentMappingEditorSection";

const rows: FinanceDepartmentMappingRow[] = [
	{
		cost_location: "161",
		department: null,
		bereich: null,
		note: null,
		posting_count: 12,
		net: -9800,
		sample_texts: ["Makeathon venue", "Makeathon catering"],
	},
	{
		cost_location: "120",
		department: "Partnerships",
		bereich: "ideell",
		note: null,
		posting_count: 8,
		net: 30000,
		sample_texts: ["Sponsoring JetBrains", "Sponsoring HRT"],
	},
];

const meta = {
	title: "Features/Finance/DepartmentMappingEditorSection",
	component: DepartmentMappingEditorSection,
	parameters: { layout: "padded" },
} satisfies Meta<typeof DepartmentMappingEditorSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		rows,
		isLoading: false,
		error: null,
		savingCostLocation: null,
		onSave: () => undefined,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Nicht zugeordnet")).toBeInTheDocument();

		await userEvent.click(
			canvas.getByRole("combobox", {
				name: "Department für Kostenstelle 161",
			}),
		);
		await userEvent.click(
			await canvas.findByRole("option", { name: "Makeathon" }),
		);
		// Selecting auto-saves; the trigger now reflects the chosen department.
		await expect(
			canvas.getByRole("combobox", {
				name: "Department für Kostenstelle 161",
			}),
		).toHaveTextContent("Makeathon");
	},
};

export const Loading: Story = {
	args: {
		rows: [],
		isLoading: true,
		error: null,
		savingCostLocation: null,
		onSave: () => undefined,
	},
};
