import {
	FINANCE_UNMAPPED_DEPARTMENT,
	type FinanceBudget,
	type FinanceBudgetVsActualRow,
	type FinanceDepartmentSummary,
	type FinancePeriodType,
} from "@member-manager/shared";
import { getSupabase } from "./supabase.js";

const BUDGETS_TABLE = "finance_budgets";
const DEFAULT_CURRENCY = "EUR";

export async function loadBudgets(
	periodType: FinancePeriodType,
	periodKey: string,
): Promise<FinanceBudget[]> {
	const { data, error } = await getSupabase()
		.from(BUDGETS_TABLE)
		.select(
			"department, period_type, period_key, amount_planned, currency, note",
		)
		.eq("period_type", periodType)
		.eq("period_key", periodKey);

	if (error) {
		throw error;
	}

	return (data ?? []).map((row) => ({
		department: String(row.department),
		period_type: row.period_type as FinancePeriodType,
		period_key: String(row.period_key),
		amount_planned: Number(row.amount_planned ?? 0),
		currency: row.currency ?? DEFAULT_CURRENCY,
		note: row.note ?? null,
	}));
}

// Upsert a single department budget, keyed on (department, period_type,
// period_key). `set_by` records who last changed the ceiling.
export async function upsertBudget(input: {
	department: string;
	periodType: FinancePeriodType;
	periodKey: string;
	amountPlanned: number;
	note: string | null;
	setBy: string;
}): Promise<FinanceBudget> {
	const { data, error } = await getSupabase()
		.from(BUDGETS_TABLE)
		.upsert(
			{
				department: input.department,
				period_type: input.periodType,
				period_key: input.periodKey,
				amount_planned: input.amountPlanned,
				currency: DEFAULT_CURRENCY,
				note: input.note,
				set_by: input.setBy,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "department,period_type,period_key" },
		)
		.select(
			"department, period_type, period_key, amount_planned, currency, note",
		)
		.single();

	if (error) {
		throw error;
	}

	return {
		department: String(data.department),
		period_type: data.period_type as FinancePeriodType,
		period_key: String(data.period_key),
		amount_planned: Number(data.amount_planned ?? 0),
		currency: data.currency ?? DEFAULT_CURRENCY,
		note: data.note ?? null,
	};
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}

// Join per-department actual (gross) expenses to the stored budgets. Rows are
// the union of budgeted departments and departments that actually spent, so a
// budget with no spend and spend with no budget are both visible. The
// "Nicht zugeordnet" bucket is excluded — it isn't a real department.
export function computeBudgetVsActual(
	departmentSummaries: FinanceDepartmentSummary[],
	budgets: FinanceBudget[],
): {
	rows: FinanceBudgetVsActualRow[];
	totals: {
		amount_planned: number;
		actual_expenses: number;
		remaining: number;
	};
} {
	const actualByDepartment = new Map<string, number>();
	for (const summary of departmentSummaries) {
		if (
			summary.unmapped ||
			summary.department === FINANCE_UNMAPPED_DEPARTMENT
		) {
			continue;
		}
		actualByDepartment.set(summary.department, summary.expenses);
	}

	const budgetByDepartment = new Map<string, FinanceBudget>();
	for (const budget of budgets) {
		budgetByDepartment.set(budget.department, budget);
	}

	const departments = new Set<string>([
		...budgetByDepartment.keys(),
		...actualByDepartment.keys(),
	]);

	let plannedTotal = 0;
	let actualTotal = 0;

	const rows: FinanceBudgetVsActualRow[] = [...departments].map(
		(department) => {
			const budget = budgetByDepartment.get(department) ?? null;
			const actual = round(actualByDepartment.get(department) ?? 0);
			const planned = budget ? round(budget.amount_planned) : null;
			const remaining = planned === null ? null : round(planned - actual);
			const pctUsed =
				planned && planned > 0 ? round((actual / planned) * 100) : null;

			plannedTotal += planned ?? 0;
			actualTotal += actual;

			return {
				department,
				amount_planned: planned,
				actual_expenses: actual,
				remaining,
				pct_used: pctUsed,
				over_budget: planned !== null && actual > planned,
				currency: budget?.currency ?? DEFAULT_CURRENCY,
				note: budget?.note ?? null,
			};
		},
	);

	// Over-budget departments first, then the most-consumed budgeted ones, then
	// unbudgeted spend (planned null) by actual desc.
	rows.sort((a, b) => {
		if (a.over_budget !== b.over_budget) {
			return a.over_budget ? -1 : 1;
		}
		const aHasBudget = a.amount_planned !== null;
		const bHasBudget = b.amount_planned !== null;
		if (aHasBudget !== bHasBudget) {
			return aHasBudget ? -1 : 1;
		}
		if (a.pct_used !== null && b.pct_used !== null) {
			return b.pct_used - a.pct_used;
		}
		return b.actual_expenses - a.actual_expenses;
	});

	return {
		rows,
		totals: {
			amount_planned: round(plannedTotal),
			actual_expenses: round(actualTotal),
			remaining: round(plannedTotal - actualTotal),
		},
	};
}
