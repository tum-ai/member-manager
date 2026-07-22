import type { FinancePeriodReportResponse } from "@member-manager/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/renderWithClient";
import { FinanceReportSection } from "./FinanceReportSection";

const report: FinancePeriodReportResponse = {
	period_type: "year",
	period_key: "2026",
	departments: [
		{
			department: "Makeathon",
			budget: 15000,
			plan: 5000,
			actual: 4800,
			remaining: 10200,
			forecast: 7200,
			tax_area_totals: [],
		},
	],
	totals: {
		budget: 15000,
		plan: 5000,
		actual: 4800,
		remaining: 10200,
		forecast: 7200,
	},
	tax_area_totals: [
		{
			tax_area: "wirtschaftlich",
			target_amount: -20000,
			plan: 5000,
			actual_income: 1000,
			actual_expenses: 4800,
			actual_net: -3800,
			forecast_expenses: 7200,
		},
	],
	source: "mock",
	generated_at: "2026-07-21T12:00:00.000Z",
};

describe("FinanceReportSection", () => {
	it("renders department and tax-area totals and exposes export and print actions", async () => {
		const user = userEvent.setup();
		const onExport = vi.fn().mockResolvedValue(undefined);
		const onPrint = vi.fn();
		renderWithClient(
			<FinanceReportSection
				period={{ type: "year", key: "2026" }}
				report={report}
				isLoading={false}
				error={null}
				isExporting={false}
				onPeriodTypeChange={vi.fn()}
				onPeriodKeyChange={vi.fn()}
				onExport={onExport}
				onPrint={onPrint}
			/>,
		);

		expect(screen.getByRole("heading", { name: "Departments" })).toBeVisible();
		expect(
			screen.getByRole("heading", { name: "Steuerbereiche" }),
		).toBeVisible();
		expect(screen.getByText("Makeathon")).toBeVisible();
		expect(screen.getByText("Wirtschaftlicher Geschäftsbetrieb")).toBeVisible();
		expect(screen.getAllByText(/15\.000,00/).length).toBeGreaterThan(0);

		await user.click(screen.getByRole("button", { name: "XLSX exportieren" }));
		await user.click(screen.getByRole("button", { name: "Drucken" }));
		expect(onExport).toHaveBeenCalledOnce();
		expect(onPrint).toHaveBeenCalledOnce();
	});

	it("shows loading and error states without report actions", () => {
		renderWithClient(
			<FinanceReportSection
				period={{ type: "year", key: "2026" }}
				report={undefined}
				isLoading={false}
				error={new Error("Report unavailable")}
				isExporting={false}
				onPeriodTypeChange={vi.fn()}
				onPeriodKeyChange={vi.fn()}
				onExport={vi.fn()}
				onPrint={vi.fn()}
			/>,
		);

		expect(screen.getByText("Report unavailable")).toBeVisible();
		expect(
			screen.getByRole("button", { name: "XLSX exportieren" }),
		).toBeDisabled();
		expect(screen.getByRole("button", { name: "Drucken" })).toBeDisabled();
	});
});
