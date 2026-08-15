import type {
	BuchhaltungsButlerTransaction,
	FinanceAccountLabel,
	FinanceDepartmentMapping,
	FinanceManagedPlanItem,
	FinancePeriodType,
	FinancePlanItemPostingMatch,
	FinancePostingAllocation,
	FinanceProject,
	FinanceTAccountGroup,
	FinanceTAccountLine,
	FinanceTAccountPlanDetail,
	FinanceTAccountPostingDetail,
	FinanceTAccountResponse,
	FinanceTAccountSaldo,
	FinanceTAccountVat,
} from "@member-manager/shared";
import { FinanceTAccountResponseSchema } from "@member-manager/shared";
import { accountKey, buildAccountLookup } from "./financeAccounts.js";
import {
	buildEffectivePostingSplits,
	buildMappingLookup,
	type EffectivePostingSplit,
	type ResolvedDepartmentMapping,
	resolveCostLocationSubTeam,
} from "./financeDepartments.js";
import { embeddedVat } from "./financeVat.js";

function round(value: number): number {
	return Math.round(value * 100) / 100;
}

// A posting split recombined to one line per (posting, project) for the target
// department. `buildEffectivePostingSplits` doubles gemischt postings into
// ideell + wirtschaftlich; those share a posting/department/project, so we sum
// their amounts back together to avoid duplicate-looking rows. The net is
// preserved, keeping the actual saldo equal to `aggregateByDepartment` (FR-G5).
interface MergedSplit {
	posting: BuchhaltungsButlerTransaction;
	projectId: string | null;
	amount: number;
}

function mergeSplitsForDepartment(
	splits: EffectivePostingSplit[],
	department: string,
): MergedSplit[] {
	const byKey = new Map<string, MergedSplit>();
	for (const split of splits) {
		if (split.department !== department) {
			continue;
		}
		const key = `${split.posting.external_id}\u001f${split.projectId ?? ""}`;
		const existing = byKey.get(key);
		if (existing) {
			existing.amount += split.amount;
		} else {
			byKey.set(key, {
				posting: split.posting,
				projectId: split.projectId,
				amount: split.amount,
			});
		}
	}
	return [...byKey.values()];
}

function normalizeCategory(costLocationTwo: string): string | null {
	const trimmed = costLocationTwo.trim();
	if (trimmed === "" || trimmed === "0") {
		return null;
	}
	return trimmed;
}

function postingLabel(posting: BuchhaltungsButlerTransaction): string {
	const text = posting.postingtext.trim();
	if (text) return text;
	const purpose = posting.transaction_purpose.trim();
	if (purpose) return purpose;
	return posting.external_id;
}

function blankOrNull(value: string | undefined): string | null {
	const trimmed = (value ?? "").trim();
	return trimmed === "" ? null : trimmed;
}

// Everything the expanded row of a booked invoice shows (FR-K2). Built inline
// here because the postings, allocations, matches and labels are all already in
// memory — opening a row must not cost a round-trip (FR-K3).
function postingDetail(
	split: MergedSplit,
	context: LineContext,
): FinanceTAccountPostingDetail {
	const posting = split.posting;
	const account = accountKey(posting);
	return {
		booking_date: posting.date,
		invoice_number: blankOrNull(posting.receipts_assigned_invoice_numbers),
		// BB has no dedicated counterparty field; the posting text is the closest
		// thing, and the purpose carries the rest.
		counterparty: blankOrNull(posting.postingtext),
		purpose: blankOrNull(posting.transaction_purpose),
		currency: posting.currency,
		posting_amount: posting.transaction_amount,
		debit_account: blankOrNull(posting.debit_postingaccount_number),
		credit_account: blankOrNull(posting.credit_postingaccount_number),
		account_label: context.accountLookup.get(account)?.label ?? null,
		cost_location: blankOrNull(posting.cost_location),
		sub_team: resolveCostLocationSubTeam(
			posting.cost_location,
			context.mappingLookup,
			context.department,
		),
		allocations: context.allocationsByPosting.get(posting.external_id) ?? [],
		matches: context.matchesByPosting.get(posting.external_id) ?? [],
	};
}

function actualLine(
	split: MergedSplit,
	context: LineContext,
): FinanceTAccountLine {
	const magnitude = round(Math.abs(split.amount));
	const vatRate = split.posting.vat > 0 ? split.posting.vat : null;
	const vatAmount = round(embeddedVat(split.amount, split.posting.vat));
	return {
		kind: "actual",
		direction: split.amount < 0 ? "expense" : "income",
		label: postingLabel(split.posting),
		category: normalizeCategory(split.posting.cost_location_two),
		project_id: split.projectId,
		amount: magnitude,
		vat_amount: vatAmount,
		vat_rate: vatRate,
		net_amount: round(magnitude - vatAmount),
		status: null,
		posting_external_id: split.posting.external_id,
		plan_item_id: null,
		posting_detail: postingDetail(split, context),
		plan_detail: null,
	};
}

function planDetail(
	item: FinanceManagedPlanItem,
	matchedAmount: number,
	matches: FinancePlanItemPostingMatch[],
): FinanceTAccountPlanDetail {
	return {
		expected_month: item.expected_month,
		note: item.note,
		planned_amount: round(item.planned_amount),
		matched_amount: round(matchedAmount),
		// Positive = the invoices that arrived exceed what was planned.
		delta: round(matchedAmount - item.planned_amount),
		is_active: item.is_active !== false,
		vat_rate: item.vat_rate ?? null,
		matches,
	};
}

// `plannedAmount` is the still-open remainder (planned minus already-matched
// postings), so a plan line never double-counts a booked/matched posting that
// already appears as an actual line in the same column.
function planLine(
	item: FinanceManagedPlanItem,
	plannedAmount: number,
	matchedAmount: number,
	matches: FinancePlanItemPostingMatch[],
): FinanceTAccountLine {
	const amount = round(plannedAmount);
	// A planned VAT rate is optional (FR-N5); without one the planned VAT stays
	// null rather than pretending the item is zero-rated.
	const vatRate = item.vat_rate ?? null;
	const vatAmount =
		vatRate !== null && vatRate > 0
			? round(embeddedVat(amount, vatRate))
			: null;
	return {
		kind: "plan",
		direction: item.direction ?? "expense",
		label: item.label,
		category: item.category,
		project_id: item.project_id ?? null,
		amount,
		vat_amount: vatAmount,
		vat_rate: vatRate,
		net_amount: round(amount - (vatAmount ?? 0)),
		status: item.status,
		posting_external_id: null,
		plan_item_id: item.id,
		posting_detail: null,
		plan_detail: planDetail(item, matchedAmount, matches),
	};
}

// The lookups a line needs to describe itself, threaded through instead of
// rebuilt per line.
interface LineContext {
	department: string;
	mappingLookup: Map<string, ResolvedDepartmentMapping>;
	accountLookup: ReturnType<typeof buildAccountLookup>;
	allocationsByPosting: Map<string, FinancePostingAllocation[]>;
	matchesByPosting: Map<string, FinancePlanItemPostingMatch[]>;
}

interface GroupAccumulator {
	projectId: string | null;
	// Sub-team label for a non-project group (from the cost-location mapping);
	// null for the true "Direkt zugeordnet" bucket and for project groups.
	subTeam: string | null;
	expenseLines: FinanceTAccountLine[];
	incomeLines: FinanceTAccountLine[];
}

function emptyGroup(
	projectId: string | null,
	subTeam: string | null,
): GroupAccumulator {
	return { projectId, subTeam, expenseLines: [], incomeLines: [] };
}

function addLine(group: GroupAccumulator, line: FinanceTAccountLine): void {
	if (line.direction === "expense") {
		group.expenseLines.push(line);
	} else {
		group.incomeLines.push(line);
	}
}

function saldo(income: number, expenses: number): FinanceTAccountSaldo {
	return {
		income: round(income),
		expenses: round(expenses),
		saldo: round(income - expenses),
	};
}

// Σ VAT for one column, split booked vs still-planned (FR-N3). Expenses carry
// Vorsteuer, income Umsatzsteuer — the caller decides which column it is asking
// about, so this stays direction-agnostic.
function columnVat(lines: FinanceTAccountLine[]): FinanceTAccountVat {
	let actual = 0;
	let plan = 0;
	for (const line of lines) {
		const vat = line.vat_amount ?? 0;
		if (line.kind === "actual") {
			actual += vat;
		} else if (countsTowardPlan(line)) {
			plan += vat;
		}
	}
	return { actual: round(actual), plan: round(plan) };
}

// A disabled Planposten is parked, not planned: it stays on screen but must not
// move the Plan-Saldo or the forecast (FR-M3). Booked lines are never affected.
function countsTowardPlan(line: FinanceTAccountLine): boolean {
	return line.kind === "actual" || line.plan_detail?.is_active !== false;
}

// Both saldi in both amount modes. `net` sums the lines' precomputed net
// amounts rather than subtracting VAT again, so gross and net can never drift
// apart by a rounding step (FR-N6).
function groupSaldi(group: GroupAccumulator): {
	actual: FinanceTAccountSaldo;
	plan: FinanceTAccountSaldo;
	actualNet: FinanceTAccountSaldo;
	planNet: FinanceTAccountSaldo;
} {
	let actualIncome = 0;
	let actualExpenses = 0;
	let planIncome = 0;
	let planExpenses = 0;
	let actualIncomeNet = 0;
	let actualExpensesNet = 0;
	let planIncomeNet = 0;
	let planExpensesNet = 0;
	for (const line of group.incomeLines) {
		if (line.kind === "actual") {
			actualIncome += line.amount;
			actualIncomeNet += line.net_amount;
		}
		if (countsTowardPlan(line)) {
			planIncome += line.amount;
			planIncomeNet += line.net_amount;
		}
	}
	for (const line of group.expenseLines) {
		if (line.kind === "actual") {
			actualExpenses += line.amount;
			actualExpensesNet += line.net_amount;
		}
		if (countsTowardPlan(line)) {
			planExpenses += line.amount;
			planExpensesNet += line.net_amount;
		}
	}
	return {
		// `plan` deliberately includes the actual lines: it is the projected
		// end-state (booked + still planned), so its saldo is the Plan-Saldo.
		actual: saldo(actualIncome, actualExpenses),
		plan: saldo(planIncome, planExpenses),
		actualNet: saldo(actualIncomeNet, actualExpensesNet),
		planNet: saldo(planIncomeNet, planExpensesNet),
	};
}

// Build the single-department T-account: expenses vs income, actual vs plan,
// grouped by project. Empty projects for the department are still emitted as
// folders so a freshly created project (e.g. Makeathon) shows up (FR-I3).
export function buildFinanceTAccount(input: {
	periodType: FinancePeriodType;
	periodKey: string;
	department: string;
	transactions: BuchhaltungsButlerTransaction[];
	mappings: FinanceDepartmentMapping[];
	allocations: FinancePostingAllocation[];
	planItems: FinanceManagedPlanItem[];
	matches: FinancePlanItemPostingMatch[];
	projects: FinanceProject[];
	// Human labels for the SKR accounts shown in an expanded posting. Purely
	// cosmetic, so it is optional: without it a detail panel shows the bare
	// account number rather than failing to build.
	accountLabels?: FinanceAccountLabel[];
	source: "mock" | "real";
	generatedAt: string;
}): FinanceTAccountResponse {
	const merged = mergeSplitsForDepartment(
		buildEffectivePostingSplits(
			input.transactions,
			input.mappings,
			input.allocations,
		),
		input.department,
	);

	const mappingLookup = buildMappingLookup(input.mappings);

	const allocationsByPosting = new Map<string, FinancePostingAllocation[]>();
	for (const allocation of input.allocations) {
		const existing =
			allocationsByPosting.get(allocation.posting_external_id) ?? [];
		existing.push(allocation);
		allocationsByPosting.set(allocation.posting_external_id, existing);
	}

	const matchesByPosting = new Map<string, FinancePlanItemPostingMatch[]>();
	const matchesByPlanItem = new Map<string, FinancePlanItemPostingMatch[]>();
	for (const match of input.matches) {
		const byPosting = matchesByPosting.get(match.posting_external_id) ?? [];
		byPosting.push(match);
		matchesByPosting.set(match.posting_external_id, byPosting);
		const byItem = matchesByPlanItem.get(match.plan_item_id) ?? [];
		byItem.push(match);
		matchesByPlanItem.set(match.plan_item_id, byItem);
	}

	const lineContext: LineContext = {
		department: input.department,
		mappingLookup,
		accountLookup: buildAccountLookup(input.accountLabels ?? []),
		allocationsByPosting,
		matchesByPosting,
	};

	const groups = new Map<string, GroupAccumulator>();
	// A group is a project, else a named sub-team, else the ungrouped bucket.
	const groupKey = (
		projectId: string | null,
		subTeam: string | null,
	): string =>
		projectId ? `proj:${projectId}` : subTeam ? `sub:${subTeam}` : "ungrouped";
	const ensureGroup = (
		projectId: string | null,
		subTeam: string | null,
	): GroupAccumulator => {
		const key = groupKey(projectId, subTeam);
		const existing = groups.get(key);
		if (existing) return existing;
		const created = emptyGroup(projectId, subTeam);
		groups.set(key, created);
		return created;
	};

	// Always emit the ungrouped bucket and every department project as a folder.
	ensureGroup(null, null);
	for (const project of input.projects) {
		if (project.department !== input.department) {
			continue;
		}
		// A project that declares a sub-team needs that sub-team folder to exist
		// even when no posting maps into it directly, or the project would have
		// nowhere to hang (FR-L4).
		if (project.sub_team) {
			ensureGroup(null, project.sub_team);
		}
		ensureGroup(project.id, project.sub_team);
	}

	for (const split of merged) {
		// Un-allocated postings fall into their cost location's sub-team group
		// (e.g. "Big Makeathon"); an explicit project allocation takes precedence.
		// The department is passed so a posting reallocated in from elsewhere does
		// not inherit its original cost location's sub-team.
		const subTeam = split.projectId
			? null
			: resolveCostLocationSubTeam(
					split.posting.cost_location,
					mappingLookup,
					input.department,
				);
		addLine(
			ensureGroup(split.projectId, subTeam),
			actualLine(split, lineContext),
		);
	}

	// Postings matched to a plan item are already booked and appear as actual
	// lines, so the plan line only carries the still-open remainder to avoid
	// double-counting the realised amount in the Plan-Saldo.
	const matchedByPlanItem = new Map<string, number>();
	for (const match of input.matches) {
		matchedByPlanItem.set(
			match.plan_item_id,
			(matchedByPlanItem.get(match.plan_item_id) ?? 0) + match.matched_amount,
		);
	}
	for (const item of input.planItems) {
		if (item.department !== input.department) {
			continue;
		}
		const matched = matchedByPlanItem.get(item.id) ?? 0;
		const remaining = round(item.planned_amount - matched);
		// Every Planposten of the department is emitted, whatever state it is in:
		// a disabled one so it can be re-enabled (FR-M3), a fully matched one so
		// it can still be edited, corrected or detached from — the T-view is the
		// only surface left that lists them. A line with nothing open contributes
		// its zero to the plan column, so none of this double-counts money that
		// has already arrived as an actual line.
		addLine(
			ensureGroup(item.project_id ?? null, null),
			planLine(
				item,
				Math.max(remaining, 0),
				matched,
				matchesByPlanItem.get(item.id) ?? [],
			),
		);
	}

	const projectById = new Map(
		input.projects.map((project) => [project.id, project]),
	);

	// The net saldi are not part of a group's contract (the client recomputes
	// per-node figures from the lines), but the department header needs them, so
	// they are kept aside while the groups are built.
	const netSaldi: {
		actual: FinanceTAccountSaldo;
		plan: FinanceTAccountSaldo;
	}[] = [];

	const built: FinanceTAccountGroup[] = [...groups.values()]
		.map((group) => {
			const project = group.projectId
				? projectById.get(group.projectId)
				: undefined;
			const saldi = groupSaldi(group);
			netSaldi.push({ actual: saldi.actualNet, plan: saldi.planNet });
			const expenseLines = sortLines(group.expenseLines);
			const incomeLines = sortLines(group.incomeLines);
			return {
				project_id: group.projectId,
				// Projects show their name; sub-team groups reuse `project_name` as
				// their folder label (project_id stays null → not a project).
				project_name: project?.name ?? group.subTeam ?? null,
				parent_project_id: project?.parent_project_id ?? null,
				sub_team: group.subTeam,
				is_sub_team: group.projectId === null && group.subTeam !== null,
				target_amount: project?.target_amount ?? null,
				expense_lines: expenseLines,
				income_lines: incomeLines,
				actual: saldi.actual,
				plan: saldi.plan,
				vorsteuer: columnVat(expenseLines),
				umsatzsteuer: columnVat(incomeLines),
			};
		})
		// The true "Direkt zugeordnet" bucket (no project, no sub-team) first, then
		// every named group (sub-teams + projects) alphabetically by label.
		.sort((a, b) => {
			const aUngrouped = a.project_id === null && a.project_name === null;
			const bUngrouped = b.project_id === null && b.project_name === null;
			if (aUngrouped !== bUngrouped) return aUngrouped ? -1 : 1;
			return (a.project_name ?? "").localeCompare(b.project_name ?? "");
		});

	const totals = built.reduce(
		(sum, group) => ({
			actualIncome: sum.actualIncome + group.actual.income,
			actualExpenses: sum.actualExpenses + group.actual.expenses,
			planIncome: sum.planIncome + group.plan.income,
			planExpenses: sum.planExpenses + group.plan.expenses,
		}),
		{ actualIncome: 0, actualExpenses: 0, planIncome: 0, planExpenses: 0 },
	);

	const netTotals = netSaldi.reduce(
		(sum, entry) => ({
			actualIncome: sum.actualIncome + entry.actual.income,
			actualExpenses: sum.actualExpenses + entry.actual.expenses,
			planIncome: sum.planIncome + entry.plan.income,
			planExpenses: sum.planExpenses + entry.plan.expenses,
		}),
		{ actualIncome: 0, actualExpenses: 0, planIncome: 0, planExpenses: 0 },
	);

	let vatIncome = 0;
	let vatExpenses = 0;
	let vatIncomePlan = 0;
	let vatExpensesPlan = 0;
	for (const group of built) {
		vatIncome += group.umsatzsteuer.actual;
		vatExpenses += group.vorsteuer.actual;
		vatIncomePlan += group.umsatzsteuer.plan;
		vatExpensesPlan += group.vorsteuer.plan;
	}

	// Every Planposten of the department, including the fully matched ones that
	// carry no open remainder and therefore no line, so an expanded invoice can
	// still name what it funds.
	const planItemLabels: Record<string, string> = {};
	for (const item of input.planItems) {
		if (item.department === input.department) {
			planItemLabels[item.id] = item.label;
		}
	}

	return FinanceTAccountResponseSchema.parse({
		period_type: input.periodType,
		period_key: input.periodKey,
		department: input.department,
		groups: built,
		plan_item_labels: planItemLabels,
		totals: {
			actual: saldo(totals.actualIncome, totals.actualExpenses),
			plan: saldo(totals.planIncome, totals.planExpenses),
			actual_net: saldo(netTotals.actualIncome, netTotals.actualExpenses),
			plan_net: saldo(netTotals.planIncome, netTotals.planExpenses),
			vat_income: round(vatIncome),
			vat_expenses: round(vatExpenses),
			vat_income_plan: round(vatIncomePlan),
			vat_expenses_plan: round(vatExpensesPlan),
			// What the department owes the tax office: output tax collected on
			// income minus reclaimable input tax on expenses (FR-N3).
			vat_payload: round(vatIncome - vatExpenses),
			// The same once the still-open Planposten have arrived. Planned lines
			// without a VAT rate contribute nothing, so this equals `vat_payload`
			// until someone plans with a rate (FR-N5).
			vat_payload_forecast: round(
				vatIncome + vatIncomePlan - (vatExpenses + vatExpensesPlan),
			),
		},
		source: input.source,
		generated_at: input.generatedAt,
	});
}

// Actual lines first (booked reality), then planned; within each, largest
// magnitude first so the biggest items lead each column.
function sortLines(lines: FinanceTAccountLine[]): FinanceTAccountLine[] {
	return [...lines].sort((a, b) => {
		if (a.kind !== b.kind) {
			return a.kind === "actual" ? -1 : 1;
		}
		return b.amount - a.amount;
	});
}
