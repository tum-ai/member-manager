import type {
	JobPostingFormInput,
	JobPostingInput,
	JobPostingRequest,
	JobType,
} from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { fetchAllPartnerJobPages } from "@/lib/jobs";

export type { JobPostingInput, JobPostingRequest, JobType };
export type JobPostingRequestPayload = JobPostingFormInput;

export interface PartnerJob {
	id: string;
	title: string;
	partner: {
		name: string;
		logo_url: string | null;
	};
	logo_url: string | null;
	description_markdown: string;
	call_to_action: string;
	job_type: JobType;
	location: string;
	contact: {
		name: string;
		email: string;
		role: string | null;
	};
	external_url: string | null;
	published_at: string;
	expires_at: string | null;
}

export interface PartnerJobsResponse {
	data: PartnerJob[];
	next_cursor: string | null;
}

export function useJobs() {
	const queryClient = useQueryClient();
	const {
		data: jobsResponse,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["partner-jobs"],
		queryFn: async () => {
			return await fetchAllPartnerJobPages<PartnerJob>(async (cursor) => {
				const params = new URLSearchParams({ limit: "200" });
				if (cursor) {
					params.set("cursor", cursor);
				}
				return await apiClient<PartnerJobsResponse>(`/api/jobs?${params}`, {
					method: "GET",
				});
			});
		},
	});

	const {
		data: jobRequests,
		isLoading: isLoadingRequests,
		error: requestsError,
	} = useQuery({
		queryKey: ["job-requests"],
		queryFn: async () => {
			return await apiClient<JobPostingRequest[]>("/api/jobs/requests", {
				method: "GET",
			});
		},
	});

	const submitJobRequestMutation = useMutation({
		mutationFn: async (payload: JobPostingFormInput) => {
			return await apiClient<JobPostingRequest>("/api/jobs/requests", {
				method: "POST",
				body: JSON.stringify(payload),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["job-requests"] });
			queryClient.invalidateQueries({ queryKey: ["admin-job-requests"] });
		},
	});

	return {
		jobs: jobsResponse?.data ?? [],
		nextCursor: jobsResponse?.next_cursor ?? null,
		jobRequests: jobRequests ?? [],
		isLoading,
		isLoadingRequests,
		error,
		requestsError,
		submitJobRequestAsync: submitJobRequestMutation.mutateAsync,
		isSubmittingJobRequest: submitJobRequestMutation.isPending,
	};
}
