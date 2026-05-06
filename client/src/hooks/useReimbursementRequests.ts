import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";

export type ReimbursementSubmissionType = "reimbursement" | "invoice";
export type ReimbursementStatus = "requested" | "rejected" | "paid";
export type ReimbursementApprovalStatus =
	| "pending"
	| "approved"
	| "not_approved";
export type ReimbursementPaymentStatus = "to_be_paid" | "paid";

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
	created_at?: string;
	updated_at?: string;
}

interface ReimbursementReviewResponse {
	requests: ReimbursementRequest[];
	receipt_endpoints?: {
		bulk_download_url?: string | null;
	} | null;
}

const REVIEW_RECEIPT_BULK_DOWNLOAD_URL =
	"/api/reimbursements/review/receipts/bulk-download";

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
	receipt_base64: string;
}

export interface ParseReimbursementReceiptPayload {
	receipt_filename: string;
	receipt_mime_type: string;
	receipt_base64: string;
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

function normalizeReviewResponse(
	response: ReimbursementRequest[] | ReimbursementReviewResponse | undefined,
): {
	requests: ReimbursementRequest[];
	bulkDownloadUrl: string | null;
} {
	if (!response) {
		return { requests: [], bulkDownloadUrl: null };
	}

	if (Array.isArray(response)) {
		return {
			requests: response,
			bulkDownloadUrl: REVIEW_RECEIPT_BULK_DOWNLOAD_URL,
		};
	}

	return {
		requests: response.requests ?? [],
		bulkDownloadUrl:
			response.receipt_endpoints?.bulk_download_url ??
			REVIEW_RECEIPT_BULK_DOWNLOAD_URL,
	};
}

async function apiBlobClient(
	endpoint: string,
	options: RequestInit = {},
): Promise<Blob> {
	const {
		data: { session },
	} = await supabase.auth.getSession();
	const token = session?.access_token;
	const hasBody = options.body !== undefined && options.body !== null;

	const response = await fetch(endpoint, {
		...options,
		headers: {
			...(hasBody ? { "Content-Type": "application/json" } : {}),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...options.headers,
		},
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error || response.statusText);
	}

	return response.blob();
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

function openBlob(blob: Blob): void {
	const url = URL.createObjectURL(blob);
	window.open(url, "_blank", "noopener,noreferrer");
	window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function useReimbursementRequests(userId: string) {
	const queryClient = useQueryClient();

	const {
		data: requests,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["reimbursement-requests", userId],
		queryFn: async () => {
			return await apiClient<ReimbursementRequest[]>("/api/reimbursements");
		},
	});

	const createMutation = useMutation({
		mutationFn: async (payload: CreateReimbursementRequestPayload) => {
			return await apiClient<ReimbursementRequest>("/api/reimbursements", {
				method: "POST",
				body: JSON.stringify(payload),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["reimbursement-requests", userId],
			});
		},
	});

	const parseReceiptMutation = useMutation({
		mutationFn: async (payload: ParseReimbursementReceiptPayload) => {
			return await apiClient<ParsedReimbursementReceipt>(
				"/api/reimbursements/parse-receipt",
				{
					method: "POST",
					body: JSON.stringify(payload),
				},
			);
		},
	});

	return {
		requests: requests ?? [],
		isLoading,
		error,
		createRequestAsync: createMutation.mutateAsync,
		isCreating: createMutation.isPending,
		parseReceiptAsync: parseReceiptMutation.mutateAsync,
		isParsingReceipt: parseReceiptMutation.isPending,
	};
}

export function useReimbursementReview() {
	const queryClient = useQueryClient();

	const {
		data: reviewResponse,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["reimbursement-review"],
		queryFn: async () => {
			return await apiClient<
				ReimbursementRequest[] | ReimbursementReviewResponse
			>("/api/reimbursements/review");
		},
	});
	const { requests, bulkDownloadUrl } = normalizeReviewResponse(reviewResponse);

	const reviewMutation = useMutation({
		mutationFn: async (payload: ReviewReimbursementRequestPayload) => {
			const { requestId, ...body } = payload;
			return await apiClient<ReimbursementRequest>(
				`/api/reimbursements/review/${requestId}`,
				{
					method: "PATCH",
					body: JSON.stringify(body),
				},
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reimbursement-review"] });
		},
	});

	const departmentMutation = useMutation({
		mutationFn: async (payload: UpdateReimbursementDepartmentPayload) => {
			const { requestId, department } = payload;
			return await apiClient<ReimbursementRequest>(
				`/api/reimbursements/review/${requestId}`,
				{
					method: "PATCH",
					body: JSON.stringify({ department }),
				},
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reimbursement-review"] });
		},
	});

	const bulkDownloadReceiptsMutation = useMutation({
		mutationFn: async (requestIds: string[]) => {
			if (!bulkDownloadUrl) {
				throw new Error("Bulk receipt download is not available");
			}

			const blob = await apiBlobClient(bulkDownloadUrl, {
				method: "POST",
				body: JSON.stringify({ request_ids: requestIds }),
			});
			downloadBlob(blob, "reimbursement-receipts.zip");
			return blob;
		},
	});

	const openReceiptMutation = useMutation({
		mutationFn: async (request: ReimbursementRequest) => {
			if (!request.receipt_view_url) {
				throw new Error("Receipt is not available");
			}

			const blob = await apiBlobClient(request.receipt_view_url);
			openBlob(blob);
			return blob;
		},
	});

	const downloadReceiptMutation = useMutation({
		mutationFn: async (request: ReimbursementRequest) => {
			if (!request.receipt_download_url) {
				throw new Error("Receipt is not available");
			}

			const blob = await apiBlobClient(request.receipt_download_url);
			downloadBlob(blob, request.receipt_filename ?? "receipt.pdf");
			return blob;
		},
	});

	return {
		requests,
		isLoading,
		error,
		reviewRequestAsync: reviewMutation.mutateAsync,
		isReviewing: reviewMutation.isPending,
		canBulkDownloadReceipts: Boolean(bulkDownloadUrl),
		bulkDownloadReceiptsAsync: bulkDownloadReceiptsMutation.mutateAsync,
		isBulkDownloadingReceipts: bulkDownloadReceiptsMutation.isPending,
		openReceiptAsync: openReceiptMutation.mutateAsync,
		downloadReceiptAsync: downloadReceiptMutation.mutateAsync,
		updateDepartmentAsync: departmentMutation.mutateAsync,
		isUpdatingDepartment: departmentMutation.isPending,
	};
}
