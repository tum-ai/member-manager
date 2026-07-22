import assert from "node:assert";
import { describe, test } from "node:test";
import type {
	FinanceBudget,
	FinanceDepartmentSummary,
	FinancePlanItem,
} from "@member-manager/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { computePlanTotals, updatePlanItem } = await import(
	"../../src/lib/financePlans.js"
);
const { setSupabaseClient } = await import("../../src/lib/supabase.js");

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
		assert.deepStrictEqual(totals, {
			planned: 0,
			planned_expenses: 0,
			planned_income: 0,
			planned_net: 0,
			budget: 0,
			actual: 0,
		});
	});
});

describe("updatePlanItem", () => {
	test("preserves an income direction when the update omits direction", async () => {
		let rpcParams: Record<string, unknown> = {};
		setSupabaseClient({
			rpc: async (_name: string, params: Record<string, unknown>) => {
				rpcParams = params;
				return {
					data: {
						id: "20000000-0000-4000-8000-000000000001",
						department: "Makeathon",
						period_type: "year",
						period_key: "2026",
						label: "Sponsoring income",
						category: null,
						direction: "income",
						planned_amount: 15_000,
						expected_month: null,
						status: "committed",
						note: null,
						project_id: null,
						template_item_id: null,
					},
					error: null,
				};
			},
		} as unknown as SupabaseClient);

		const updated = await updatePlanItem(
			"20000000-0000-4000-8000-000000000001",
			{
				label: "Sponsoring income",
				planned_amount: 15_000,
				status: "committed",
			},
		);

		assert.strictEqual(rpcParams.p_direction, null);
		assert.strictEqual(updated.direction, "income");
	});
});
