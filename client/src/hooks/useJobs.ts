import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { fetchAllPartnerJobPages } from "../lib/jobs";

export type JobType =
	| "internship"
	| "working_student"
	| "full_time"
	| "thesis"
	| "other";

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

export type JobRequestStatus = "pending" | "approved" | "rejected";

export interface JobPostingRequestPayload {
	title: string;
	organization_name: string;
	logo_url?: string | null;
	description_markdown: string;
	call_to_action?: string | null;
	job_type: JobType;
	location: string;
	contact_name: string;
	contact_email: string;
	contact_role?: string | null;
	external_url?: string | null;
	expires_at?: string | null;
}

export interface JobPostingRequest extends JobPostingRequestPayload {
	id: string;
	user_id: string;
	status: JobRequestStatus;
	review_note?: string | null;
	reviewed_by?: string | null;
	reviewed_at?: string | null;
	published_at?: string | null;
	created_at?: string;
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
		mutationFn: async (payload: JobPostingRequestPayload) => {
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
