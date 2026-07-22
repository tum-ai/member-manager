import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { FinanceBudgetVsActualRow } from "@/features/finance/financeTypes";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import { FinanceBudgetSection } from "./FinanceBudgetSection";

const period: FinancePeriod = { type: "year", key: "2026" };

const rows: FinanceBudgetVsActualRow[] = [
	{
		department: "Makeathon",
		amount_planned: 10000,
		actual_expenses: 12000,
		remaining: -2000,
		pct_used: 120,
		over_budget: true,
		currency: "EUR",
		note: null,
	},
	{
		department: "Marketing",
		amount_planned: 4000,
		actual_expenses: 2600,
		remaining: 1400,
		pct_used: 65,
		over_budget: false,
		currency: "EUR",
		note: null,
	},
	{
		department: "Community",
		amount_planned: null,
		actual_expenses: 500,
		remaining: null,
		pct_used: null,
		over_budget: false,
		currency: "EUR",
		note: null,
	},
];

const meta = {
	title: "Features/Finance/FinanceBudgetSection",
	component: FinanceBudgetSection,
	parameters: { layout: "padded" },
} satisfies Meta<typeof FinanceBudgetSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		period,
		rows,
		totals: { amount_planned: 14000, actual_expenses: 15100, remaining: -1100 },
		isLoading: false,
		error: null,
		savingDepartment: null,
		onPeriodTypeChange: () => undefined,
		onPeriodKeyChange: () => undefined,
		onSave: () => undefined,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText(/über Budget/)).toBeInTheDocument();
		await expect(canvas.getByLabelText("Budget für Marketing")).toBeVisible();
	},
};

export const Loading: Story = {
	args: {
		period,
		rows: [],
		totals: undefined,
		isLoading: true,
		error: null,
		savingDepartment: null,
		onPeriodTypeChange: () => undefined,
		onPeriodKeyChange: () => undefined,
		onSave: () => undefined,
	},
};

// A department viewer sees their own budget read-only (no editable inputs).
export const ReadOnly: Story = {
	args: {
		period,
		rows: [rows[1]],
		totals: { amount_planned: 4000, actual_expenses: 2600, remaining: 1400 },
		isLoading: false,
		error: null,
		savingDepartment: null,
		canEdit: false,
		onPeriodTypeChange: () => undefined,
		onPeriodKeyChange: () => undefined,
		onSave: () => undefined,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByLabelText("Budget für Marketing"),
		).not.toBeInTheDocument();
	},
};
