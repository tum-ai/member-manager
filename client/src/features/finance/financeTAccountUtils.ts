import type {
	FinanceTAccountGroup,
	FinanceTAccountLine,
} from "@/features/finance/financeTypes";

function round(value: number): number {
	return Math.round(value * 100) / 100;
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
	// True when the line summarises a nested project rolled into its parent.
	isProjectRollup: boolean;
}

// Ist (booked) vs Plan (planned-only) subtotal for one column. `plan` is the
// planned-only sum — the grey rows on their own, not booked + planned combined.
export interface TAccountColumnSummary {
	ist: number;
	plan: number;
}

// One node of the department T-account tree: the ungrouped bucket or a project,
// with its child projects rolled up into its columns and also listed below it.
export interface TAccountNode {
	projectId: string | null;
	projectName: string | null;
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

function toDisplayLine(line: FinanceTAccountLine): TAccountDisplayLine {
	return {
		key: `${line.kind}-${line.posting_external_id ?? line.plan_item_id ?? line.label}`,
		kind: line.kind,
		direction: line.direction,
		label: line.label,
		category: line.category,
		amount: line.amount,
		vatAmount: line.vat_amount,
		isProjectRollup: false,
	};
}

function summarise(lines: TAccountDisplayLine[]): TAccountColumnSummary {
	let ist = 0;
	let plan = 0;
	for (const line of lines) {
		if (line.kind === "actual") ist += line.amount;
		else plan += line.amount;
	}
	return { ist: round(ist), plan: round(plan) };
}

// A child's net rolled into its parent as a single folder line. A positive net
// lands in the income column, a negative one in expenses (as a magnitude).
function rollupLine(
	child: TAccountNode,
	kind: "actual" | "plan",
	net: number,
): TAccountDisplayLine {
	const suffix = kind === "plan" ? " (offen)" : "";
	return {
		key: `rollup-${kind}-${child.projectId}`,
		kind,
		direction: net >= 0 ? "income" : "expense",
		label: `${child.projectName ?? "Projekt"}${suffix}`,
		category: null,
		amount: round(Math.abs(net)),
		vatAmount: null,
		isProjectRollup: true,
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
	const byId = new Map<string, FinanceTAccountGroup>();
	for (const group of groups) {
		if (group.project_id !== null) byId.set(group.project_id, group);
	}

	const childrenByParent = new Map<string, FinanceTAccountGroup[]>();
	const roots: FinanceTAccountGroup[] = [];
	for (const group of groups) {
		const parent = group.parent_project_id;
		if (group.project_id !== null && parent !== null && byId.has(parent)) {
			const siblings = childrenByParent.get(parent) ?? [];
			siblings.push(group);
			childrenByParent.set(parent, siblings);
		} else {
			roots.push(group);
		}
	}

	const buildNode = (
		group: FinanceTAccountGroup,
		seen: ReadonlySet<string>,
	): TAccountNode => {
		const expenseLines = group.expense_lines.map(toDisplayLine);
		const incomeLines = group.income_lines.map(toDisplayLine);

		const nextSeen =
			group.project_id !== null ? new Set(seen).add(group.project_id) : seen;
		const childGroups =
			group.project_id !== null
				? (childrenByParent.get(group.project_id) ?? [])
				: [];
		const children: TAccountNode[] = [];
		for (const childGroup of childGroups) {
			// Skip a malformed parent cycle rather than recursing forever.
			if (childGroup.project_id !== null && seen.has(childGroup.project_id)) {
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
			projectId: group.project_id,
			projectName: group.project_name,
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
