import { screen, waitFor } from "@testing-library/react";
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

		expect(screen.getByText(/exceeds the budget/)).toBeInTheDocument();
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

		await user.type(screen.getByLabelText("Label"), "Catering");
		await user.click(screen.getByLabelText("Direction"));
		await user.click(await screen.findByRole("option", { name: "Income" }));
		await user.type(screen.getByLabelText("Amount (€)"), "900");
		await user.click(screen.getByRole("button", { name: /Add/ }));

		await waitFor(() => {
			expect(onCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					department: "Makeathon",
					label: "Catering",
					direction: "income",
					plannedAmount: 900,
					status: "planned",
				}),
			);
		});
		await waitFor(() => {
			expect(screen.getByLabelText("Label")).toHaveValue("");
			expect(screen.getByLabelText("Amount (€)")).toHaveValue(null);
		});
	});

	it("uses the shared schema to reject a negative planned amount", async () => {
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

		await user.type(screen.getByLabelText("Label"), "Invalid item");
		await user.type(screen.getByLabelText("Amount (€)"), "-1");

		expect(
			await screen.findByText(/expected number to be >=0/),
		).toBeInTheDocument();
		expect(screen.getByLabelText("Amount (€)")).toHaveAttribute(
			"aria-invalid",
			"true",
		);
		expect(screen.getByRole("button", { name: /Add/ })).toBeDisabled();
		expect(onCreate).not.toHaveBeenCalled();
	});

	it("validates and submits status edits with the shared update schema", async () => {
		const user = userEvent.setup();
		const onUpdate = vi.fn();
		renderWithClient(
			<FinancePlanSection
				{...baseProps}
				items={[item()]}
				totals={{ planned: 3000, budget: 10000, actual: 0 }}
				canChooseDepartment={false}
				department="Makeathon"
				onCreate={vi.fn()}
				onUpdate={onUpdate}
			/>,
		);

		await user.click(screen.getByLabelText("Status for Venue"));
		await user.click(await screen.findByRole("option", { name: "Committed" }));

		await waitFor(() => {
			expect(onUpdate).toHaveBeenCalledWith({
				id: "plan-1",
				label: "Venue",
				category: "Location",
				direction: "expense",
				plannedAmount: 3000,
				expectedMonth: "2026-05",
				status: "committed",
				note: null,
			});
		});
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
			screen.getByRole("button", { name: "Delete plan item Venue" }),
		);

		expect(onDelete).toHaveBeenCalledWith("plan-1");
	});
});
