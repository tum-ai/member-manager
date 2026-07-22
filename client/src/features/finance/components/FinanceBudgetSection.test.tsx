import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FinanceBudgetVsActualRow } from "@/features/finance/financeTypes";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import { renderWithClient } from "@/test/renderWithClient";
import { FinanceBudgetSection } from "./FinanceBudgetSection";

const period: FinancePeriod = { type: "year", key: "2026" };

function row(
	overrides: Partial<FinanceBudgetVsActualRow> &
		Pick<FinanceBudgetVsActualRow, "department">,
): FinanceBudgetVsActualRow {
	return {
		amount_planned: 5000,
		actual_expenses: 3000,
		remaining: 2000,
		pct_used: 60,
		over_budget: false,
		currency: "EUR",
		note: null,
		...overrides,
	};
}

const baseProps = {
	period,
	totals: { amount_planned: 5000, actual_expenses: 3000, remaining: 2000 },
	isLoading: false,
	error: null,
	savingDepartment: null,
	onPeriodTypeChange: vi.fn(),
	onPeriodKeyChange: vi.fn(),
};

describe("FinanceBudgetSection", () => {
	it("warns when departments are over budget", () => {
		renderWithClient(
			<FinanceBudgetSection
				{...baseProps}
				rows={[
					row({
						department: "Makeathon",
						amount_planned: 5000,
						actual_expenses: 12000,
						remaining: -7000,
						pct_used: 240,
						over_budget: true,
					}),
				]}
				onSave={vi.fn()}
			/>,
		);

		expect(
			screen.getByText(/1 Department\(s\) über Budget/),
		).toBeInTheDocument();
		expect(screen.getAllByText("Über").length).toBeGreaterThan(0);
	});

	it("saves a changed budget amount on blur", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		renderWithClient(
			<FinanceBudgetSection
				{...baseProps}
				rows={[row({ department: "Makeathon", amount_planned: 5000 })]}
				onSave={onSave}
			/>,
		);

		const input = screen.getByLabelText("Budget für Makeathon");
		await user.clear(input);
		await user.type(input, "8000");
		await user.tab();

		expect(onSave).toHaveBeenCalledWith({
			department: "Makeathon",
			amountPlanned: 8000,
		});
	});

	it("renders budgets read-only for a department viewer", () => {
		renderWithClient(
			<FinanceBudgetSection
				{...baseProps}
				canEdit={false}
				rows={[row({ department: "Makeathon", amount_planned: 5000 })]}
				onSave={vi.fn()}
			/>,
		);

		// No editable input; the amount shows as formatted text.
		expect(
			screen.queryByLabelText("Budget für Makeathon"),
		).not.toBeInTheDocument();
		expect(screen.getAllByText(/5\.000,00/).length).toBeGreaterThan(0);
	});

	it("does not save when the amount is unchanged", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		renderWithClient(
			<FinanceBudgetSection
				{...baseProps}
				rows={[row({ department: "Makeathon", amount_planned: 5000 })]}
				onSave={onSave}
			/>,
		);

		await user.click(screen.getByLabelText("Budget für Makeathon"));
		await user.tab();

		expect(onSave).not.toHaveBeenCalled();
	});

	it("refreshes the editable amount when the selected period changes", () => {
		const { rerender } = renderWithClient(
			<FinanceBudgetSection
				{...baseProps}
				rows={[row({ department: "Makeathon", amount_planned: 5000 })]}
				onSave={vi.fn()}
			/>,
		);

		expect(screen.getByLabelText("Budget für Makeathon")).toHaveValue(5000);

		rerender(
			<FinanceBudgetSection
				{...baseProps}
				period={{ type: "year", key: "2027" }}
				rows={[row({ department: "Makeathon", amount_planned: 9000 })]}
				onSave={vi.fn()}
			/>,
		);

		expect(screen.getByLabelText("Budget für Makeathon")).toHaveValue(9000);
	});
});
