import { randomUUID } from "node:crypto";
import type {
	FinanceBudget,
	FinanceDepartmentSummary,
	FinancePeriodType,
	FinancePlanItem,
	FinancePlanItemCreate,
	FinancePlanItemUpdate,
	FinancePlanStatus,
} from "@member-manager/shared";
import { FINANCE_UNMAPPED_DEPARTMENT } from "@member-manager/shared";
import { getSupabase } from "./supabase.js";

const PLAN_ITEMS_TABLE = "finance_plan_items";
const PLAN_COLUMNS =
	"id, department, period_type, period_key, label, category, planned_amount, expected_month, status, note";

function mapRow(row: Record<string, unknown>): FinancePlanItem {
	return {
		id: String(row.id),
		department: String(row.department),
		period_type: row.period_type as FinancePeriodType,
		period_key: String(row.period_key),
		label: String(row.label),
		category: (row.category ?? null) as string | null,
		planned_amount: Number(row.planned_amount ?? 0),
		expected_month: (row.expected_month ?? null) as string | null,
		status: (row.status ?? "planned") as FinancePlanStatus,
		note: (row.note ?? null) as string | null,
	};
}

export async function loadPlanItems(
	periodType: FinancePeriodType,
	periodKey: string,
	department: string | null,
): Promise<FinancePlanItem[]> {
	let query = getSupabase()
		.from(PLAN_ITEMS_TABLE)
		.select(PLAN_COLUMNS)
		.eq("period_type", periodType)
		.eq("period_key", periodKey);

	if (department !== null) {
		query = query.eq("department", department);
	}

	const { data, error } = await query;
	if (error) {
		throw error;
	}
	return (data ?? []).map(mapRow);
}

export async function getPlanItem(id: string): Promise<FinancePlanItem | null> {
	const { data, error } = await getSupabase()
		.from(PLAN_ITEMS_TABLE)
		.select(PLAN_COLUMNS)
		.eq("id", id)
		.maybeSingle();

	if (error) {
		throw error;
	}
	return data ? mapRow(data) : null;
}

export async function createPlanItem(
	input: FinancePlanItemCreate,
	createdBy: string,
): Promise<FinancePlanItem> {
	const id = randomUUID();
	const { data, error } = await getSupabase()
		.from(PLAN_ITEMS_TABLE)
		.insert({
			id,
			department: input.department,
			period_type: input.period_type,
			period_key: input.period_key,
			label: input.label,
			category: input.category ?? null,
			planned_amount: input.planned_amount,
			expected_month: input.expected_month ?? null,
			status: input.status ?? "planned",
			note: input.note ?? null,
			created_by: createdBy,
			updated_at: new Date().toISOString(),
		})
		.select(PLAN_COLUMNS)
		.single();

	if (error) {
		throw error;
	}
	return mapRow(data);
}

export async function updatePlanItem(
	id: string,
	input: FinancePlanItemUpdate,
): Promise<FinancePlanItem> {
	const { data, error } = await getSupabase()
		.from(PLAN_ITEMS_TABLE)
		.update({
			label: input.label,
			category: input.category ?? null,
			planned_amount: input.planned_amount,
			expected_month: input.expected_month ?? null,
			status: input.status,
			note: input.note ?? null,
			updated_at: new Date().toISOString(),
		})
		.eq("id", id)
		.select(PLAN_COLUMNS)
		.single();

	if (error) {
		throw error;
	}
	return mapRow(data);
}

export async function deletePlanItem(id: string): Promise<void> {
	const { error } = await getSupabase()
		.from(PLAN_ITEMS_TABLE)
		.delete()
		.eq("id", id);

	if (error) {
		throw error;
	}
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}

// Planned (Σ line items) vs budget (Σ ceilings) vs actual (Σ gross expenses)
// for the scope. The unmapped bucket never counts toward actual.
export function computePlanTotals(
	items: FinancePlanItem[],
	budgets: FinanceBudget[],
	departmentSummaries: FinanceDepartmentSummary[],
): { planned: number; budget: number; actual: number } {
	const planned = items.reduce((sum, item) => sum + item.planned_amount, 0);
	const budget = budgets.reduce((sum, entry) => sum + entry.amount_planned, 0);
	const actual = departmentSummaries.reduce(
		(sum, summary) =>
			summary.unmapped || summary.department === FINANCE_UNMAPPED_DEPARTMENT
				? sum
				: sum + summary.expenses,
		0,
	);
	return {
		planned: round(planned),
		budget: round(budget),
		actual: round(actual),
	};
}
