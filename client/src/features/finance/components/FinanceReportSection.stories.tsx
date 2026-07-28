import type { FinancePeriodReportResponse } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import { FinanceReportSection } from "./FinanceReportSection";

const report: FinancePeriodReportResponse = {
	period_type: "year",
	period_key: "2026",
	departments: [
		{
			department: "Makeathon",
			budget: 20_000,
			plan: 15_000,
			actual: 12_400,
			remaining: 7600,
			forecast: 18_200,
			tax_area_totals: [],
		},
	],
	totals: {
		budget: 20_000,
		plan: 15_000,
		actual: 12_400,
		remaining: 7600,
		forecast: 18_200,
	},
	tax_area_totals: [
		{
			tax_area: "wirtschaftlich",
			target_amount: -20_000,
			plan: 15_000,
			actual_income: 6000,
			actual_expenses: 12_400,
			actual_net: -6400,
			forecast_expenses: 18_200,
		},
	],
	source: "real",
	generated_at: "2026-07-21T12:00:00.000Z",
};

const meta = {
	title: "Features/Finance/FinanceReportSection",
	component: FinanceReportSection,
	parameters: { layout: "padded" },
	args: {
		period: { type: "year", key: "2026" },
		report,
		isLoading: false,
		error: null,
		isExporting: false,
		onPeriodTypeChange: fn(),
		onPeriodKeyChange: fn(),
		onExport: fn(),
		onPrint: fn(),
	},
} satisfies Meta<typeof FinanceReportSection>;

export default meta;

type ReportStory = StoryObj<typeof meta>;

export const Default: ReportStory = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Departments" }),
		).toBeInTheDocument();
		await expect(
			canvas.getByRole("heading", { name: "Tax realms" }),
		).toBeInTheDocument();
		await expect(canvas.getByText("Makeathon")).toBeInTheDocument();
	},
};

export const Loading: ReportStory = {
	args: {
		report: undefined,
		isLoading: true,
	},
};
