import type {
	FinancePlanItemPostingMatch,
	FinancePostingAllocation,
	FinanceTAccountGroup,
	FinanceTAccountLine,
	FinanceTAccountPlanDetail,
	FinanceTAccountPostingDetail,
	FinanceTAccountResponse,
} from "@/features/finance/financeTypes";

// Builders for T-account test + Storybook fixtures. The response shape is wide
// (per-line detail, per-column VAT, sub-team grouping), so hand-writing whole
// objects in every spec turns each contract change into a mechanical rewrite of
// a dozen files. Every builder takes overrides and fills the rest with inert
// defaults, so a spec only states the fields it is actually asserting on.

const FIXTURE_TIMESTAMP = "2026-03-01T09:00:00.000Z";

export function tAccountAllocation(
	overrides: Partial<FinancePostingAllocation> = {},
): FinancePostingAllocation {
	return {
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		posting_external_id: "BB-1",
		department: null,
		project_id: null,
		tax_area: null,
		allocated_amount: 0,
		allocated_percentage: 100,
		note: null,
		created_by: null,
		created_at: FIXTURE_TIMESTAMP,
		updated_at: FIXTURE_TIMESTAMP,
		...overrides,
	};
}

export function tAccountMatch(
	overrides: Partial<FinancePlanItemPostingMatch> = {},
): FinancePlanItemPostingMatch {
	return {
		id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		plan_item_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
		posting_external_id: "BB-1",
		matched_amount: 0,
		match_type: "manual",
		created_by: null,
		created_at: FIXTURE_TIMESTAMP,
		...overrides,
	};
}

export function tAccountPostingDetail(
	overrides: Partial<FinanceTAccountPostingDetail> = {},
): FinanceTAccountPostingDetail {
	return {
		booking_date: "2026-03-01",
		invoice_number: null,
		counterparty: null,
		purpose: null,
		currency: "EUR",
		posting_amount: 0,
		debit_account: null,
		credit_account: null,
		account_label: null,
		cost_location: null,
		sub_team: null,
		allocations: [],
		matches: [],
		...overrides,
	};
}

export function tAccountPlanDetail(
	overrides: Partial<FinanceTAccountPlanDetail> = {},
): FinanceTAccountPlanDetail {
	return {
		expected_month: null,
		note: null,
		planned_amount: 0,
		matched_amount: 0,
		delta: 0,
		is_active: true,
		vat_rate: null,
		matches: [],
		...overrides,
	};
}

// `posting_detail` / `plan_detail` default to whichever matches `kind`, so a
// fixture never has to restate the detail panel just to be type-valid.
export function tAccountLine(
	overrides: Partial<FinanceTAccountLine> = {},
): FinanceTAccountLine {
	const kind = overrides.kind ?? "actual";
	const amount = overrides.amount ?? 0;
	const vatAmount = overrides.vat_amount ?? null;
	return {
		kind,
		direction: "expense",
		label: "Line",
		category: null,
		project_id: null,
		amount,
		vat_amount: vatAmount,
		vat_rate: null,
		net_amount: amount - (vatAmount ?? 0),
		status: null,
		posting_external_id: null,
		plan_item_id: null,
		posting_detail: kind === "actual" ? tAccountPostingDetail() : null,
		plan_detail:
			kind === "plan" ? tAccountPlanDetail({ planned_amount: amount }) : null,
		...overrides,
	};
}

export function tAccountGroup(
	overrides: Partial<FinanceTAccountGroup> = {},
): FinanceTAccountGroup {
	return {
		project_id: null,
		project_name: null,
		parent_project_id: null,
		sub_team: null,
		is_sub_team: false,
		target_amount: null,
		expense_lines: [],
		income_lines: [],
		actual: { income: 0, expenses: 0, saldo: 0 },
		plan: { income: 0, expenses: 0, saldo: 0 },
		vorsteuer: { actual: 0, plan: 0 },
		umsatzsteuer: { actual: 0, plan: 0 },
		...overrides,
	};
}

export function tAccountTotals(
	overrides: Partial<FinanceTAccountResponse["totals"]> = {},
): FinanceTAccountResponse["totals"] {
	return {
		actual: { income: 0, expenses: 0, saldo: 0 },
		plan: { income: 0, expenses: 0, saldo: 0 },
		actual_net: { income: 0, expenses: 0, saldo: 0 },
		plan_net: { income: 0, expenses: 0, saldo: 0 },
		vat_income: 0,
		vat_expenses: 0,
		vat_income_plan: 0,
		vat_expenses_plan: 0,
		vat_payload: 0,
		vat_payload_forecast: 0,
		...overrides,
	};
}
