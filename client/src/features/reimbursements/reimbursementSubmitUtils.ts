import {
	getReimbursementSubmissionTypeLabel,
	isValidIban,
} from "@member-manager/shared";
import type {
	ReimbursementRequest,
	ReimbursementSubmissionType,
} from "./reimbursementTypes";

export interface ReceiptState {
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	storageBucket: string;
	storagePath: string;
	/**
	 * The receipt already attached to a request being edited. It isn't sent
	 * on resubmit, which tells the server to keep it.
	 */
	existing?: boolean;
}

export interface FormValues {
	submissionType: ReimbursementSubmissionType;
	amount: string;
	date: string;
	description: string;
	department: string;
	paymentIban: string;
	paymentBic: string;
	receipt: ReceiptState | null;
}

export type FormErrors = Partial<
	Record<keyof FormValues | "receiptFile", string>
>;

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_RECEIPT_TYPES = new Set([
	"application/pdf",
	"image/jpeg",
	"image/jpg",
	"image/png",
]);

export const defaultValues: FormValues = {
	submissionType: "reimbursement",
	amount: "",
	date: "",
	description: "",
	department: "",
	paymentIban: "",
	paymentBic: "",
	receipt: null,
};

export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown error";
}

export function formatDate(value: string): string {
	return value
		? new Intl.DateTimeFormat("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			}).format(new Date(`${value}T00:00:00`))
		: "No date";
}

export function formatAmount(value: number): string {
	return new Intl.NumberFormat("de-DE", {
		style: "currency",
		currency: "EUR",
	}).format(Number(value));
}

export function getStatusLabel(request: ReimbursementRequest): string {
	if (request.approval_status === "not_approved") return "Not approved";
	if (
		request.payment_status === "not_required" &&
		request.approval_status === "approved"
	)
		return "No payment required";
	if (request.status === "paid" || request.payment_status === "paid")
		return "Paid";
	if (request.approval_status === "approved") return "Approved";
	if (request.first_approved_at) return "First approved";
	return "Pending";
}

export function getRequestTypeLabel(request: ReimbursementRequest): string {
	return getReimbursementSubmissionTypeLabel(request.submission_type);
}

export function sortRequestsByDateDesc(
	requests: ReimbursementRequest[],
): ReimbursementRequest[] {
	return [...requests].sort((left, right) => {
		const rightTime = new Date(right.created_at ?? right.date ?? "").getTime();
		const leftTime = new Date(left.created_at ?? left.date ?? "").getTime();
		const safeRightTime = Number.isNaN(rightTime) ? 0 : rightTime;
		const safeLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;

		return safeRightTime - safeLeftTime;
	});
}

export function readFileAsBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = String(reader.result ?? "");
			resolve(result.includes(",") ? result.split(",")[1] : result);
		};
		reader.onerror = () => reject(new Error("Could not read receipt file"));
		reader.readAsDataURL(file);
	});
}

/**
 * Only a rejected request can be edited and sent back to review. Mirrors the
 * server: a request that was already paid or booked in BuchhaltungsButler
 * before it was rejected (possible on older rows) stays closed.
 */
export function canResubmitRequest(request: ReimbursementRequest): boolean {
	return (
		request.approval_status === "not_approved" &&
		request.payment_status !== "paid" &&
		request.status !== "paid" &&
		request.bb_sync_status !== "synced" &&
		!request.bb_receipt_id_by_customer
	);
}

/** Form values for editing a rejected request, starting from what was submitted. */
export function buildEditValues(request: ReimbursementRequest): FormValues {
	const isVivid = request.submission_type === "vivid_reimbursement";
	return {
		submissionType: request.submission_type,
		amount: String(request.amount),
		date: request.date,
		description: request.description,
		department: request.department,
		paymentIban: isVivid ? "" : (request.payment_iban ?? request.iban ?? ""),
		paymentBic: isVivid ? "" : (request.payment_bic ?? request.bic ?? ""),
		receipt: request.receipt_filename
			? {
					fileName: request.receipt_filename,
					mimeType: request.receipt_mime_type ?? "",
					sizeBytes: 0,
					storageBucket: "",
					storagePath: "",
					existing: true,
				}
			: null,
	};
}

export function validateForm(values: FormValues): FormErrors {
	const errors: FormErrors = {};
	const amount = Number(values.amount);

	if (!values.amount || Number.isNaN(amount) || amount <= 0)
		errors.amount = "Enter a positive amount.";
	if (!values.date) errors.date = "Select the expense date.";
	if (!values.description.trim())
		errors.description = "Describe what this request is for.";
	if (!values.department) errors.department = "Select a department.";
	if (!values.receipt) errors.receiptFile = "Attach a receipt.";
	if (values.submissionType !== "vivid_reimbursement") {
		if (!values.paymentIban.trim()) {
			errors.paymentIban = "IBAN is required.";
		} else if (!isValidIban(values.paymentIban)) {
			errors.paymentIban = "Enter a valid IBAN.";
		}
		if (!values.paymentBic.trim()) errors.paymentBic = "BIC is required.";
	}

	return errors;
}
