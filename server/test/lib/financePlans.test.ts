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
const PROJECT_ID = "30000000-0000-4000-8000-000000000002";

// The stored row `updatePlanItem` reads before it writes. Whatever the update
// does not mention has to come back out of here unchanged.
function storedRow(overrides: Record<string, unknown> = {}) {
	return {
		id: PLAN_ITEM_ID,
		department: "Makeathon",
		period_type: "year",
		period_key: "2026",
		label: "Sponsoring income",
		category: "Sponsoring",
		direction: "income",
		planned_amount: 15_000,
		expected_month: "2026-05",
		status: "committed",
		note: "Vertrag liegt vor",
		project_id: PROJECT_ID,
		template_item_id: null,
		is_active: true,
		vat_rate: 19,
		...overrides,
	};
}

// Captures the RPC parameters and serves `storedRow` to the pre-read.
function mockSupabase(row: Record<string, unknown>): {
	params: () => Record<string, unknown>;
} {
	let rpcParams: Record<string, unknown> = {};
	setSupabaseClient({
		from: () => ({
			select: () => ({
				eq: () => ({
					maybeSingle: async () => ({ data: row, error: null }),
				}),
			}),
		}),
		rpc: async (_name: string, params: Record<string, unknown>) => {
			rpcParams = params;
			return { data: { ...row, ...{} }, error: null };
		},
	} as unknown as SupabaseClient);
	return { params: () => rpcParams };
}

describe("updatePlanItem", () => {
	test("preserves an income direction when the update omits direction", async () => {
		const supabase = mockSupabase(storedRow());

		const updated = await updatePlanItem(PLAN_ITEM_ID, {
			label: "Sponsoring income",
			planned_amount: 15_000,
			status: "committed",
		});

		assert.strictEqual(supabase.params().p_direction, null);
		assert.strictEqual(updated.direction, "income");
	});

	test("leaves every field the update does not mention alone", async () => {
		// The RPC assigns most columns unconditionally, so a single-field update
		// (here: parking a Planposten, FR-M3) must resend the stored values or it
		// would wipe the project, the VAT rate and the note.
		const supabase = mockSupabase(storedRow());

		await updatePlanItem(PLAN_ITEM_ID, { is_active: false });

		const params = supabase.params();
		assert.strictEqual(params.p_is_active, false);
		assert.strictEqual(params.p_project_id, PROJECT_ID);
		assert.strictEqual(params.p_vat_rate, 19);
		assert.strictEqual(params.p_label, "Sponsoring income");
		assert.strictEqual(params.p_planned_amount, 15_000);
		assert.strictEqual(params.p_status, "committed");
		assert.strictEqual(params.p_category, "Sponsoring");
		assert.strictEqual(params.p_expected_month, "2026-05");
		assert.strictEqual(params.p_note, "Vertrag liegt vor");
	});

	test("correcting the planned amount touches nothing else (FR-M6)", async () => {
		const supabase = mockSupabase(storedRow());

		await updatePlanItem(PLAN_ITEM_ID, { planned_amount: 12_000 });

		const params = supabase.params();
		assert.strictEqual(params.p_planned_amount, 12_000);
		assert.strictEqual(params.p_project_id, PROJECT_ID);
		assert.strictEqual(params.p_status, "committed");
	});

	test("an explicit null still clears a field", async () => {
		// Absent means "leave it"; null means "clear it" — the two must stay
		// distinguishable, or a Planposten could never lose its note or project.
		const supabase = mockSupabase(storedRow());

		await updatePlanItem(PLAN_ITEM_ID, { note: null, project_id: null });

		const params = supabase.params();
		assert.strictEqual(params.p_note, null);
		assert.strictEqual(params.p_project_id, null);
		assert.strictEqual(params.p_vat_rate, 19);
	});
});
