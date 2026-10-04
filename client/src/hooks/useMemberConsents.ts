import type {
	MemberConsents,
	MemberConsentsInput,
} from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export function memberConsentsQueryKey(userId: string) {
	return ["member-consents", userId] as const;
}

/**
 * The member's per-purpose consents (`/api/members/:userId/consents`).
 * `consents.consents_decided_at === null` means they haven't decided yet,
 * which is what sends them to /welcome after login.
 */
export function useMemberConsents(userId: string) {
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: memberConsentsQueryKey(userId),
		queryFn: async () =>
			(await apiClient(`/api/members/${userId}/consents`, {
				method: "GET",
			})) as MemberConsents,
	});

	const mutation = useMutation({
		mutationFn: async (consents: MemberConsentsInput) =>
			(await apiClient(`/api/members/${userId}/consents`, {
				method: "PUT",
				body: JSON.stringify(consents),
			})) as MemberConsents,
		onSuccess: (saved) => {
			queryClient.setQueryData(memberConsentsQueryKey(userId), saved);
			// The CV panel's partner-sharing hint and the profile's agreement
			// checkboxes read the same stored consents through other endpoints.
			queryClient.invalidateQueries({
				queryKey: ["member-cv-consent", userId],
			});
			queryClient.invalidateQueries({ queryKey: ["sepa", userId] });
		},
	});

	return {
		consents: query.data,
		isLoading: query.isLoading,
		error: query.error,
		saveConsentsAsync: mutation.mutateAsync,
		isSaving: mutation.isPending,
	};
}
