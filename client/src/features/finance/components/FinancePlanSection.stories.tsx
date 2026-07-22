import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { FinancePlanItem } from "@/features/finance/financeTypes";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import { FinancePlanSection } from "./FinancePlanSection";

const period: FinancePeriod = { type: "year", key: "2026" };

const items: FinancePlanItem[] = [
	{
		id: "plan-1",
		department: "Makeathon",
		period_type: "year",
		period_key: "2026",
		label: "Venue",
		category: "Location",
		planned_amount: 8000,
		expected_month: "2026-05",
		status: "committed",
		note: null,
	},
	{
		id: "plan-2",
		department: "Makeathon",
		period_type: "year",
		period_key: "2026",
		label: "Catering",
		category: "Food",
		planned_amount: 5000,
		expected_month: "2026-05",
		status: "planned",
		note: null,
	},
];

const meta = {
	title: "Features/Finance/FinancePlanSection",
	component: FinancePlanSection,
	parameters: { layout: "padded" },
} satisfies Meta<typeof FinancePlanSection>;

export default meta;

type Story = StoryObj<typeof meta>;

// Over-committed: planned 13k exceeds the 10k budget → warning.
export const DepartmentView: Story = {
	args: {
		period,
		items,
		totals: { planned: 13000, budget: 10000, actual: 6200 },
		isLoading: false,
		error: null,
		canChooseDepartment: false,
		department: "Makeathon",
		onPeriodTypeChange: () => undefined,
		onPeriodKeyChange: () => undefined,
		onCreate: () => undefined,
		onUpdate: () => undefined,
		onDelete: () => undefined,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText(/übersteigt das Budget/)).toBeInTheDocument();
		await expect(canvas.getByLabelText("Bezeichnung")).toBeVisible();
	},
};

export const ReviewerAllDepartments: Story = {
	args: {
		period,
		items,
		totals: { planned: 13000, budget: 20000, actual: 6200 },
		isLoading: false,
		error: null,
		canChooseDepartment: true,
		department: null,
		onPeriodTypeChange: () => undefined,
		onPeriodKeyChange: () => undefined,
		onCreate: () => undefined,
		onUpdate: () => undefined,
		onDelete: () => undefined,
	},
};

export const Loading: Story = {
	args: {
		period,
		items: [],
		totals: undefined,
		isLoading: true,
		error: null,
		canChooseDepartment: false,
		department: "Makeathon",
		onPeriodTypeChange: () => undefined,
		onPeriodKeyChange: () => undefined,
		onCreate: () => undefined,
		onUpdate: () => undefined,
		onDelete: () => undefined,
	},
};
