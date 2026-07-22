import { randomUUID } from "node:crypto";
import {
	type BuchhaltungsButlerTransaction,
	type FinancePlanItemPostingMatch,
	type FinancePlanItemPostingMatchCreate,
	FinancePlanItemPostingMatchSchema,
	type FinancePostingAllocation,
	type FinancePostingAllocationInput,
	FinancePostingAllocationSchema,
	type FinanceProject,
	type FinanceReallocationRequest,
	FinanceReallocationRequestSchema,
	type FinanceReallocationStatus,
	type FinanceTaxArea,
	resolveFinancePeriodRange,
} from "@member-manager/shared";
import {
	ConflictError,
	DatabaseError,
	NotFoundError,
	ValidationError,
} from "./errors.js";
import { apportionPostingAmount } from "./financeDepartments.js";
import { getFinanceProject } from "./financeProjects.js";
import { getSupabase } from "./supabase.js";

const ALLOCATION_COLUMNS =
	"id, posting_external_id, department, project_id, tax_area, allocated_amount, allocated_percentage, note, created_by, created_at, updated_at";
const REALLOCATION_COLUMNS =
	"id, posting_external_id, requesting_department, reason, status, requested_by, reviewed_by, review_note, reviewed_at, created_at, updated_at";
const MATCH_COLUMNS =
	"id, plan_item_id, posting_external_id, matched_amount, match_type, created_by, created_at";

export interface NormalizedPostingAllocation {
	department: string | null;
	project_id: string | null;
	tax_area: FinanceTaxArea | null;
	allocated_amount: number;
	allocated_percentage: number;
	note: string | null;
}

export interface PlanItemPostingMatchContext {
	postingAmount: number;
	postingDirection: "expense" | "income";
}

function roundCurrency(value: number): number {
	return Math.round(value * 100) / 100;
}

function roundPercentage(value: number): number {
	return Math.round(value * 10_000) / 10_000;
}

export function calculatePostingScopeCapacity(
	postingAmount: number,
	allocations: Array<
		Pick<
			FinancePostingAllocation,
			"department" | "project_id" | "allocated_percentage"
		> &
			Partial<Pick<FinancePostingAllocation, "tax_area">>
	>,
	scope: {
		department: string;
		projectId: string | null;
	},
): number {
	const absolutePostingAmount = Math.abs(postingAmount);
	if (allocations.length === 0) {
		return roundCurrency(absolutePostingAmount);
	}

	const scopedAmount = apportionPostingAmount(postingAmount, allocations)
		.filter(
			({ allocation }) =>
				allocation.department === scope.department &&
				allocation.project_id === scope.projectId,
		)
		.reduce((sum, { amount }) => sum + Math.abs(amount), 0);

	return roundCurrency(scopedAmount);
}

function parseAllocation(
	row: Record<string, unknown>,
): FinancePostingAllocation {
	return FinancePostingAllocationSchema.parse({
		...row,
		allocated_amount: Number(row.allocated_amount),
		allocated_percentage: Number(row.allocated_percentage),
		created_by: row.created_by ?? null,
	});
}

function parseMatch(row: Record<string, unknown>): FinancePlanItemPostingMatch {
	return FinancePlanItemPostingMatchSchema.parse({
		...row,
		matched_amount: Number(row.matched_amount),
		created_by: row.created_by ?? null,
	});
}

async function loadProjects(
	inputs: FinancePostingAllocationInput[],
): Promise<Map<string, FinanceProject>> {
	const ids = [
		...new Set(
			inputs
				.map((input) => input.project_id)
				.filter((value): value is string => Boolean(value)),
		),
	];
	const projects = await Promise.all(ids.map(getFinanceProject));
	const result = new Map<string, FinanceProject>();

	for (let index = 0; index < ids.length; index += 1) {
		const project = projects[index];
		if (!project) {
			throw new ValidationError("Finance project not found", {
				project_id: ids[index],
			});
		}
		result.set(ids[index], project);
	}
	return result;
}

export async function normalizePostingAllocations(
	posting: BuchhaltungsButlerTransaction,
	inputs: FinancePostingAllocationInput[],
	defaults: {
		department: string | null;
		taxArea: FinanceTaxArea | null;
	},
): Promise<NormalizedPostingAllocation[]> {
	if (posting.transaction_amount === 0) {
		throw new ValidationError("Zero-value postings cannot be allocated");
	}

	const usesAmounts = inputs.every((input) => input.amount !== undefined);
	const usesPercentages = inputs.every(
		(input) => input.percentage !== undefined,
	);
	if (!usesAmounts && !usesPercentages) {
		throw new ValidationError(
			"Allocation splits must all use amounts or all use percentages",
		);
	}

	const projects = await loadProjects(inputs);
	const absolutePostingAmount = Math.abs(posting.transaction_amount);
	const sign = posting.transaction_amount < 0 ? -1 : 1;
	const suppliedTotal = inputs.reduce(
		(sum, input) =>
			sum + (usesAmounts ? (input.amount ?? 0) : (input.percentage ?? 0)),
		0,
	);

	if (
		(usesAmounts && Math.abs(suppliedTotal - absolutePostingAmount) > 0.01) ||
		(usesPercentages && Math.abs(suppliedTotal - 100) > 0.01)
	) {
		throw new ValidationError(
			usesAmounts
				? "Allocation amounts must total the posting amount"
				: "Allocation percentages must total 100",
		);
	}

	let allocatedSoFar = 0;
	const normalized = inputs.map((input, index) => {
		const project = input.project_id
			? projects.get(input.project_id)
			: undefined;
		if (
			project &&
			input.department &&
			project.department !== input.department
		) {
			throw new ValidationError(
				"Allocation department must match the project department",
			);
		}
		if (
			project?.tax_area &&
			input.tax_area &&
			project.tax_area !== input.tax_area
		) {
			throw new ValidationError(
				"Allocation tax area must match the project tax area",
			);
		}
		if (project) {
			const range = resolveFinancePeriodRange(
				project.period_type,
				project.period_key,
			);
			if (posting.date < range.dateFrom || posting.date > range.dateTo) {
				throw new ValidationError(
					"Posting date must fall within the project period",
					{
						posting_date: posting.date,
						project_id: project.id,
						project_period: `${range.dateFrom}/${range.dateTo}`,
					},
				);
			}
		}

		const department =
			input.department ?? project?.department ?? defaults.department;
		const taxArea = input.tax_area ?? project?.tax_area ?? defaults.taxArea;
		if (!department && !project && !taxArea) {
			throw new ValidationError("An allocation target is required");
		}

		const percentage = usesAmounts
			? roundPercentage(((input.amount ?? 0) / absolutePostingAmount) * 100)
			: roundPercentage(input.percentage ?? 0);
		const unsignedAmount =
			index === inputs.length - 1
				? roundCurrency(absolutePostingAmount - allocatedSoFar)
				: roundCurrency(
						usesAmounts
							? (input.amount ?? 0)
							: (absolutePostingAmount * percentage) / 100,
					);
		allocatedSoFar = roundCurrency(allocatedSoFar + unsignedAmount);

		return {
			department,
			project_id: input.project_id ?? null,
			tax_area: taxArea,
			allocated_amount: roundCurrency(unsignedAmount * sign),
			allocated_percentage:
				index === inputs.length - 1
					? roundPercentage(
							100 -
								inputs
									.slice(0, -1)
									.reduce(
										(sum, entry) =>
											sum +
											(usesAmounts
												? roundPercentage(
														((entry.amount ?? 0) / absolutePostingAmount) * 100,
													)
												: roundPercentage(entry.percentage ?? 0)),
										0,
									),
						)
					: percentage,
			note: input.note ?? null,
		};
	});

	const targets = new Set<string>();
	for (const allocation of normalized) {
		const target = JSON.stringify([
			allocation.department,
			allocation.project_id,
			allocation.tax_area,
		]);
		if (targets.has(target)) {
			throw new ValidationError("Allocation targets must be unique");
		}
		targets.add(target);
	}

	return normalized;
}

export async function loadPostingAllocations(
	postingExternalIds?: string[],
): Promise<FinancePostingAllocation[]> {
	let query = getSupabase()
		.from("finance_posting_allocations")
		.select(ALLOCATION_COLUMNS);

	if (postingExternalIds) {
		if (postingExternalIds.length === 0) {
			return [];
		}
		query = query.in("posting_external_id", postingExternalIds);
	}

	const { data, error } = await query.order("created_at", { ascending: true });
	if (error) {
		throw new DatabaseError("Failed to load posting allocations");
	}
	return (data ?? []).map(parseAllocation);
}

export async function replacePostingAllocations(
	postingExternalId: string,
	allocations: NormalizedPostingAllocation[],
	actor: string,
	postingAmount: number,
): Promise<FinancePostingAllocation[]> {
	const { data, error } = await getSupabase().rpc(
		"replace_finance_posting_allocations",
		{
			p_posting_external_id: postingExternalId,
			p_allocations: allocations,
			p_actor: actor,
			p_posting_amount: postingAmount,
		},
	);

	if (error) {
		const message =
			typeof error === "object" && error && "message" in error
				? String(error.message)
				: "";
		if (message.includes("invalidate existing plan item matches")) {
			throw new ConflictError(
				"Posting allocations cannot invalidate existing plan item matches",
			);
		}
		throw new DatabaseError("Failed to replace posting allocations");
	}
	return FinancePostingAllocationSchema.array().parse(data);
}

export async function createFinanceReallocationRequest(input: {
	postingExternalId: string;
	requestingDepartment: string;
	reason: string;
	allocations: NormalizedPostingAllocation[];
	actor: string;
	postingAmount: number;
}): Promise<FinanceReallocationRequest> {
	const { data, error } = await getSupabase().rpc(
		"create_finance_reallocation_request",
		{
			p_posting_external_id: input.postingExternalId,
			p_requesting_department: input.requestingDepartment,
			p_reason: input.reason,
			p_allocations: input.allocations,
			p_actor: input.actor,
			p_posting_amount: input.postingAmount,
		},
	);

	if (error) {
		const message =
			typeof error === "object" && error && "message" in error
				? String(error.message)
				: "";
		if (message.includes("pending reallocation request")) {
			throw new ConflictError(
				"A pending reallocation request already exists for this posting",
			);
		}
		throw new DatabaseError("Failed to create reallocation request");
	}
	return FinanceReallocationRequestSchema.parse(data);
}

export async function listFinanceReallocationRequests(input: {
	department: string | null;
	status?: FinanceReallocationStatus;
}): Promise<FinanceReallocationRequest[]> {
	let query = getSupabase()
		.from("finance_reallocation_requests")
		.select(REALLOCATION_COLUMNS);
	if (input.department !== null) {
		query = query.eq("requesting_department", input.department);
	}
	if (input.status) {
		query = query.eq("status", input.status);
	}

	const { data: requests, error } = await query.order("created_at", {
		ascending: false,
	});
	if (error) {
		throw new DatabaseError("Failed to load reallocation requests");
	}

	const requestIds = (requests ?? []).map((request) => String(request.id));
	if (requestIds.length === 0) {
		return [];
	}
	const { data: items, error: itemsError } = await getSupabase()
		.from("finance_reallocation_request_items")
		.select(`${ALLOCATION_COLUMNS}, request_id`)
		.in("request_id", requestIds)
		.order("created_at", { ascending: true });

	if (itemsError) {
		throw new DatabaseError("Failed to load reallocation request items");
	}

	const allocationsByRequest = new Map<string, FinancePostingAllocation[]>();
	for (const item of items ?? []) {
		const requestId = String(item.request_id);
		const allocations = allocationsByRequest.get(requestId) ?? [];
		allocations.push(parseAllocation(item));
		allocationsByRequest.set(requestId, allocations);
	}

	return (requests ?? []).map((request) =>
		FinanceReallocationRequestSchema.parse({
			...request,
			allocations: allocationsByRequest.get(String(request.id)) ?? [],
		}),
	);
}

export async function getFinanceReallocationPostingExternalId(
	requestId: string,
): Promise<string | null> {
	const { data, error } = await getSupabase()
		.from("finance_reallocation_requests")
		.select("posting_external_id")
		.eq("id", requestId)
		.maybeSingle();

	if (error) {
		throw new DatabaseError("Failed to load reallocation request");
	}
	return data ? String(data.posting_external_id) : null;
}

export async function reviewFinanceReallocationRequest(input: {
	requestId: string;
	decision: "approved" | "rejected";
	reviewer: string;
	reviewNote: string | null;
	postingAmount: number | null;
}): Promise<FinanceReallocationRequest> {
	const { data, error } = await getSupabase().rpc(
		"review_finance_reallocation_request",
		{
			p_request_id: input.requestId,
			p_decision: input.decision,
			p_reviewer: input.reviewer,
			p_review_note: input.reviewNote,
			p_posting_amount: input.postingAmount,
		},
	);

	if (error) {
		const message =
			typeof error === "object" && error && "message" in error
				? String(error.message)
				: "";
		if (message.includes("not found")) {
			throw new NotFoundError("Reallocation request not found");
		}
		if (message.includes("already been reviewed")) {
			throw new ConflictError("Reallocation request has already been reviewed");
		}
		if (message.includes("stale")) {
			throw new ConflictError(
				"Reallocation request is stale because the posting allocations changed",
			);
		}
		throw new DatabaseError("Failed to review reallocation request");
	}
	return FinanceReallocationRequestSchema.parse(data);
}

export async function loadPlanItemPostingMatches(input?: {
	postingExternalIds?: string[];
	planItemIds?: string[];
}): Promise<FinancePlanItemPostingMatch[]> {
	let query = getSupabase()
		.from("finance_plan_item_posting_matches")
		.select(MATCH_COLUMNS);

	if (input?.postingExternalIds) {
		if (input.postingExternalIds.length === 0) return [];
		query = query.in("posting_external_id", input.postingExternalIds);
	}
	if (input?.planItemIds) {
		if (input.planItemIds.length === 0) return [];
		query = query.in("plan_item_id", input.planItemIds);
	}

	const { data, error } = await query.order("created_at", { ascending: true });
	if (error) {
		throw new DatabaseError("Failed to load plan item posting matches");
	}
	return (data ?? []).map(parseMatch);
}

export async function getPlanItemPostingMatch(
	matchId: string,
): Promise<FinancePlanItemPostingMatch | null> {
	const { data, error } = await getSupabase()
		.from("finance_plan_item_posting_matches")
		.select(MATCH_COLUMNS)
		.eq("id", matchId)
		.maybeSingle();

	if (error) {
		throw new DatabaseError("Failed to load plan item posting match");
	}
	return data ? parseMatch(data) : null;
}

export async function createPlanItemPostingMatch(
	input: FinancePlanItemPostingMatchCreate,
	actor: string,
	context: PlanItemPostingMatchContext,
): Promise<FinancePlanItemPostingMatch> {
	const { data, error } = await getSupabase().rpc(
		"create_finance_plan_item_posting_match",
		{
			p_id: randomUUID(),
			p_plan_item_id: input.plan_item_id,
			p_posting_external_id: input.posting_external_id,
			p_matched_amount: input.matched_amount,
			p_match_type: input.match_type ?? "manual",
			p_actor: actor,
			p_posting_amount: context.postingAmount,
			p_posting_direction: context.postingDirection,
		},
	);

	if (error) {
		const message =
			typeof error === "object" && error && "message" in error
				? String(error.message)
				: "";
		if (message.includes("posting's available amount")) {
			throw new ConflictError(
				"Matched amount exceeds the posting's available amount",
			);
		}
		if (message.includes("plan item's planned amount")) {
			throw new ConflictError(
				"Matched amount exceeds the plan item's planned amount",
			);
		}
		if (message.includes("direction")) {
			throw new ValidationError(
				"Posting direction does not match the plan item direction",
			);
		}
		if (!message.includes("already matched")) {
			throw new DatabaseError("Failed to create plan item posting match");
		}
		throw new ConflictError("This plan item is already matched to the posting");
	}
	return parseMatch(data);
}

export async function deletePlanItemPostingMatch(
	matchId: string,
): Promise<void> {
	const { error } = await getSupabase()
		.from("finance_plan_item_posting_matches")
		.delete()
		.eq("id", matchId);

	if (error) {
		throw new DatabaseError("Failed to delete plan item posting match");
	}
}
