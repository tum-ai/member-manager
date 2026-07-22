import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
	FinanceAnalyticsResponse,
	FinanceVatRateSummary,
} from "@/features/finance/financeTypes";
import { renderWithClient } from "@/test/renderWithClient";
import { FinanceVatSummarySection } from "./FinanceVatSummarySection";

const totals: FinanceAnalyticsResponse["totals"] = {
	income: 30000,
	expenses: 11900,
	net: 18100,
	vat: 1900,
	count: 20,
	unmapped_count: 0,
};

const byVatRate: FinanceVatRateSummary[] = [
	{ rate: 19, expenses: 11900, vat: 1900, count: 12 },
	{ rate: 0, expenses: 0, vat: 0, count: 8 },
];

describe("FinanceVatSummarySection", () => {
	it("shows gross, VAT and net expense tiles", () => {
		renderWithClient(
			<FinanceVatSummarySection
				totals={totals}
				byVatRate={byVatRate}
				isLoading={false}
			/>,
		);

		expect(screen.getByText("Gross expenses")).toBeInTheDocument();
		expect(screen.getByText("Included VAT (USt.)")).toBeInTheDocument();
		expect(screen.getByText("Net expenses")).toBeInTheDocument();
		expect(screen.getByText("VAT (Umsatzsteuer)")).toBeInTheDocument();
		expect(screen.getByText("Tax rate (Steuersatz)")).toBeInTheDocument();
		// Net = gross - VAT = 11900 - 1900 = 10000.
		expect(screen.getAllByText(/10\.000,00/).length).toBeGreaterThan(0);
		// Rate row renders the 19 % bucket.
		expect(screen.getByText("19 %")).toBeInTheDocument();
	});

	it("shows an empty state when there are no VAT rows", () => {
		renderWithClient(
			<FinanceVatSummarySection
				totals={{ ...totals, expenses: 0, vat: 0 }}
				byVatRate={[]}
				isLoading={false}
			/>,
		);

		expect(
			screen.getByText("No expenses for the selected period."),
		).toBeInTheDocument();
	});
});
