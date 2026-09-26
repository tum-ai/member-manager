export type {
	ReimbursementApprovalStatus,
	ReimbursementBuchhaltungsButlerSyncStatus,
	ReimbursementPaymentStatus,
	ReimbursementRequest,
	ReimbursementReviewAction,
	ReimbursementStatus,
	ReimbursementSubmissionType,
} from "@member-manager/shared";

import type {
	ReimbursementRequest,
	ReimbursementReviewAction,
	ReimbursementSubmissionType,
} from "@member-manager/shared";

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
