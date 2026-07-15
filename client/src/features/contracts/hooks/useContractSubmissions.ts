import type {
	ContractCommentInput,
	ContractDraftSubmissionInput,
	ContractPartnerComment,
	ContractSignatureInput,
	ContractStatusEvent,
	ContractSubmission,
	ContractSubmissionInput,
	ContractSubmissionSummary,
	ContractSubmissionUpdateInput,
	RenderedContractDocument,
} from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contractQueryKeys } from "@/features/contracts/contractQueryKeys";
import { apiClient } from "@/lib/apiClient";

function useInvalidateSubmission(submissionId: string) {
	const queryClient = useQueryClient();
	return (includeStatusEvents = false) => {
		queryClient.invalidateQueries({
			queryKey: contractQueryKeys.submissions,
		});
		queryClient.invalidateQueries({
			queryKey: contractQueryKeys.submission(submissionId),
		});
		if (includeStatusEvents) {
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.statusEvents(submissionId),
			});
		}
	};
}

export function useContractSubmissions() {
	return useQuery({
		queryKey: contractQueryKeys.submissions,
		queryFn: () =>
			apiClient<ContractSubmissionSummary[]>("/api/contracts/submissions"),
	});
}

export function useContractSubmission(submissionId: string | undefined) {
	return useQuery({
		queryKey: contractQueryKeys.submission(submissionId),
		enabled: Boolean(submissionId),
		queryFn: () =>
			apiClient<ContractSubmission>(
				`/api/contracts/submissions/${submissionId}`,
			),
	});
}

export function useContractStatusEvents(submissionId: string | undefined) {
	return useQuery({
		queryKey: contractQueryKeys.statusEvents(submissionId),
		enabled: Boolean(submissionId),
		queryFn: () =>
			apiClient<ContractStatusEvent[]>(
				`/api/contracts/submissions/${submissionId}/status-events`,
			),
	});
}

export function useContractSubmissionPreview(
	submissionId: string | undefined,
	contractText: string,
) {
	return useQuery({
		queryKey: contractQueryKeys.submissionPreview(submissionId, contractText),
		enabled: Boolean(submissionId),
		staleTime: 5_000,
		queryFn: () =>
			apiClient<RenderedContractDocument>(
				`/api/contracts/submissions/${submissionId}/preview`,
				{
					method: "POST",
					body: JSON.stringify({ contract_text: contractText }),
				},
			),
	});
}

export function useCreateContractSubmission() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: ContractSubmissionInput) =>
			apiClient<ContractSubmission>("/api/contracts/submissions", {
				method: "POST",
				body: JSON.stringify(body),
			}),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.submissions,
			}),
	});
}

export function useUpdateContractDraft(submissionId: string) {
	const invalidateSubmission = useInvalidateSubmission(submissionId);
	return useMutation({
		mutationFn: (body: ContractDraftSubmissionInput) =>
			apiClient<ContractSubmission>(
				`/api/contracts/submissions/${submissionId}/draft`,
				{
					method: "PATCH",
					body: JSON.stringify(body),
				},
			),
		onSuccess: () => invalidateSubmission(),
	});
}

export function useUpdateContractSubmission(submissionId: string) {
	const invalidateSubmission = useInvalidateSubmission(submissionId);
	return useMutation({
		mutationFn: (body: ContractSubmissionUpdateInput) =>
			apiClient<ContractSubmission>(
				`/api/contracts/submissions/${submissionId}`,
				{
					method: "PATCH",
					body: JSON.stringify(body),
				},
			),
		onSuccess: () => invalidateSubmission(true),
	});
}

export function useContractSubmissionComments(
	submissionId: string | undefined,
) {
	return useQuery({
		queryKey: contractQueryKeys.comments(submissionId),
		enabled: Boolean(submissionId),
		queryFn: () =>
			apiClient<ContractPartnerComment[]>(
				`/api/contracts/submissions/${submissionId}/comments`,
			),
	});
}

export function useCreateContractSubmissionComment(submissionId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: ContractCommentInput) =>
			apiClient<ContractPartnerComment>(
				`/api/contracts/submissions/${submissionId}/comments`,
				{
					method: "POST",
					body: JSON.stringify(body),
				},
			),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.comments(submissionId),
			});
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.submission(submissionId),
			});
		},
	});
}

export function useBoardSignContractSubmission(submissionId: string) {
	const invalidateSubmission = useInvalidateSubmission(submissionId);
	return useMutation({
		mutationFn: (body: ContractSignatureInput) =>
			apiClient<ContractSubmission>(
				`/api/contracts/submissions/${submissionId}/board-signature`,
				{
					method: "POST",
					body: JSON.stringify(body),
				},
			),
		onSuccess: () => invalidateSubmission(true),
	});
}

export function useFinalizeContractSubmission(submissionId: string) {
	const invalidateSubmission = useInvalidateSubmission(submissionId);
	return useMutation({
		mutationFn: () =>
			apiClient<ContractSubmission>(
				`/api/contracts/submissions/${submissionId}/finalize`,
				{ method: "POST" },
			),
		onSuccess: () => invalidateSubmission(true),
	});
}
