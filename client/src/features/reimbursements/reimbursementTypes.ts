export type ReimbursementSubmissionType = "reimbursement" | "invoice";
export type ReimbursementStatus = "requested" | "rejected" | "paid";
export type ReimbursementApprovalStatus =
	| "pending"
	| "approved"
	| "not_approved";
export type ReimbursementPaymentStatus = "to_be_paid" | "paid";
export type ReimbursementBuchhaltungsButlerSyncStatus =
	| "not_synced"
	| "pending"
	| "synced"
	| "failed";

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

export type ReimbursementReviewAction = "approve" | "reject" | "mark_paid";

export interface ReviewReimbursementRequestPayload {
	requestId: string;
	action: ReimbursementReviewAction;
	rejection_reason?: string;
}

export interface UpdateReimbursementDepartmentPayload {
	requestId: string;
	department: string;
}

export interface SyncBuchhaltungsButlerPayload {
	requestId: string;
	force?: boolean;
}
