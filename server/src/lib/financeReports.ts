import {
	type BuchhaltungsButlerTransaction,
	FINANCE_UNMAPPED_DEPARTMENT,
	type FinanceBudget,
	type FinanceDepartmentMapping,
	type FinanceManagedPlanItem,
	type FinancePeriodReportResponse,
	FinancePeriodReportResponseSchema,
	type FinancePeriodType,
	type FinancePlanItemPostingMatch,
	type FinancePostingAllocation,
	type FinanceProject,
	type FinanceReconciliationResponse,
	FinanceReconciliationResponseSchema,
	type FinanceTaxArea,
	type FinanceTaxAreaReport,
	resolveFinancePeriodRange,
} from "@member-manager/shared";
import {
	buildEffectivePostingSplits,
	buildMappingLookup,
	type EffectivePostingSplit,
	inferAccountTaxArea as inferCanonicalAccountTaxArea,
	resolveTransactionDepartment,
	resolveTransactionTaxArea,
} from "./financeDepartments.js";

interface PostingDefaults {
	department: string | null;
	taxArea: FinanceTaxArea | null;
}

interface AmountAccumulator {
	budget: number;
	plan: number;
	plannedIncome: number;
	actual: number;
}

interface TaxAccumulator {
	targetAmount: number;
	plan: number;
	plannedIncome: number;
	income: number;
	expenses: number;
}

interface ReconciliationScopeTotals {
	signedAmount: number;
	capacity: number;
	matched: number;
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}

function reconciliationScopeKey(
	department: string | null,
	projectId: string | null,
): string {
	return JSON.stringify([department, projectId]);
}

function isSelectedReconciliationScope(
	department: string | null,
	projectId: string | null,
	selectedDepartment: string | null,
	selectedProjectId: string | undefined,
): boolean {
	return (
		(selectedDepartment === null || department === selectedDepartment) &&
		(!selectedProjectId || projectId === selectedProjectId)
	);
}

function groupAllocations(
	allocations: FinancePostingAllocation[],
): Map<string, FinancePostingAllocation[]> {
	const result = new Map<string, FinancePostingAllocation[]>();
	for (const allocation of allocations) {
		const current = result.get(allocation.posting_external_id) ?? [];
		current.push(allocation);
		result.set(allocation.posting_external_id, current);
	}
	return result;
}

function groupEffectiveSplits(
	splits: EffectivePostingSplit[],
): Map<string, EffectivePostingSplit[]> {
	const result = new Map<string, EffectivePostingSplit[]>();
	for (const split of splits) {
		const current = result.get(split.posting.external_id) ?? [];
		current.push(split);
		result.set(split.posting.external_id, current);
	}
	return result;
}

export function inferAccountTaxArea(account: string): FinanceTaxArea | null {
	return inferCanonicalAccountTaxArea(account);
}

function resolvePostingTaxArea(
	posting: BuchhaltungsButlerTransaction,
	mappings: FinanceDepartmentMapping[],
): FinanceTaxArea | null {
	return resolveTransactionTaxArea(posting, buildMappingLookup(mappings));
}

export function derivePostingDefaults(
	posting: BuchhaltungsButlerTransaction,
	mappings: FinanceDepartmentMapping[],
): PostingDefaults {
	const resolvedDepartment = resolveTransactionDepartment(
		posting,
		buildMappingLookup(mappings),
	);
	const taxArea = resolvePostingTaxArea(posting, mappings);
	return {
		department: resolvedDepartment.department,
		taxArea: taxArea === "gemischt" ? null : taxArea,
	};
}

export function canViewPostingInDepartment(
	posting: BuchhaltungsButlerTransaction,
	department: string,
	mappings: FinanceDepartmentMapping[],
	allocations: FinancePostingAllocation[],
): boolean {
	return buildEffectivePostingSplits([posting], mappings, allocations).some(
		(split) => split.department === department,
	);
}

export function buildFinanceReconciliation(input: {
	periodType: FinancePeriodType;
	periodKey: string;
	transactions: BuchhaltungsButlerTransaction[];
	mappings: FinanceDepartmentMapping[];
	allocations: FinancePostingAllocation[];
	matches: FinancePlanItemPostingMatch[];
	planItems: FinanceManagedPlanItem[];
	department: string | null;
	projectId?: string;
	source: "mock" | "real";
}): FinanceReconciliationResponse {
	const allocationsByPosting = groupAllocations(input.allocations);
	const effectiveSplitsByPosting = groupEffectiveSplits(
		buildEffectivePostingSplits(
			input.transactions,
			input.mappings,
			input.allocations,
		),
	);
	const planItemsById = new Map(input.planItems.map((item) => [item.id, item]));
	const relevantMatches = input.matches.filter((match) => {
		const item = planItemsById.get(match.plan_item_id);
		return (
			item !== undefined &&
			isSelectedReconciliationScope(
				item.department,
				item.project_id,
				input.department,
				input.projectId,
			)
		);
	});
	const matchesByPosting = new Map<string, FinancePlanItemPostingMatch[]>();
	for (const match of relevantMatches) {
		const current = matchesByPosting.get(match.posting_external_id) ?? [];
		current.push(match);
		matchesByPosting.set(match.posting_external_id, current);
	}

	const unmatched: FinanceReconciliationResponse["unmatched_postings"] = [];
	const unplanned: FinanceReconciliationResponse["unplanned_postings"] = [];

	for (const posting of input.transactions) {
		const postingAllocations =
			allocationsByPosting.get(posting.external_id) ?? [];
		const postingMatches = matchesByPosting.get(posting.external_id) ?? [];
		const splits = (
			effectiveSplitsByPosting.get(posting.external_id) ?? []
		).filter((split) =>
			isSelectedReconciliationScope(
				split.department,
				split.projectId,
				input.department,
				input.projectId,
			),
		);
		if (splits.length === 0 && postingMatches.length === 0) {
			continue;
		}

		const scopes = new Map<string, ReconciliationScopeTotals>();
		for (const split of splits) {
			const key = reconciliationScopeKey(split.department, split.projectId);
			const totals = scopes.get(key) ?? {
				signedAmount: 0,
				capacity: 0,
				matched: 0,
			};
			totals.signedAmount += split.amount;
			totals.capacity += Math.abs(split.amount);
			scopes.set(key, totals);
		}
		for (const match of postingMatches) {
			const item = planItemsById.get(match.plan_item_id);
			if (!item) continue;
			const key = reconciliationScopeKey(item.department, item.project_id);
			const totals = scopes.get(key) ?? {
				signedAmount: 0,
				capacity: 0,
				matched: 0,
			};
			totals.matched += match.matched_amount;
			scopes.set(key, totals);
		}

		let unmatchedAmount = 0;
		let overmatchedAmount = 0;
		for (const totals of scopes.values()) {
			const capacity = round(totals.capacity);
			const matched = round(totals.matched);
			unmatchedAmount += Math.max(capacity - matched, 0);
			overmatchedAmount += Math.max(matched - capacity, 0);
		}
		const scopeAmount = round(
			[...scopes.values()].reduce(
				(sum, totals) => sum + totals.signedAmount,
				0,
			),
		);
		const matchedAmount = round(
			[...scopes.values()].reduce((sum, totals) => sum + totals.matched, 0),
		);
		unmatchedAmount = round(unmatchedAmount);
		overmatchedAmount = round(overmatchedAmount);
		const row = {
			posting,
			scope_amount: scopeAmount,
			allocations: postingAllocations.filter((allocation) =>
				isSelectedReconciliationScope(
					allocation.department,
					allocation.project_id,
					input.department,
					input.projectId,
				),
			),
			matches: postingMatches,
			matched_amount: matchedAmount,
			unmatched_amount: unmatchedAmount,
			overmatched_amount: overmatchedAmount,
		};

		if (unmatchedAmount > 0 || overmatchedAmount > 0) {
			unmatched.push(row);
		}
		if (matchedAmount === 0) {
			unplanned.push(row);
		}
	}

	return FinanceReconciliationResponseSchema.parse({
		period_type: input.periodType,
		period_key: input.periodKey,
		matches: relevantMatches,
		unmatched_postings: unmatched,
		unplanned_postings: unplanned,
		source: input.source,
		generated_at: new Date().toISOString(),
	});
}

function forecastFactor(
	periodType: FinancePeriodType,
	periodKey: string,
	now: Date,
): number {
	const { dateFrom, dateTo } = resolveFinancePeriodRange(periodType, periodKey);
	const start = new Date(`${dateFrom}T00:00:00.000Z`);
	const end = new Date(`${dateTo}T23:59:59.999Z`);
	if (now < start) return 0;
	if (now >= end) return 1;

	const totalMs = end.getTime() - start.getTime();
	const elapsedMs = Math.max(now.getTime() - start.getTime(), 1);
	return totalMs / elapsedMs;
}

function taxKey(department: string, taxArea: FinanceTaxArea | null): string {
	return `${department}\u0000${taxArea ?? ""}`;
}

function toTaxReport(
	taxArea: FinanceTaxArea | null,
	value: TaxAccumulator,
	factor: number,
): FinanceTaxAreaReport {
	return {
		tax_area: taxArea,
		target_amount: round(value.targetAmount),
		plan: round(value.plan),
		planned_income: round(value.plannedIncome),
		planned_net: round(value.plannedIncome - value.plan),
		actual_income: round(value.income),
		actual_expenses: round(value.expenses),
		actual_net: round(value.income - value.expenses),
		forecast_expenses: round(value.expenses * factor),
	};
}

export function buildFinancePeriodReport(input: {
	periodType: FinancePeriodType;
	periodKey: string;
	transactions: BuchhaltungsButlerTransaction[];
	mappings: FinanceDepartmentMapping[];
	allocations: FinancePostingAllocation[];
	budgets: FinanceBudget[];
	planItems: FinanceManagedPlanItem[];
	projects: FinanceProject[];
	department: string | null;
	source: "mock" | "real";
	now?: Date;
}): FinancePeriodReportResponse {
	const factor = forecastFactor(
		input.periodType,
		input.periodKey,
		input.now ?? new Date(),
	);
	const effectiveSplitsByPosting = groupEffectiveSplits(
		buildEffectivePostingSplits(
			input.transactions,
			input.mappings,
			input.allocations,
		),
	);
	const amounts = new Map<string, AmountAccumulator>();
	const taxAmounts = new Map<
		string,
		TaxAccumulator & {
			department: string;
			taxArea: FinanceTaxArea | null;
		}
	>();
	const projectById = new Map(
		input.projects.map((project) => [project.id, project]),
	);

	const amountFor = (department: string): AmountAccumulator => {
		const current = amounts.get(department) ?? {
			budget: 0,
			plan: 0,
			plannedIncome: 0,
			actual: 0,
		};
		amounts.set(department, current);
		return current;
	};
	const taxFor = (department: string, taxArea: FinanceTaxArea | null) => {
		const key = taxKey(department, taxArea);
		const current = taxAmounts.get(key) ?? {
			department,
			taxArea,
			targetAmount: 0,
			plan: 0,
			plannedIncome: 0,
			income: 0,
			expenses: 0,
		};
		taxAmounts.set(key, current);
		return current;
	};

	for (const budget of input.budgets) {
		if (input.department !== null && budget.department !== input.department) {
			continue;
		}
		amountFor(budget.department).budget += budget.amount_planned;
	}

	for (const project of input.projects) {
		if (
			project.status === "cancelled" ||
			(input.department !== null && project.department !== input.department)
		) {
			continue;
		}
		taxFor(project.department, project.tax_area).targetAmount +=
			project.target_amount;
		amountFor(project.department);
	}

	for (const item of input.planItems) {
		if (input.department !== null && item.department !== input.department) {
			continue;
		}
		const amount = amountFor(item.department);
		if (item.direction === "income") {
			amount.plannedIncome += item.planned_amount;
		} else {
			amount.plan += item.planned_amount;
		}
		const project = item.project_id
			? projectById.get(item.project_id)
			: undefined;
		const tax = taxFor(item.department, project?.tax_area ?? null);
		if (item.direction === "income") {
			tax.plannedIncome += item.planned_amount;
		} else {
			tax.plan += item.planned_amount;
		}
	}

	for (const posting of input.transactions) {
		for (const split of effectiveSplitsByPosting.get(posting.external_id) ??
			[]) {
			const department = split.department ?? FINANCE_UNMAPPED_DEPARTMENT;
			if (input.department !== null && department !== input.department) {
				continue;
			}
			const actual = amountFor(department);
			const tax = taxFor(department, split.taxArea);
			if (split.amount < 0) {
				const expense = Math.abs(split.amount);
				actual.actual += expense;
				tax.expenses += expense;
			} else {
				tax.income += split.amount;
			}
		}
	}

	const departments = [...amounts.entries()]
		.map(([department, value]) => {
			const taxAreaTotals = [...taxAmounts.values()]
				.filter((tax) => tax.department === department)
				.map((tax) => toTaxReport(tax.taxArea, tax, factor))
				.sort((a, b) =>
					String(a.tax_area ?? "").localeCompare(String(b.tax_area ?? "")),
				);
			return {
				department,
				budget: round(value.budget),
				plan: round(value.plan),
				planned_income: round(value.plannedIncome),
				planned_net: round(value.plannedIncome - value.plan),
				actual: round(value.actual),
				remaining: round(value.budget - value.actual),
				forecast: round(value.actual * factor),
				tax_area_totals: taxAreaTotals,
			};
		})
		.sort((a, b) => a.department.localeCompare(b.department));

	const totals = departments.reduce(
		(sum, department) => ({
			budget: sum.budget + department.budget,
			plan: sum.plan + department.plan,
			planned_income: sum.planned_income + department.planned_income,
			planned_net: sum.planned_net + department.planned_net,
			actual: sum.actual + department.actual,
			remaining: sum.remaining + department.remaining,
			forecast: sum.forecast + department.forecast,
		}),
		{
			budget: 0,
			plan: 0,
			planned_income: 0,
			planned_net: 0,
			actual: 0,
			remaining: 0,
			forecast: 0,
		},
	);

	const globalTax = new Map<string, TaxAccumulator>();
	for (const tax of taxAmounts.values()) {
		const key = tax.taxArea ?? "";
		const current = globalTax.get(key) ?? {
			targetAmount: 0,
			plan: 0,
			plannedIncome: 0,
			income: 0,
			expenses: 0,
		};
		current.targetAmount += tax.targetAmount;
		current.plan += tax.plan;
		current.plannedIncome += tax.plannedIncome;
		current.income += tax.income;
		current.expenses += tax.expenses;
		globalTax.set(key, current);
	}

	return FinancePeriodReportResponseSchema.parse({
		period_type: input.periodType,
		period_key: input.periodKey,
		departments,
		totals: {
			budget: round(totals.budget),
			plan: round(totals.plan),
			planned_income: round(totals.planned_income),
			planned_net: round(totals.planned_net),
			actual: round(totals.actual),
			remaining: round(totals.remaining),
			forecast: round(totals.forecast),
		},
		tax_area_totals: [...globalTax.entries()]
			.map(([key, value]) =>
				toTaxReport((key || null) as FinanceTaxArea | null, value, factor),
			)
			.sort((a, b) =>
				String(a.tax_area ?? "").localeCompare(String(b.tax_area ?? "")),
			),
		source: input.source,
		generated_at: new Date().toISOString(),
	});
}
