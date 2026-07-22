import { randomUUID } from "node:crypto";
import {
	type FinanceBudgetTransferRequest,
	FinanceBudgetTransferRequestSchema,
	type FinancePeriodType,
	type FinanceReallocationStatus,
} from "@member-manager/shared";
import {
	ConflictError,
	DatabaseError,
	NotFoundError,
	ValidationError,
} from "./errors.js";
import { getSupabase } from "./supabase.js";

const TABLE = "finance_budget_transfer_requests";
const COLUMNS =
	"id, source_department, target_department, period_type, period_key, amount, reason, status, requested_by, reviewed_by, review_note, reviewed_at, created_at, updated_at";

function parseRequest(
	row: Record<string, unknown>,
): FinanceBudgetTransferRequest {
	return FinanceBudgetTransferRequestSchema.parse({
		...row,
		amount: Number(row.amount),
	});
}

export async function createFinanceBudgetTransferRequest(input: {
	sourceDepartment: string;
	targetDepartment: string;
	periodType: FinancePeriodType;
	periodKey: string;
	amount: number;
	reason: string;
	actor: string;
}): Promise<FinanceBudgetTransferRequest> {
	const now = new Date().toISOString();
	const { data, error } = await getSupabase()
		.from(TABLE)
		.insert({
			id: randomUUID(),
			source_department: input.sourceDepartment,
			target_department: input.targetDepartment,
			period_type: input.periodType,
			period_key: input.periodKey,
			amount: input.amount,
			reason: input.reason,
			status: "pending",
			requested_by: input.actor,
			reviewed_by: null,
			review_note: null,
			reviewed_at: null,
			created_at: now,
			updated_at: now,
		})
		.select(COLUMNS)
		.single();

	if (error) {
		throw new DatabaseError("Failed to create budget transfer request");
	}
	return parseRequest(data);
}

export async function listFinanceBudgetTransferRequests(input: {
	department: string | null;
	status?: FinanceReallocationStatus;
}): Promise<FinanceBudgetTransferRequest[]> {
	let query = getSupabase().from(TABLE).select(COLUMNS);
	if (input.department !== null) {
		query = query.eq("source_department", input.department);
	}
	if (input.status) {
		query = query.eq("status", input.status);
	}

	const { data, error } = await query.order("created_at", {
		ascending: false,
	});
	if (error) {
		throw new DatabaseError("Failed to load budget transfer requests");
	}
	return (data ?? []).map(parseRequest);
}

export async function reviewFinanceBudgetTransferRequest(input: {
	requestId: string;
	decision: "approved" | "rejected";
	reviewer: string;
	reviewNote: string | null;
}): Promise<FinanceBudgetTransferRequest> {
	const { data, error } = await getSupabase().rpc(
		"review_finance_budget_transfer_request",
		{
			p_request_id: input.requestId,
			p_decision: input.decision,
			p_reviewer: input.reviewer,
			p_review_note: input.reviewNote,
		},
	);

	if (error) {
		const message = error.message;
		if (message.includes("not found")) {
			throw new NotFoundError("Budget transfer request not found");
		}
		if (message.includes("already been reviewed")) {
			throw new ConflictError(
				"Budget transfer request has already been reviewed",
			);
		}
		if (
			message.includes("no budget") ||
			message.includes("exceeds the source budget")
		) {
			throw new ValidationError(message);
		}
		throw new DatabaseError("Failed to review budget transfer request");
	}
	return parseRequest(data);
}
