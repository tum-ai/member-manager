import { screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FinanceAnalyticsResponse } from "@/features/finance/financeTypes";
import { renderWithClient } from "@/test/renderWithClient";
import { FinanceAnalyticsSection } from "./FinanceAnalyticsSection";

// Recharts needs layout it cannot get in jsdom; stub the primitives so the
// section's own logic (labels, totals, warnings) is what we exercise.
vi.mock("recharts", () => {
	const Passthrough = ({ children }: { children?: ReactNode }) => (
		<div>{children}</div>
	);
	const Noop = () => null;
	return {
		ResponsiveContainer: Passthrough,
		BarChart: Passthrough,
		AreaChart: Passthrough,
		PieChart: Passthrough,
		Bar: Passthrough,
		Area: Noop,
		Pie: Passthrough,
		Cell: Noop,
		LabelList: Noop,
		XAxis: Noop,
		YAxis: Noop,
		CartesianGrid: Noop,
		Tooltip: Noop,
		Legend: Noop,
	};
});

function analytics(
	overrides?: Partial<FinanceAnalyticsResponse>,
): FinanceAnalyticsResponse {
	return {
		by_department: [
			{
				department: "Makeathon",
				bereich: "wirtschaftlich",
				income: 0,
				expenses: 8700,
				net: -8700,
				count: 2,
				unmapped: false,
			},
		],
		by_category: [
			{
				category: "Uncategorized",
				income: 0,
				expenses: 8700,
				net: -8700,
				count: 2,
				unmapped: true,
			},
		],
		by_account: [
			{
				account: "6850",
				label: null,
				income: 0,
				expenses: 8700,
				net: -8700,
				count: 2,
			},
		],
		by_month: [{ month: "2026-02", income: 0, expenses: 8700, net: -8700 }],
		by_bereich: [
			{
				bereich: "wirtschaftlich",
				income: 0,
				expenses: 8700,
				net: -8700,
				count: 2,
			},
		],
		by_vat_rate: [],
		totals: {
			income: 0,
			expenses: 8700,
			net: -8700,
			count: 2,
			vat: 0,
			unmapped_count: 0,
		},
		source: "mock",
		generated_at: "2026-07-18T12:00:00.000Z",
		...overrides,
	};
}

const noop = () => {};
const baseProps = {
	range: { dateFrom: "2026-01-01", dateTo: "2026-07-18" },
	isLoading: false,
	isFetching: false,
	error: null,
	onDateFromChange: noop,
	onDateToChange: noop,
	onRefresh: noop,
};

describe("FinanceAnalyticsSection", () => {
	it("renders totals and the Bereich breakdown", () => {
		renderWithClient(
			<FinanceAnalyticsSection {...baseProps} analytics={analytics()} />,
		);

		expect(screen.getByText("Expenses by department")).toBeInTheDocument();
		expect(
			screen.getByText("Wirtschaftlicher Geschäftsbetrieb"),
		).toBeInTheDocument();
		// Totals row shows the aggregated expenses.
		expect(screen.getAllByText(/8\.700,00/).length).toBeGreaterThan(0);
		const legend = screen.getByRole("group", { name: "Chart legend" });
		expect(within(legend).getByText("Income")).toBeInTheDocument();
		expect(within(legend).getByText("Expenses")).toBeInTheDocument();
	});

	it("warns when unmapped postings exist", () => {
		renderWithClient(
			<FinanceAnalyticsSection
				{...baseProps}
				analytics={analytics({
					totals: {
						income: 0,
						expenses: 8700,
						net: -8700,
						count: 3,
						vat: 0,
						unmapped_count: 1,
					},
				})}
			/>,
		);

		expect(
			screen.getByText(/posting\(s\) use an unmapped cost location/),
		).toBeInTheDocument();
	});

	it("surfaces an error message", () => {
		renderWithClient(
			<FinanceAnalyticsSection {...baseProps} error={new Error("Boom")} />,
		);

		expect(screen.getByText("Boom")).toBeInTheDocument();
	});
});
