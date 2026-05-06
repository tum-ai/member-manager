import type {
	ReimbursementApprovalStatus,
	ReimbursementPaymentStatus,
	ReimbursementRequest,
} from "../../hooks/useReimbursementRequests";

export const ALL_REIMBURSEMENT_REVIEW_FILTER = "all";
export type ReimbursementReviewApprovalFilter =
	| ReimbursementApprovalStatus
	| typeof ALL_REIMBURSEMENT_REVIEW_FILTER;
export type ReimbursementReviewPaymentFilter =
	| ReimbursementPaymentStatus
	| typeof ALL_REIMBURSEMENT_REVIEW_FILTER;

export function formatReviewAmount(value: number): string {
	return new Intl.NumberFormat("de-DE", {
		style: "currency",
		currency: "EUR",
	}).format(Number(value));
}

export function formatReviewDate(value: string | undefined): string {
	if (!value) return "Not provided";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;

	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(date);
}

export function formatReviewStatus(value: string): string {
	return value
		.split("_")
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

export function getReviewStage(request: ReimbursementRequest): string {
	if (request.status === "paid" || request.payment_status === "paid") {
		return "Paid";
	}
	if (request.approval_status === "not_approved") {
		return "Rejected";
	}
	if (request.approval_status === "approved") {
		return "Ready for payment";
	}
	return "Needs approval";
}

export function getRequesterName(request: ReimbursementRequest): string {
	return (
		request.requester_name ??
		request.person_name ??
		request.personName ??
		request.user_id
	);
}

export function getRequesterEmail(request: ReimbursementRequest): string {
	return request.requester_email ?? request.email ?? "Not provided";
}

export function getPaymentIban(request: ReimbursementRequest): string {
	return request.payment_iban ?? request.iban ?? "Not provided";
}

export function getPaymentBic(request: ReimbursementRequest): string {
	return request.payment_bic ?? request.bic ?? "Not provided";
}

export function getBankName(request: ReimbursementRequest): string {
	return request.bank_name ?? request.payment_bank_name ?? "Not provided";
}

export function getReceiptLinks(request: ReimbursementRequest): {
	viewUrl: string | null;
	downloadUrl: string | null;
} {
	return {
		viewUrl:
			request.receipt_view_url ??
			request.receipt_url ??
			request.receiptUrl ??
			null,
		downloadUrl: request.receipt_download_url ?? null,
	};
}

export function hasReceiptEndpoint(request: ReimbursementRequest): boolean {
	const links = getReceiptLinks(request);
	return Boolean(links.viewUrl || links.downloadUrl);
}

export function matchesReimbursementReviewSearch(
	request: ReimbursementRequest,
	rawSearch: string,
): boolean {
	const search = rawSearch.trim().toLowerCase();
	if (!search) return true;

	return [
		getRequesterName(request),
		getRequesterEmail(request),
		getBankName(request),
		getPaymentIban(request),
		getPaymentBic(request),
		request.description,
		request.department,
		request.date,
		request.receipt_filename,
		String(request.amount),
	].some((value) => value?.toLowerCase().includes(search));
}
