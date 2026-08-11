import type {
	FinanceAllocationResult,
	FinanceAllocationSkipReason,
	FinanceBereich,
	FinancePlanStatus,
	FinanceTAccountGroup,
	FinanceTAccountLine,
	FinanceTAccountPlanDetail,
	FinanceTAccountPostingDetail,
} from "@/features/finance/financeTypes";

function round(value: number): number {
	return Math.round(value * 100) / 100;
}

// VAT is legally a different thing on each side of the ledger: reclaimable input
// tax on expenses, output tax owed on income. The UI must never collapse the two
// into a generic "USt" that hides which side it is on (FR-N2).
export function vatLabel(direction: "expense" | "income"): string {
	return direction === "expense" ? "Vorsteuer" : "Umsatzsteuer";
}

// Why a posting was left alone, in words. A bulk assign that silently applies to
// 12 of 15 invoices is worse than one that refuses loudly, so every skip has to
// be sayable (FR-L6).
const SKIP_REASON_LABELS: Record<FinanceAllocationSkipReason, string> = {
	already_split: "bereits aufgeteilt",
	period_mismatch: "außerhalb des Projektzeitraums",
	matched_elsewhere: "mit einem Planposten eines anderen Projekts verknüpft",
	forbidden: "keine Berechtigung",
	not_found: "nicht gefunden",
};

export function describeAllocationSkip(
	reason: FinanceAllocationSkipReason,
): string {
	return SKIP_REASON_LABELS[reason];
}

// One sentence for the toast after a bulk assign: what landed, what did not, and
// why — grouped by reason so 30 skipped invoices do not produce 30 clauses.
export function summarizeAllocationResults(
	results: FinanceAllocationResult[],
): { message: string; hasSkips: boolean } {
	const applied = results.filter((result) => result.applied).length;
	const skipped = results.filter((result) => !result.applied);
	if (skipped.length === 0) {
		return {
			message: `${applied} ${applied === 1 ? "Buchung" : "Buchungen"} zugeordnet.`,
			hasSkips: false,
		};
	}

	const byReason = new Map<FinanceAllocationSkipReason, number>();
	for (const result of skipped) {
		if (result.reason === null) continue;
		byReason.set(result.reason, (byReason.get(result.reason) ?? 0) + 1);
	}
	const clauses = [...byReason.entries()].map(
		([reason, count]) => `${count}× ${describeAllocationSkip(reason)}`,
	);

	return {
		message: `${applied} von ${results.length} Buchungen zugeordnet. ${skipped.length} übersprungen: ${clauses.join(", ")}.`,
		hasSkips: true,
	};
}

// One allocation of a posting, with the project resolved to its name so the
// detail panel does not have to render a raw uuid (FR-K2).
export interface TAccountAllocationView {
	key: string;
	department: string | null;
	projectName: string | null;
	taxArea: FinanceBereich | null;
	percentage: number;
	amount: number;
}

// A plan-item ↔ posting match seen from one side: `label` is always the *other*
// side (the Planposten for a posting row, the posting for a plan row), resolved
// against the lines of this department and falling back to the raw id.
export interface TAccountMatchView {
	key: string;
	label: string;
	amount: number;
}

// A line as rendered in a T-account column: either a real posting/plan line or a
// rolled-up child-project subtotal (folder line) injected into its parent.
export interface TAccountDisplayLine {
	key: string;
	kind: "actual" | "plan";
	direction: "expense" | "income";
	label: string;
	category: string | null;
	amount: number;
	vatAmount: number | null;
	vatRate: number | null;
	netAmount: number;
	status: FinancePlanStatus | null;
	// False only for a disabled Planposten (FR-M3): it still renders, but it is
	// parked, so it must not move any plan subtotal.
	isActive: boolean;
	// The object this line stands for. A booked line carries a posting id (what
	// the selection collects, FR-K1), a plan line a Planposten id; a roll-up
	// folder line neither.
	postingExternalId: string | null;
	planItemId: string | null;
	// True when the line summarises a nested project rolled into its parent.
	isProjectRollup: boolean;
	// Exactly one is set on a real line; a roll-up folder line carries neither and
	// therefore does not expand.
	postingDetail: FinanceTAccountPostingDetail | null;
	planDetail: FinanceTAccountPlanDetail | null;
	allocations: TAccountAllocationView[];
	matches: TAccountMatchView[];
}

// Ist (booked) vs Plan (planned-only) subtotal for one column, plus the VAT
// embedded in each (FR-N3). `plan` is the planned-only sum — the grey rows on
// their own, not booked + planned combined.
export interface TAccountColumnSummary {
	ist: number;
	plan: number;
	vatIst: number;
	vatPlan: number;
}

// One node of the department T-account tree: the ungrouped bucket, a sub-team
// folder or a project, with its children rolled up into its columns and also
// listed below it.
export interface TAccountNode {
	// Stable identity for React keys and for addressing a node in an action —
	// `proj:<id>`, `sub:<name>`, or the single "ungrouped" bucket.
	key: string;
	projectId: string | null;
	projectName: string | null;
	// The sub-team this node hangs under. A sub-team folder repeats its own name.
	subTeam: string | null;
	// True for the synthetic folder standing in for a sub-team rather than a
	// project — it has no project id, so it is not editable as a project.
	isSubTeam: boolean;
	parentProjectId: string | null;
	targetAmount: number | null;
	expenseLines: TAccountDisplayLine[];
	incomeLines: TAccountDisplayLine[];
	expenseSummary: TAccountColumnSummary;
	incomeSummary: TAccountColumnSummary;
	// Ist-Saldo = booked income − booked expenses.
	actualSaldo: number;
	// Forecast = (booked + planned) income − (booked + planned) expenses.
	planSaldo: number;
	// actualSaldo − targetAmount, or null when the project has no target.
	deviation: number | null;
	children: TAccountNode[];
}

// The server labels a sub-team folder with both `sub_team` and `project_name`;
// either identifies it, so a group that carries only one of them still gets its
// own identity instead of collapsing onto the ungrouped bucket.
function subTeamNameOf(group: FinanceTAccountGroup): string | null {
	if (group.project_id !== null) return null;
	return group.sub_team ?? group.project_name;
}

// Stable identity of a group across the flat response and the nested tree.
function groupKey(group: FinanceTAccountGroup): string {
	if (group.project_id !== null) return `proj:${group.project_id}`;
	const subTeam = subTeamNameOf(group);
	return subTeam === null ? "ungrouped" : `sub:${subTeam}`;
}

// Names for the ids that appear inside a line's detail payload. Built once per
// response from the groups themselves — the server sends every project folder
// and every plan line of the department, so no extra request is needed (FR-K3).
interface TAccountLookups {
	projectNames: Map<string, string>;
	planItemLabels: Map<string, string>;
	postingLabels: Map<string, string>;
}

function buildLookups(groups: FinanceTAccountGroup[]): TAccountLookups {
	const projectNames = new Map<string, string>();
	const planItemLabels = new Map<string, string>();
	const postingLabels = new Map<string, string>();
	for (const group of groups) {
		if (group.project_id !== null && group.project_name !== null) {
			projectNames.set(group.project_id, group.project_name);
		}
		for (const line of [...group.expense_lines, ...group.income_lines]) {
			if (line.plan_item_id !== null) {
				planItemLabels.set(line.plan_item_id, line.label);
			}
			if (line.posting_external_id !== null) {
				postingLabels.set(line.posting_external_id, line.label);
			}
		}
	}
	return { projectNames, planItemLabels, postingLabels };
}

function allocationViews(
	detail: FinanceTAccountPostingDetail | null,
	lookups: TAccountLookups,
): TAccountAllocationView[] {
	if (detail === null) return [];
	return detail.allocations.map((allocation) => ({
		key: allocation.id,
		department: allocation.department,
		projectName:
			allocation.project_id !== null
				? (lookups.projectNames.get(allocation.project_id) ?? "Projekt")
				: null,
		taxArea: allocation.tax_area,
		percentage: allocation.allocated_percentage,
		amount: allocation.allocated_amount,
	}));
}

function matchViews(
	line: FinanceTAccountLine,
	lookups: TAccountLookups,
): TAccountMatchView[] {
	const matches = line.posting_detail?.matches ?? line.plan_detail?.matches;
	if (!matches) return [];
	// A posting row lists the Planposten it feeds; a plan row lists the invoices
	// that arrived against it.
	const resolve =
		line.kind === "actual"
			? (match: (typeof matches)[number]) =>
					lookups.planItemLabels.get(match.plan_item_id) ?? "Planposten"
			: (match: (typeof matches)[number]) =>
					lookups.postingLabels.get(match.posting_external_id) ??
					match.posting_external_id;
	return matches.map((match) => ({
		key: match.id,
		label: resolve(match),
		amount: match.matched_amount,
	}));
}

function toDisplayLine(
	line: FinanceTAccountLine,
	lookups: TAccountLookups,
): TAccountDisplayLine {
	return {
		key: `${line.kind}-${line.posting_external_id ?? line.plan_item_id ?? line.label}`,
		kind: line.kind,
		direction: line.direction,
		label: line.label,
		category: line.category,
		amount: line.amount,
		vatAmount: line.vat_amount,
		vatRate: line.vat_rate,
		netAmount: line.net_amount,
		status: line.status,
		isActive: line.plan_detail?.is_active !== false,
		postingExternalId: line.posting_external_id,
		planItemId: line.plan_item_id,
		isProjectRollup: false,
		postingDetail: line.posting_detail,
		planDetail: line.plan_detail,
		allocations: allocationViews(line.posting_detail, lookups),
		matches: matchViews(line, lookups),
	};
}

// Ist / Plan and their VAT for one column. A disabled Planposten is skipped so
// the client subtotals agree with the server saldi, which already exclude it.
function summarise(lines: TAccountDisplayLine[]): TAccountColumnSummary {
	let ist = 0;
	let plan = 0;
	let vatIst = 0;
	let vatPlan = 0;
	for (const line of lines) {
		if (line.kind === "actual") {
			ist += line.amount;
			vatIst += line.vatAmount ?? 0;
		} else if (line.isActive) {
			plan += line.amount;
			vatPlan += line.vatAmount ?? 0;
		}
	}
	return {
		ist: round(ist),
		plan: round(plan),
		vatIst: round(vatIst),
		vatPlan: round(vatPlan),
	};
}

// A child's net rolled into its parent as a single folder line. A positive net
// lands in the income column, a negative one in expenses (as a magnitude).
function rollupLine(
	child: TAccountNode,
	kind: "actual" | "plan",
	net: number,
): TAccountDisplayLine {
	const suffix = kind === "plan" ? " (offen)" : "";
	const amount = round(Math.abs(net));
	return {
		key: `rollup-${kind}-${child.projectId}`,
		kind,
		direction: net >= 0 ? "income" : "expense",
		label: `${child.projectName ?? "Projekt"}${suffix}`,
		category: null,
		amount,
		// A folder line is a net of many lines with different rates; it carries no
		// VAT of its own, which also keeps the parent's VAT subtotal free of the
		// child's (children are not rolled into VAT, matching the server).
		vatAmount: null,
		vatRate: null,
		netAmount: amount,
		status: null,
		isActive: true,
		postingExternalId: null,
		planItemId: null,
		isProjectRollup: true,
		postingDetail: null,
		planDetail: null,
		allocations: [],
		matches: [],
	};
}

// Build the nested display tree from the flat server groups. Projects nest under
// their `parent_project_id` (when that parent is present for this department);
// each parent shows its own lines plus a rolled-up folder line per child, and
// per-column Ist/Plan subtotals + the Ist-Saldo / Forecast / deviation it needs.
//
// Roll-ups are display-only: the department grand total still comes from the
// server `totals`, so a child is never counted twice (keeps FR-G5 intact).
export function buildTAccountTree(
	groups: FinanceTAccountGroup[],
): TAccountNode[] {
	const lookups = buildLookups(groups);
	const byId = new Map<string, FinanceTAccountGroup>();
	const subTeamGroups = new Set<string>();
	for (const group of groups) {
		if (group.project_id !== null) byId.set(group.project_id, group);
		const subTeam = subTeamNameOf(group);
		if (subTeam !== null) subTeamGroups.add(subTeam);
	}

	// Where a group hangs: under its parent project, else under the sub-team that
	// owns it (FR-L4), else at the top. A sub-project inherits its placement from
	// its parent, so the parent check wins.
	const parentKeyOf = (group: FinanceTAccountGroup): string | null => {
		if (group.project_id === null) {
			return null;
		}
		if (group.parent_project_id !== null && byId.has(group.parent_project_id)) {
			return `proj:${group.parent_project_id}`;
		}
		if (group.sub_team !== null && subTeamGroups.has(group.sub_team)) {
			return `sub:${group.sub_team}`;
		}
		return null;
	};

	const childrenByParent = new Map<string, FinanceTAccountGroup[]>();
	const roots: FinanceTAccountGroup[] = [];
	for (const group of groups) {
		const parentKey = parentKeyOf(group);
		if (parentKey === null) {
			roots.push(group);
			continue;
		}
		const siblings = childrenByParent.get(parentKey) ?? [];
		siblings.push(group);
		childrenByParent.set(parentKey, siblings);
	}

	const buildNode = (
		group: FinanceTAccountGroup,
		seen: ReadonlySet<string>,
	): TAccountNode => {
		const key = groupKey(group);
		const expenseLines = group.expense_lines.map((line) =>
			toDisplayLine(line, lookups),
		);
		const incomeLines = group.income_lines.map((line) =>
			toDisplayLine(line, lookups),
		);

		const nextSeen = new Set(seen).add(key);
		const childGroups = childrenByParent.get(key) ?? [];
		const children: TAccountNode[] = [];
		for (const childGroup of childGroups) {
			// Skip a malformed parent cycle rather than recursing forever.
			if (seen.has(groupKey(childGroup))) {
				continue;
			}
			const child = buildNode(childGroup, nextSeen);
			children.push(child);
			if (child.actualSaldo !== 0) {
				const line = rollupLine(child, "actual", child.actualSaldo);
				(line.direction === "income" ? incomeLines : expenseLines).push(line);
			}
			const planOnly = round(child.planSaldo - child.actualSaldo);
			if (planOnly !== 0) {
				const line = rollupLine(child, "plan", planOnly);
				(line.direction === "income" ? incomeLines : expenseLines).push(line);
			}
		}

		const expenseSummary = summarise(expenseLines);
		const incomeSummary = summarise(incomeLines);
		const actualSaldo = round(incomeSummary.ist - expenseSummary.ist);
		const planSaldo = round(
			incomeSummary.ist +
				incomeSummary.plan -
				(expenseSummary.ist + expenseSummary.plan),
		);
		// A zero target means "unset"; show nothing rather than a bogus deviation.
		const targetAmount =
			group.target_amount !== null && group.target_amount !== 0
				? group.target_amount
				: null;

		return {
			key,
			projectId: group.project_id,
			projectName: group.project_name,
			subTeam: group.sub_team,
			isSubTeam: group.is_sub_team,
			parentProjectId: group.parent_project_id,
			targetAmount,
			expenseLines,
			incomeLines,
			expenseSummary,
			incomeSummary,
			actualSaldo,
			planSaldo,
			deviation:
				targetAmount !== null ? round(actualSaldo - targetAmount) : null,
			children,
		};
	};

	return roots.map((group) => buildNode(group, new Set<string>()));
}
