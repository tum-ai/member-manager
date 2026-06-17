import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	BuchhaltungsButlerSyncStatus,
	CreateReimbursementRequestPayload,
	ParsedReimbursementReceipt,
	ParseReimbursementReceiptPayload,
	ReimbursementRequest,
	ReimbursementReviewIntegrationsResponse,
	ReimbursementReviewResponse,
	ReviewReimbursementRequestPayload,
	SyncBuchhaltungsButlerPayload,
	UpdateReimbursementDepartmentPayload,
} from "../features/reimbursements/reimbursementTypes";
import { apiClient } from "../lib/apiClient";
import { readJsonErrorMessage } from "../lib/httpErrors";
import { supabase } from "../lib/supabaseClient";

const REVIEW_RECEIPT_BULK_DOWNLOAD_URL =
	"/api/reimbursements/review/receipts/bulk-download";

function normalizeReviewResponse(
	response: ReimbursementRequest[] | ReimbursementReviewResponse | undefined,
): {
	requests: ReimbursementRequest[];
	bulkDownloadUrl: string | null;
	buchhaltungsButlerSyncStatus: BuchhaltungsButlerSyncStatus | null;
} {
	if (!response) {
		return {
			requests: [],
			bulkDownloadUrl: null,
			buchhaltungsButlerSyncStatus: null,
		};
	}

	if (Array.isArray(response)) {
		return {
			requests: response,
			bulkDownloadUrl: REVIEW_RECEIPT_BULK_DOWNLOAD_URL,
			buchhaltungsButlerSyncStatus: null,
		};
	}

	return {
		requests: response.requests ?? [],
		bulkDownloadUrl:
			response.receipt_endpoints?.bulk_download_url ??
			REVIEW_RECEIPT_BULK_DOWNLOAD_URL,
		buchhaltungsButlerSyncStatus:
			response.integrations?.buchhaltungsbutler ?? null,
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
		throw new Error(await readJsonErrorMessage(response));
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
	const { requests, bulkDownloadUrl, buchhaltungsButlerSyncStatus } =
		normalizeReviewResponse(reviewResponse);

	const {
		data: integrationsResponse,
		isLoading: isLoadingReviewIntegrations,
		error: reviewIntegrationsError,
	} = useQuery({
		queryKey: ["reimbursement-review-integrations"],
		queryFn: async () => {
			return await apiClient<ReimbursementReviewIntegrationsResponse>(
				"/api/reimbursements/review/integrations",
			);
		},
	});

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

	const buchhaltungsButlerSyncMutation = useMutation({
		mutationFn: async (payload: SyncBuchhaltungsButlerPayload) => {
			const { requestId, force } = payload;
			return await apiClient<ReimbursementRequest>(
				`/api/reimbursements/review/${requestId}/buchhaltungsbutler-sync`,
				{
					method: "POST",
					body: JSON.stringify({ force: Boolean(force) }),
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
		buchhaltungsButlerSyncStatus:
			integrationsResponse?.buchhaltungsbutler ?? buchhaltungsButlerSyncStatus,
		isLoadingBuchhaltungsButlerSyncStatus: isLoadingReviewIntegrations,
		buchhaltungsButlerSyncStatusError: reviewIntegrationsError,
		syncBuchhaltungsButlerAsync: buchhaltungsButlerSyncMutation.mutateAsync,
		isSyncingBuchhaltungsButler: buchhaltungsButlerSyncMutation.isPending,
		updateDepartmentAsync: departmentMutation.mutateAsync,
		isUpdatingDepartment: departmentMutation.isPending,
	};
}
