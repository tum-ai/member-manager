import {
	type ReimbursementSubmissionType,
	reimbursementRequiresPayout,
} from "@member-manager/shared";
import {
	ConflictError,
	DatabaseError,
	NotFoundError,
	ValidationError,
} from "./errors.js";
import {
	downloadStoredReceipt,
	REIMBURSEMENT_RECEIPT_BUCKET,
	removeStoredReceipt,
	stripReceiptDataUrlPrefix,
} from "./reimbursementReceipts.js";
import {
	encryptRecord,
	SENSITIVE_REIMBURSEMENT_FIELDS,
} from "./sensitiveData.js";
import { getSupabase } from "./supabase.js";

type ReimbursementRow = Record<string, unknown>;

type ResubmissionLogger = {
	warn: (obj: Record<string, unknown>, message: string) => void;
};

/** The corrected request fields, already validated by the route. */
export interface ResubmissionDetails {
	amount: number;
	date: string;
	description: string;
	department: string;
	submission_type: ReimbursementSubmissionType;
	/** Normalized IBAN; null for Vivid requests. */
	payment_iban: string | null;
	payment_bic: string | null;
}

/** A replacement receipt. Omitted when the member keeps the current one. */
export interface ResubmissionReceipt {
	filename: string;
	mimeType: string;
	base64: string | null;
	storageBucket: string | null;
	storagePath: string | null;
	sizeBytes: number | null;
}

export interface ResubmissionResult {
	row: ReimbursementRow;
	/** The rejection reason the member addressed. */
	previousRejectionReason: string;
	resubmissionCount: number;
}

/**
 * Checks that a direct-to-storage receipt upload exists, sits in the receipt
 * bucket, and lives under the uploader's own folder. Upload URLs are minted
 * per user (`${userId}/...`), so a path outside that folder is someone else's
 * file.
 */
export async function assertOwnedStoredReceipt({
	userId,
	bucket,
	path,
	mimeType,
}: {
	userId: string;
	bucket: string;
	path: string;
	mimeType?: string | null;
}): Promise<void> {
	if (bucket !== REIMBURSEMENT_RECEIPT_BUCKET) {
		throw new ValidationError("Unsupported receipt storage bucket");
	}
	if (!path.startsWith(`${userId}/`)) {
		throw new ValidationError("Receipt upload does not belong to this user.");
	}
	try {
		await downloadStoredReceipt({ bucket, path, expectedMimeType: mimeType });
	} catch {
		throw new ValidationError(
			"Receipt upload was not found. Upload the receipt again.",
		);
	}
}

function receiptFields(receipt: ResubmissionReceipt): ReimbursementRow {
	return {
		receipt_filename: receipt.filename,
		receipt_mime_type: receipt.mimeType,
		receipt_base64: receipt.base64
			? stripReceiptDataUrlPrefix(receipt.base64)
			: null,
		receipt_storage_bucket: receipt.storageBucket,
		receipt_storage_path: receipt.storagePath,
		receipt_size_bytes: receipt.sizeBytes,
	};
}

function storedReceiptLocation(
	row: ReimbursementRow,
): { bucket: string; path: string } | null {
	const path =
		typeof row.receipt_storage_path === "string"
			? row.receipt_storage_path.trim()
			: "";
	if (!path) return null;
	const bucket =
		typeof row.receipt_storage_bucket === "string" &&
		row.receipt_storage_bucket.trim()
			? row.receipt_storage_bucket.trim()
			: REIMBURSEMENT_RECEIPT_BUCKET;
	return { bucket, path };
}

/**
 * Sends the member's own rejected request back to review with their
 * corrections, on the same row.
 *
 * The request restarts the whole review: both approvals are cleared because
 * the content they approved has changed. The rejection reason moves to
 * `last_rejection_reason` so reviewers can check it was addressed. Reviewer-
 * owned fields (finance links, BuchhaltungsButler sync state) and `created_at`
 * are left as they are.
 */
export async function resubmitRejectedReimbursement({
	requestId,
	userId,
	details,
	receipt,
	log,
}: {
	requestId: string;
	userId: string;
	details: ResubmissionDetails;
	receipt: ResubmissionReceipt | null;
	log: ResubmissionLogger;
}): Promise<ResubmissionResult> {
	const { data: existing, error: fetchError } = await getSupabase()
		.from("reimbursements")
		.select("*")
		.eq("id", requestId)
		.eq("user_id", userId)
		.maybeSingle();
	if (fetchError) {
		throw new DatabaseError("Failed to load reimbursement request");
	}
	// Someone else's request answers like a missing one, so ids can't be probed.
	if (!existing) {
		throw new NotFoundError("Reimbursement request not found");
	}

	const existingRequest = existing as ReimbursementRow;
	if (existingRequest.approval_status !== "not_approved") {
		throw new ConflictError("Only rejected requests can be resubmitted");
	}

	const newStoredReceipt = receipt?.storagePath
		? {
				bucket: receipt.storageBucket ?? REIMBURSEMENT_RECEIPT_BUCKET,
				path: receipt.storagePath,
			}
		: null;
	if (receipt && newStoredReceipt) {
		await assertOwnedStoredReceipt({
			userId,
			bucket: newStoredReceipt.bucket,
			path: newStoredReceipt.path,
			mimeType: receipt.mimeType,
		});
	}

	const previousRejectionReason = String(
		existingRequest.rejection_reason ?? "",
	);
	const resubmissionCount =
		(Number(existingRequest.resubmission_count) || 0) + 1;
	const now = new Date().toISOString();
	const update = encryptRecord(
		{
			...details,
			description: details.description.trim(),
			department: details.department.trim(),
			...(receipt ? receiptFields(receipt) : {}),
			status: "requested",
			approval_status: "pending",
			payment_status: reimbursementRequiresPayout(details.submission_type)
				? "to_be_paid"
				: "not_required",
			rejection_reason: null,
			last_rejection_reason: previousRejectionReason || null,
			first_approved_at: null,
			first_approved_by: null,
			resubmission_count: resubmissionCount,
			resubmitted_at: now,
			updated_at: now,
		},
		SENSITIVE_REIMBURSEMENT_FIELDS,
	);

	// Re-check the state in the update itself so a double click can't
	// resubmit twice and bump the count past what the member did.
	const { data, error } = await getSupabase()
		.from("reimbursements")
		.update(update)
		.eq("id", requestId)
		.eq("user_id", userId)
		.eq("approval_status", "not_approved")
		.select()
		.maybeSingle();

	if (error || !data) {
		if (newStoredReceipt) {
			await removeStoredReceipt(newStoredReceipt);
		}
		if (error) {
			throw new DatabaseError("Failed to resubmit reimbursement request");
		}
		throw new ConflictError(
			"This request was already resubmitted. Reload to see its status.",
		);
	}

	// The replaced receipt is no longer referenced by any request.
	const oldStoredReceipt = storedReceiptLocation(existingRequest);
	if (
		receipt &&
		oldStoredReceipt &&
		oldStoredReceipt.path !== newStoredReceipt?.path
	) {
		try {
			await removeStoredReceipt(oldStoredReceipt);
		} catch (removeError) {
			log.warn(
				{ err: removeError, requestId },
				"Failed to remove replaced reimbursement receipt",
			);
		}
	}

	return {
		row: data as ReimbursementRow,
		previousRejectionReason,
		resubmissionCount,
	};
}
