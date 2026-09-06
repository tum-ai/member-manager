import { z } from "zod";
import { isActiveMember } from "./permissions.js";

/** Submission variants supported by the reimbursement workflow. */
export const REIMBURSEMENT_SUBMISSION_TYPES = [
	"reimbursement",
	"invoice",
	"vivid_reimbursement",
] as const;

export type ReimbursementSubmissionType =
	(typeof REIMBURSEMENT_SUBMISSION_TYPES)[number];

/** Canonical parser for API payloads containing a reimbursement variant. */
export const reimbursementSubmissionTypeSchema = z.enum(
	REIMBURSEMENT_SUBMISSION_TYPES,
);

/** Lifecycle states used by the reimbursement record. */
export const REIMBURSEMENT_STATUSES = [
	"requested",
	"rejected",
	"paid",
] as const;
export type ReimbursementStatus = (typeof REIMBURSEMENT_STATUSES)[number];

export const REIMBURSEMENT_APPROVAL_STATUSES = [
	"pending",
	"approved",
	"not_approved",
] as const;
export type ReimbursementApprovalStatus =
	(typeof REIMBURSEMENT_APPROVAL_STATUSES)[number];

/** Payment state; Vivid expenses use `not_required` because they are never paid through this tool. */
export const REIMBURSEMENT_PAYMENT_STATUSES = [
	"to_be_paid",
	"paid",
	"not_required",
] as const;
export type ReimbursementPaymentStatus =
	(typeof REIMBURSEMENT_PAYMENT_STATUSES)[number];

export const REIMBURSEMENT_REVIEW_ACTIONS = [
	"approve",
	"reject",
	"mark_paid",
] as const;
export type ReimbursementReviewAction =
	(typeof REIMBURSEMENT_REVIEW_ACTIONS)[number];

export type ReimbursementBuchhaltungsButlerSyncStatus =
	| "not_synced"
	| "pending"
	| "synced"
	| "failed";

export const VIVID_REIMBURSEMENT_SUBMISSION_TYPE =
	"vivid_reimbursement" as const;

/** Member roles allowed to submit Vivid expenses when the member is active. */
export const VIVID_REIMBURSEMENT_ELIGIBLE_MEMBER_ROLES = [
	"Team Lead",
	"President",
	"Vice-President",
] as const;

export interface VividReimbursementEligibilityMember {
	member_role?: string | null;
	member_status?: string | null;
	active?: boolean | null;
}

/**
 * Resolves the role portion of Vivid eligibility without depending on a
 * framework or database. Admin status is checked by the server separately.
 */
export function isVividReimbursementEligibleMember(
	member: VividReimbursementEligibilityMember | null | undefined,
): boolean {
	return (
		isActiveMember(member) &&
		VIVID_REIMBURSEMENT_ELIGIBLE_MEMBER_ROLES.includes(
			member?.member_role as (typeof VIVID_REIMBURSEMENT_ELIGIBLE_MEMBER_ROLES)[number],
		)
	);
}

/** Vivid expenses are tracked as expenses but never enter payout totals. */
export function reimbursementRequiresPayout(
	submissionType: string | null | undefined,
): boolean {
	return submissionType !== VIVID_REIMBURSEMENT_SUBMISSION_TYPE;
}

/** Human-readable labels used consistently in UI and Slack notifications. */
export function getReimbursementSubmissionTypeLabel(
	submissionType: string | null | undefined,
): string {
	switch (submissionType) {
		case "invoice":
			return "Invoice";
		case VIVID_REIMBURSEMENT_SUBMISSION_TYPE:
			return "Vivid Reimbursement";
		default:
			return "Reimbursement";
	}
}

export interface ReimbursementRequest {
	id: string;
	user_id: string;
	requester_name?: string | null;
	requester_email?: string | null;
	person_name?: string | null;
	personName?: string | null;
	email?: string | null;
	amount: number;
	date: string;
	description: string;
	department: string;
	submission_type: ReimbursementSubmissionType;
	payment_iban?: string | null;
	payment_bic?: string | null;
	iban?: string | null;
	bic?: string | null;
	bank_name?: string | null;
	payment_bank_name?: string | null;
	receipt_filename?: string | null;
	receipt_mime_type?: string | null;
	receipt_url?: string | null;
	receiptUrl?: string | null;
	receipt_view_url?: string | null;
	receipt_download_url?: string | null;
	receipt_has_payload?: boolean;
	status: ReimbursementStatus;
	approval_status: ReimbursementApprovalStatus;
	payment_status: ReimbursementPaymentStatus;
	rejection_reason?: string | null;
	bb_sync_status?: ReimbursementBuchhaltungsButlerSyncStatus | null;
	bb_receipt_id_by_customer?: string | null;
	bb_receipt_filename?: string | null;
	bb_synced_at?: string | null;
	bb_sync_error?: string | null;
	bb_sync_attempts?: number | null;
	bb_last_sync_attempt_at?: string | null;
	bb_synced_by?: string | null;
	finance_project_id?: string | null;
	finance_plan_item_id?: string | null;
	bb_posting_external_id?: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface BuchhaltungsButlerSyncStatus {
	sync_enabled: boolean;
	configured: boolean;
	available: boolean;
	unavailable_reason?: "disabled" | "missing_credentials" | null;
}

export interface ReimbursementReviewResponse {
	requests: ReimbursementRequest[];
	receipt_endpoints?: {
		bulk_download_url?: string | null;
	} | null;
	integrations?: {
		buchhaltungsbutler?: BuchhaltungsButlerSyncStatus | null;
	} | null;
}

export interface ReimbursementReviewIntegrationsResponse {
	buchhaltungsbutler?: BuchhaltungsButlerSyncStatus | null;
}

export interface CreateReimbursementRequestPayload {
	amount: number;
	date: string;
	description: string;
	department: string;
	submission_type: ReimbursementSubmissionType;
	payment_iban?: string | null;
	payment_bic?: string | null;
	receipt_filename: string;
	receipt_mime_type: string;
	receipt_base64?: string | null;
	receipt_storage_bucket?: string | null;
	receipt_storage_path?: string | null;
	receipt_size_bytes?: number | null;
}

export interface ParseReimbursementReceiptPayload {
	receipt_filename: string;
	receipt_mime_type: string;
	receipt_base64?: string | null;
	receipt_storage_bucket?: string | null;
	receipt_storage_path?: string | null;
}

export interface CreateReceiptUploadUrlPayload {
	receipt_filename: string;
	receipt_mime_type: string;
	receipt_size_bytes: number;
}

export interface ReceiptUploadResult {
	bucket: string;
	path: string;
	token: string;
	signed_url: string;
}

export interface ParsedReimbursementReceipt {
	amount: number | null;
	date: string | null;
	description: string | null;
	payment_iban: string | null;
	payment_bic: string | null;
}

export interface ReviewReimbursementRequestPayload {
	requestId: string;
	action: ReimbursementReviewAction;
	rejection_reason?: string;
}

export interface UpdateReimbursementDepartmentPayload {
	requestId: string;
	department: string;
}

export interface UpdateReimbursementFinanceLinksPayload {
	requestId: string;
	finance_project_id: string | null;
	finance_plan_item_id: string | null;
	bb_posting_external_id: string | null;
}

export interface SyncBuchhaltungsButlerPayload {
	requestId: string;
	force?: boolean;
}
