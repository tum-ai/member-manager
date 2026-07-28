import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FinanceCategorySummary } from "@/features/finance/financeTypes";
import { renderWithClient } from "@/test/renderWithClient";
import { FinanceCategoryBreakdownSection } from "./FinanceCategoryBreakdownSection";

// Recharts needs layout it cannot get in jsdom; stub the primitives so the
// section's own logic (table rows, empty state) is what we exercise.
vi.mock("recharts", () => {
	const Passthrough = ({ children }: { children?: ReactNode }) => (
		<div>{children}</div>
	);
	const Noop = () => null;
	return {
		ResponsiveContainer: Passthrough,
		BarChart: Passthrough,
		Bar: Passthrough,
		Cell: Noop,
		LabelList: Noop,
		XAxis: Noop,
		YAxis: Noop,
		CartesianGrid: Noop,
		Tooltip: Noop,
	};
});

const categories: FinanceCategorySummary[] = [
	{
		category: "Catering",
		income: 0,
		expenses: 6840,
		net: -6840,
		count: 3,
		unmapped: false,
	},
	{
		category: "Uncategorized",
		income: 7500,
		expenses: 0,
		net: 7500,
		count: 4,
		unmapped: true,
	},
];

describe("FinanceCategoryBreakdownSection", () => {
	it("renders a table row per category", () => {
		renderWithClient(
			<FinanceCategoryBreakdownSection
				categories={categories}
				isLoading={false}
			/>,
		);

		expect(screen.getByText("Catering")).toBeInTheDocument();
		expect(screen.getByText("Uncategorized")).toBeInTheDocument();
		expect(screen.getAllByText(/6\.840,00/).length).toBeGreaterThan(0);
	});

	it("shows an empty state when there are no expenses", () => {
		renderWithClient(
			<FinanceCategoryBreakdownSection categories={[]} isLoading={false} />,
		);

		expect(
			screen.getByText("No expenses for the selected period."),
		).toBeInTheDocument();
	});
});
