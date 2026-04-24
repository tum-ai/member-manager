import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { EngagementFormSchema } from "../lib/schemas";

export interface EngagementCertificateRequest {
	id: string;
	user_id: string;
	status: "pending" | "approved" | "rejected";
	review_note?: string | null;
	engagements: EngagementFormSchema["engagements"];
	created_at?: string;
}

export function useEngagementCertificateRequests(userId: string) {
	const queryClient = useQueryClient();

	const {
		data: requests,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["engagement-certificate-requests", userId],
		queryFn: async () => {
			return await apiClient<EngagementCertificateRequest[]>(
				"/api/engagement-certificates",
			);
		},
	});

	const submitMutation = useMutation({
		mutationFn: async (payload: EngagementFormSchema) => {
			await apiClient("/api/engagement-certificates", {
				method: "POST",
				body: JSON.stringify(payload),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["engagement-certificate-requests", userId],
			});
			queryClient.invalidateQueries({
				queryKey: ["admin-engagement-certificate-requests"],
			});
		},
	});

	return {
		requests: requests ?? [],
		isLoading,
		error,
		submitRequestAsync: submitMutation.mutateAsync,
		isSubmitting: submitMutation.isPending,
	};
}
