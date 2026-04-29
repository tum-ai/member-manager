import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";

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
	amount: number;
	date: string;
	description: string;
	department: string;
	submission_type: ReimbursementSubmissionType;
	payment_iban?: string | null;
	payment_bic?: string | null;
	receipt_filename?: string | null;
	receipt_mime_type?: string | null;
	status: ReimbursementStatus;
	approval_status: ReimbursementApprovalStatus;
	payment_status: ReimbursementPaymentStatus;
	rejection_reason?: string | null;
	created_at?: string;
	updated_at?: string;
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
		data: requests,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["reimbursement-review"],
		queryFn: async () => {
			return await apiClient<ReimbursementRequest[]>(
				"/api/reimbursements/review",
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

	return {
		requests: requests ?? [],
		isLoading,
		error,
		reviewRequestAsync: reviewMutation.mutateAsync,
		isReviewing: reviewMutation.isPending,
	};
}
