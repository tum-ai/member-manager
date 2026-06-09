import { useQuery } from "@tanstack/react-query";
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

export function useJobs() {
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

	return {
		jobs: jobsResponse?.data ?? [],
		nextCursor: jobsResponse?.next_cursor ?? null,
		isLoading,
		error,
	};
}
