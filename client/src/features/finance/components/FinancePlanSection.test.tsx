import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FinancePlanItem } from "@/features/finance/financeTypes";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import { renderWithClient } from "@/test/renderWithClient";
import { FinancePlanSection } from "./FinancePlanSection";

const period: FinancePeriod = { type: "year", key: "2026" };

function item(overrides: Partial<FinancePlanItem> = {}): FinancePlanItem {
	return {
		id: "plan-1",
		department: "Makeathon",
		period_type: "year",
		period_key: "2026",
		label: "Venue",
		category: "Location",
		planned_amount: 3000,
		expected_month: "2026-05",
		status: "planned",
		note: null,
		...overrides,
	};
}

const baseProps = {
	period,
	isLoading: false,
	error: null,
	onPeriodTypeChange: vi.fn(),
	onPeriodKeyChange: vi.fn(),
	onUpdate: vi.fn(),
	onDelete: vi.fn(),
};

describe("FinancePlanSection", () => {
	it("warns when planned exceeds budget", () => {
		renderWithClient(
			<FinancePlanSection
				{...baseProps}
				items={[item()]}
				totals={{ planned: 12000, budget: 10000, actual: 4000 }}
				canChooseDepartment={false}
				department="Makeathon"
				onCreate={vi.fn()}
			/>,
		);

		expect(screen.getByText(/übersteigt das Budget/)).toBeInTheDocument();
	});

	it("creates a plan item for a scoped member's own department", async () => {
		const user = userEvent.setup();
		const onCreate = vi.fn();
		renderWithClient(
			<FinancePlanSection
				{...baseProps}
				items={[]}
				totals={{ planned: 0, budget: 10000, actual: 0 }}
				canChooseDepartment={false}
				department="Makeathon"
				onCreate={onCreate}
			/>,
		);

		await user.type(screen.getByLabelText("Bezeichnung"), "Catering");
		await user.type(screen.getByLabelText("Betrag (€)"), "900");
		await user.click(screen.getByRole("button", { name: /Hinzufügen/ }));

		expect(onCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				department: "Makeathon",
				label: "Catering",
				plannedAmount: 900,
				status: "planned",
			}),
		);
	});

	it("deletes a plan item", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		renderWithClient(
			<FinancePlanSection
				{...baseProps}
				items={[item()]}
				totals={{ planned: 3000, budget: 10000, actual: 0 }}
				canChooseDepartment={false}
				department="Makeathon"
				onCreate={vi.fn()}
				onDelete={onDelete}
			/>,
		);

		await user.click(
			screen.getByRole("button", { name: "Planposten Venue löschen" }),
		);

		expect(onDelete).toHaveBeenCalledWith("plan-1");
	});
});
