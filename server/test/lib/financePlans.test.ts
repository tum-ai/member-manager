import assert from "node:assert";
import { describe, test } from "node:test";
import type {
	FinanceBudget,
	FinanceDepartmentSummary,
	FinancePlanItem,
} from "@member-manager/shared";
import { computePlanTotals } from "../../src/lib/financePlans.js";

function planItem(amount: number): FinancePlanItem {
	return {
		id: `plan-${amount}`,
		department: "Makeathon",
		period_type: "year",
		period_key: "2026",
		label: "Line",
		category: null,
		planned_amount: amount,
		expected_month: null,
		status: "planned",
		note: null,
	};
}

function summary(
	department: string,
	expenses: number,
	unmapped = false,
): FinanceDepartmentSummary {
	return {
		department,
		bereich: null,
		income: 0,
		expenses,
		net: -expenses,
		count: 1,
		unmapped,
	};
}

const budget: FinanceBudget = {
	department: "Makeathon",
	period_type: "year",
	period_key: "2026",
	amount_planned: 10000,
	currency: "EUR",
	note: null,
};

describe("computePlanTotals", () => {
	test("sums planned line items, budgets and mapped actuals", () => {
		const totals = computePlanTotals(
			[planItem(3000), planItem(4500)],
			[budget],
			[summary("Makeathon", 6000), summary("Nicht zugeordnet", 999, true)],
		);

		assert.strictEqual(totals.planned, 7500);
		assert.strictEqual(totals.budget, 10000);
		// The unmapped bucket is excluded from actual.
		assert.strictEqual(totals.actual, 6000);
	});

	test("handles an empty plan", () => {
		const totals = computePlanTotals([], [], []);
		assert.deepStrictEqual(totals, { planned: 0, budget: 0, actual: 0 });
	});
});
