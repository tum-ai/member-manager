import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FinanceAccountSummary } from "@/features/finance/financeTypes";
import { renderWithClient } from "@/test/renderWithClient";
import { FinanceAccountBreakdownSection } from "./FinanceAccountBreakdownSection";

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

const accounts: FinanceAccountSummary[] = [
	{
		account: "6850",
		label: "Veranstaltungen",
		income: 0,
		expenses: 10200,
		net: -10200,
		count: 4,
	},
	{
		account: "8450",
		label: null,
		income: 30000,
		expenses: 0,
		net: 30000,
		count: 3,
	},
];

describe("FinanceAccountBreakdownSection", () => {
	it("renders a table row per account with number and label", () => {
		renderWithClient(
			<FinanceAccountBreakdownSection accounts={accounts} isLoading={false} />,
		);

		expect(screen.getByText("Veranstaltungen")).toBeInTheDocument();
		// Unlabelled account shows a dash for its label but keeps its number.
		expect(screen.getByText("8450")).toBeInTheDocument();
		expect(screen.getAllByText(/10\.200,00/).length).toBeGreaterThan(0);
	});

	it("shows an empty state when there are no expenses", () => {
		renderWithClient(
			<FinanceAccountBreakdownSection accounts={[]} isLoading={false} />,
		);

		expect(
			screen.getByText("Keine Ausgaben im gewählten Zeitraum."),
		).toBeInTheDocument();
	});
});
