import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";

export interface MemberChangeRequestPayload {
	changes: {
		department?: string | null;
		member_role?: string | null;
		degree?: string | null;
		school?: string | null;
		batch?: string | null;
	};
	reason?: string;
}

export interface MemberChangeRequest extends MemberChangeRequestPayload {
	id: string;
	user_id: string;
	status: "pending" | "approved" | "rejected";
	review_note?: string | null;
	created_at?: string;
}

export function useMemberChangeRequests(userId: string) {
	const queryClient = useQueryClient();

	const {
		data: requests,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["member-change-requests", userId],
		queryFn: async () => {
			return await apiClient<MemberChangeRequest[]>(
				"/api/member-change-requests",
			);
		},
	});

	const submitMutation = useMutation({
		mutationFn: async (payload: MemberChangeRequestPayload) => {
			await apiClient("/api/member-change-requests", {
				method: "POST",
				body: JSON.stringify(payload),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["member-change-requests", userId],
			});
			queryClient.invalidateQueries({
				queryKey: ["admin-member-change-requests"],
			});
		},
	});

	return {
		requests: requests ?? [],
		isLoading,
		error,
		submitChangeRequestAsync: submitMutation.mutateAsync,
		isSubmitting: submitMutation.isPending,
	};
}
