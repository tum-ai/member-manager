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

const PLAN_ITEM_ID = "20000000-0000-4000-8000-000000000001";
const PROJECT_ID = "10000000-0000-4000-8000-000000000001";

// Captures what reached the RPC and echoes a row back, so a test can assert on
// the parameters the write path built rather than on the database.
function captureRpc(row: Record<string, unknown> = {}): {
	params: Record<string, unknown>;
} {
	const captured = { params: {} as Record<string, unknown> };
	setSupabaseClient({
		rpc: async (_name: string, params: Record<string, unknown>) => {
			captured.params = params;
			return {
				data: {
					id: PLAN_ITEM_ID,
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
					...row,
				},
				error: null,
			};
		},
	} as unknown as SupabaseClient);
	return captured;
}

describe("updatePlanItem", () => {
	test("preserves an income direction when the update omits direction", async () => {
		const captured = captureRpc();

		const updated = await updatePlanItem(
			PLAN_ITEM_ID,
			{
				label: "Sponsoring income",
				planned_amount: 15_000,
				status: "committed",
			},
			{ project_id: null, vat_rate: null },
		);

		assert.strictEqual(captured.params.p_direction, null);
		assert.strictEqual(updated.direction, "income");
	});

	test("keeps the project and VAT rate an update omits", async () => {
		// The planning client sends neither field; omitting them must not detach
		// the Planposten from its project or wipe its planned VAT.
		const captured = captureRpc();

		await updatePlanItem(
			PLAN_ITEM_ID,
			{
				label: "Sponsoring income",
				planned_amount: 15_000,
				status: "committed",
			},
			{ project_id: PROJECT_ID, vat_rate: 19 },
		);

		assert.strictEqual(captured.params.p_project_id, PROJECT_ID);
		assert.strictEqual(captured.params.p_vat_rate, 19);
	});

	test("an explicit null still detaches the project and clears the VAT rate", async () => {
		const captured = captureRpc();

		await updatePlanItem(
			PLAN_ITEM_ID,
			{
				label: "Sponsoring income",
				planned_amount: 15_000,
				status: "committed",
				project_id: null,
				vat_rate: null,
			},
			{ project_id: PROJECT_ID, vat_rate: 19 },
		);

		assert.strictEqual(captured.params.p_project_id, null);
		assert.strictEqual(captured.params.p_vat_rate, null);
	});
});
