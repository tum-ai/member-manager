import { screen } from "@testing-library/react";
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
				category: "Ohne Kategorie",
				income: 0,
				expenses: 8700,
				net: -8700,
				count: 2,
				unmapped: true,
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
		totals: {
			income: 0,
			expenses: 8700,
			net: -8700,
			count: 2,
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

		expect(screen.getByText("Ausgaben pro Department")).toBeInTheDocument();
		expect(
			screen.getByText("Wirtschaftlicher Geschäftsbetrieb"),
		).toBeInTheDocument();
		// Totals row shows the aggregated expenses.
		expect(screen.getAllByText(/8\.700,00/).length).toBeGreaterThan(0);
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
						unmapped_count: 1,
					},
				})}
			/>,
		);

		expect(
			screen.getByText(/noch nicht\s+zugeordnete Kostenstelle/),
		).toBeInTheDocument();
	});

	it("surfaces an error message", () => {
		renderWithClient(
			<FinanceAnalyticsSection {...baseProps} error={new Error("Boom")} />,
		);

		expect(screen.getByText("Boom")).toBeInTheDocument();
	});
});
