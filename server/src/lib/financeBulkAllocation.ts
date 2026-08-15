import type {
	BuchhaltungsButlerTransaction,
	FinanceAllocationResult,
	FinanceAllocationSkipReason,
	FinanceDepartmentMapping,
	FinancePlanItemPostingMatch,
	FinancePostingAllocation,
	FinanceProject,
} from "@member-manager/shared";
import {
	buildMappingLookup,
	resolveTransactionDepartment,
} from "./financeDepartments.js";

// Deciding *which* of the selected invoices may be assigned to a project is the
// whole risk surface of the bulk action (FR-L5–L8), so it lives here as a pure
// function: no Supabase, no BB, fully unit-testable. The route does the IO and
// then writes only what this planner cleared.

export interface BulkAllocationPlanInput {
	project: FinanceProject;
	postingExternalIds: string[];
	// Every posting the period could contain, not pre-filtered by the project's
	// period — otherwise a cross-period posting would look like it does not exist
	// and we could not tell FR-L8 apart from a typo'd id.
	transactions: BuchhaltungsButlerTransaction[];
	allocations: FinancePostingAllocation[];
	matches: FinancePlanItemPostingMatch[];
	// plan item id → the project it belongs to (null for a department-level item).
	planItemProjectById: ReadonlyMap<string, string | null>;
	mappings: FinanceDepartmentMapping[];
	// The project's period, as civil dates. `posting.date` is a civil date too, so
	// string comparison is the correct (and timezone-free) containment test.
	periodRange: { dateFrom: string; dateTo: string };
	// True when the caller may write finance data for that department. Injected so
	// the planner never has to know about roles.
	canWriteDepartment: (department: string | null) => boolean;
}

export interface BulkAllocationPlan {
	// The postings the route may safely write, in request order.
	applicable: BuchhaltungsButlerTransaction[];
	results: FinanceAllocationResult[];
}

function skip(
	postingExternalId: string,
	reason: FinanceAllocationSkipReason,
): FinanceAllocationResult {
	return { posting_external_id: postingExternalId, applied: false, reason };
}

// Every department this posting currently touches. A posting with saved
// allocations belongs to those departments; without any it falls back to its
// cost-location mapping.
function currentDepartments(
	posting: BuchhaltungsButlerTransaction,
	allocations: FinancePostingAllocation[],
	mappingLookup: ReturnType<typeof buildMappingLookup>,
): (string | null)[] {
	if (allocations.length > 0) {
		return allocations.map((allocation) => allocation.department);
	}
	return [resolveTransactionDepartment(posting, mappingLookup).department];
}

export function planBulkAllocation(
	input: BulkAllocationPlanInput,
): BulkAllocationPlan {
	const mappingLookup = buildMappingLookup(input.mappings);
	const postingById = new Map(
		input.transactions.map((transaction) => [
			transaction.external_id,
			transaction,
		]),
	);

	const allocationsByPosting = new Map<string, FinancePostingAllocation[]>();
	for (const allocation of input.allocations) {
		const rows = allocationsByPosting.get(allocation.posting_external_id) ?? [];
		rows.push(allocation);
		allocationsByPosting.set(allocation.posting_external_id, rows);
	}

	const matchesByPosting = new Map<string, FinancePlanItemPostingMatch[]>();
	for (const match of input.matches) {
		const rows = matchesByPosting.get(match.posting_external_id) ?? [];
		rows.push(match);
		matchesByPosting.set(match.posting_external_id, rows);
	}

	const applicable: BuchhaltungsButlerTransaction[] = [];
	const results: FinanceAllocationResult[] = [];
	const seen = new Set<string>();

	for (const externalId of input.postingExternalIds) {
		// A selection can repeat an id; report it once.
		if (seen.has(externalId)) {
			continue;
		}
		seen.add(externalId);

		const posting = postingById.get(externalId);
		if (!posting) {
			results.push(skip(externalId, "not_found"));
			continue;
		}

		// AuthZ first: never let a caller learn anything about a posting they may
		// not touch from the shape of the refusal.
		const departments = currentDepartments(
			posting,
			allocationsByPosting.get(externalId) ?? [],
			mappingLookup,
		);
		if (
			!departments.every((department) => input.canWriteDepartment(department))
		) {
			results.push(skip(externalId, "forbidden"));
			continue;
		}

		// The assign endpoint replaces *all* allocations of a posting, so taking the
		// fast path on a split posting would silently destroy the split (FR-L5).
		if ((allocationsByPosting.get(externalId) ?? []).length > 1) {
			results.push(skip(externalId, "already_split"));
			continue;
		}

		if (
			posting.date < input.periodRange.dateFrom ||
			posting.date > input.periodRange.dateTo
		) {
			results.push(skip(externalId, "period_mismatch"));
			continue;
		}

		// Moving an invoice that funds another project's Planposten would leave that
		// plan item matched to money it no longer has (FR-L7). A department-level
		// Planposten (no project) is unaffected and stays matched.
		const matchedElsewhere = (matchesByPosting.get(externalId) ?? []).some(
			(match) => {
				const planItemProject = input.planItemProjectById.get(
					match.plan_item_id,
				);
				return (
					planItemProject !== undefined &&
					planItemProject !== null &&
					planItemProject !== input.project.id
				);
			},
		);
		if (matchedElsewhere) {
			results.push(skip(externalId, "matched_elsewhere"));
			continue;
		}

		applicable.push(posting);
		results.push({
			posting_external_id: externalId,
			applied: true,
			reason: null,
		});
	}

	return { applicable, results };
}

// Fold the per-posting write outcomes back into the planned results. A write can
// still fail after planning — most often because the database guard refuses to
// invalidate an existing plan-item match — and a bulk assign is atomic *per
// posting* (FR-L6), so the ones that succeeded stay applied.
export function applyWriteFailures(
	results: FinanceAllocationResult[],
	failures: ReadonlyMap<string, FinanceAllocationSkipReason>,
): FinanceAllocationResult[] {
	return results.map((result) => {
		const failure = failures.get(result.posting_external_id);
		if (!result.applied || !failure) {
			return result;
		}
		return {
			posting_external_id: result.posting_external_id,
			applied: false,
			reason: failure,
		};
	});
}
