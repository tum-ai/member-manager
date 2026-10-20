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
	assertOwnedReceiptStoragePath,
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
	assertOwnedReceiptStoragePath(userId, path);
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
 * Deletes a receipt object unless some request still points at it. Two calls
 * can carry the same upload (a double click), and the losing call must not
 * delete the file the winner just attached. If the check itself fails, the
 * file is kept: an orphaned object is harmless, a missing receipt is not.
 */
async function removeReceiptIfUnreferenced(
	location: { bucket: string; path: string },
	log: ResubmissionLogger,
	requestId: string,
): Promise<void> {
	try {
		const { data, error } = await getSupabase()
			.from("reimbursements")
			.select("id")
			.eq("receipt_storage_path", location.path)
			.limit(1);
		if (error || (data ?? []).length > 0) return;
		await removeStoredReceipt(location);
	} catch (removeError) {
		log.warn(
			{ err: removeError, requestId },
			"Failed to remove unused reimbursement receipt",
		);
	}
}

/**
 * Sends the member's own rejected request back to review with their
 * corrections, on the same row.
 *
 * The request restarts the whole review: both approvals are cleared because
 * the content they approved has changed. The rejection reason moves to
 * `last_rejection_reason` so reviewers can check it was addressed. Reviewer-
 * owned fields (BuchhaltungsButler sync state, finance links while the
 * department stays the same) and `created_at` are left as they are.
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
	// Before #382 a paid request could still be rejected and keep
	// `payment_status: paid`. Resubmitting it would reset it to `to_be_paid`
	// and put money already sent back in the payout queue.
	if (
		existingRequest.payment_status === "paid" ||
		existingRequest.status === "paid"
	) {
		throw new ConflictError(
			"This request was already paid, so it can't be resubmitted",
		);
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
	const currentRevision = Number(existingRequest.resubmission_count) || 0;
	const resubmissionCount = currentRevision + 1;
	const department = details.department.trim();
	// Finance links are validated against the department
	// (`resolveReimbursementFinanceLinks`). A request moved to another
	// department drops them, and the reviewer assigns new ones.
	const financeLinkReset =
		department !== String(existingRequest.department ?? "").trim()
			? {
					finance_project_id: null,
					finance_plan_item_id: null,
					bb_posting_external_id: null,
				}
			: {};
	const now = new Date().toISOString();
	const update = encryptRecord(
		{
			...details,
			description: details.description.trim(),
			department,
			...financeLinkReset,
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

	// The update only applies to the exact version that was read: still
	// rejected, same review round, same payment state. A double click, or a
	// delayed call that arrives after another resubmit-and-reject round, can't
	// overwrite newer details or rejection history.
	const { data, error } = await getSupabase()
		.from("reimbursements")
		.update(update)
		.eq("id", requestId)
		.eq("user_id", userId)
		.eq("approval_status", "not_approved")
		.eq("resubmission_count", currentRevision)
		.eq("payment_status", existingRequest.payment_status)
		.select()
		.maybeSingle();

	if (error || !data) {
		if (newStoredReceipt) {
			await removeReceiptIfUnreferenced(newStoredReceipt, log, requestId);
		}
		if (error) {
			throw new DatabaseError("Failed to resubmit reimbursement request");
		}
		throw new ConflictError(
			"This request changed in the meantime. Reload to see its status.",
		);
	}

	const oldStoredReceipt = storedReceiptLocation(existingRequest);
	if (
		receipt &&
		oldStoredReceipt &&
		oldStoredReceipt.path !== newStoredReceipt?.path
	) {
		await removeReceiptIfUnreferenced(oldStoredReceipt, log, requestId);
	}

	return {
		row: data as ReimbursementRow,
		previousRejectionReason,
		resubmissionCount,
	};
}
