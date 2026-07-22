import type {
	BuchhaltungsButlerTransactionsResponse,
	FinancePlanItemsResponse,
	FinanceProjectsResponse,
} from "@member-manager/shared";
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type {
	BuchhaltungsButlerSyncStatus,
	CreateReceiptUploadUrlPayload,
	CreateReimbursementRequestPayload,
	ParsedReimbursementReceipt,
	ParseReimbursementReceiptPayload,
	ReceiptUploadResult,
	ReimbursementRequest,
	ReimbursementReviewIntegrationsResponse,
	ReimbursementReviewResponse,
	ReviewReimbursementRequestPayload,
	SyncBuchhaltungsButlerPayload,
	UpdateReimbursementDepartmentPayload,
	UpdateReimbursementFinanceLinksPayload,
} from "@/features/reimbursements/reimbursementTypes";
import { apiClient } from "@/lib/apiClient";
import { readJsonErrorMessage } from "@/lib/httpErrors";
import { supabase } from "@/lib/supabaseClient";

const REVIEW_RECEIPT_BULK_DOWNLOAD_URL =
	"/api/reimbursements/review/receipts/bulk-download";
const FINANCE_PLAN_ITEMS_QUERY_KEY = "finance-plan-items";

export interface UploadReceiptFileInput {
	file: File;
}

export interface UploadedReceiptFile {
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	storageBucket: string;
	storagePath: string;
}

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

	const receiptUploadMutation = useMutation({
		mutationFn: async ({ file }: UploadReceiptFileInput) => {
			const uploadUrl = await apiClient<ReceiptUploadResult>(
				"/api/reimbursements/receipt-upload-url",
				{
					method: "POST",
					body: JSON.stringify({
						receipt_filename: file.name,
						receipt_mime_type: file.type,
						receipt_size_bytes: file.size,
					} satisfies CreateReceiptUploadUrlPayload),
				},
			);

			const { error } = await supabase.storage
				.from(uploadUrl.bucket)
				.uploadToSignedUrl(uploadUrl.path, uploadUrl.token, file, {
					contentType: file.type,
				});
			if (error) {
				throw new Error(error.message || "Receipt upload failed");
			}

			return {
				fileName: file.name,
				mimeType: file.type,
				sizeBytes: file.size,
				storageBucket: uploadUrl.bucket,
				storagePath: uploadUrl.path,
			} satisfies UploadedReceiptFile;
		},
	});

	return {
		requests: requests ?? [],
		isLoading,
		error,
		createRequestAsync: createMutation.mutateAsync,
		isCreating: createMutation.isPending,
		uploadReceiptAsync: receiptUploadMutation.mutateAsync,
		isUploadingReceipt: receiptUploadMutation.isPending,
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
	const { data: financeProjectsResponse } = useQuery<FinanceProjectsResponse>({
		queryKey: ["finance-projects", "reimbursement-review"],
		queryFn: async () =>
			await apiClient<FinanceProjectsResponse>("/api/finance/projects"),
	});
	const financeProjects = financeProjectsResponse?.projects ?? [];
	const {
		data: financePostingsResponse,
		isLoading: isLoadingFinancePostings,
		error: financePostingsError,
	} = useQuery<BuchhaltungsButlerTransactionsResponse>({
		queryKey: [
			"finance-buchhaltungsbutler-transactions",
			"reimbursement-review",
		],
		queryFn: async () =>
			await apiClient<BuchhaltungsButlerTransactionsResponse>(
				"/api/finance/buchhaltungsbutler/transactions",
			),
	});
	const reviewDepartments = new Set(
		requests.map((request) => request.department).filter(Boolean),
	);
	const planItemScopes = Array.from(
		new Map(
			financeProjects
				.filter((project) => reviewDepartments.has(project.department))
				.map((project) => {
					const scope = {
						department: project.department,
						periodType: project.period_type,
						periodKey: project.period_key,
					};
					return [
						`${scope.department}:${scope.periodType}:${scope.periodKey}`,
						scope,
					] as const;
				}),
		).values(),
	);
	const financePlanItemQueries = useQueries({
		queries: planItemScopes.map((scope) => ({
			queryKey: [
				FINANCE_PLAN_ITEMS_QUERY_KEY,
				"reimbursement-review",
				scope.department,
				scope.periodType,
				scope.periodKey,
			],
			queryFn: async () => {
				const params = new URLSearchParams({
					department: scope.department,
					period_type: scope.periodType,
					period_key: scope.periodKey,
				});
				return await apiClient<FinancePlanItemsResponse>(
					`/api/finance/plan-items?${params.toString()}`,
				);
			},
		})),
	});
	const financePlanItems = Array.from(
		new Map(
			financePlanItemQueries
				.flatMap((query) => query.data?.items ?? [])
				.map((item) => [item.id, item] as const),
		).values(),
	);

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

	const financeLinksMutation = useMutation({
		mutationFn: async (payload: UpdateReimbursementFinanceLinksPayload) => {
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
		financeProjects,
		financePlanItems,
		financePostings: financePostingsResponse?.transactions ?? [],
		isLoadingFinancePostings,
		financePostingsError,
		updateFinanceLinksAsync: financeLinksMutation.mutateAsync,
		isUpdatingFinanceLinks: financeLinksMutation.isPending,
	};
}
