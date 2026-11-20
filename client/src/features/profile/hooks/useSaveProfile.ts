import type {
	ProfileResponse,
	ProfileUpdateInput,
} from "@member-manager/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { profileQueryKey } from "@/features/profile/hooks/useProfileQuery";
import { apiClient } from "@/lib/apiClient";

/** One atomic, versioned save for the whole profile (`PUT /api/profile/:id`). */
export function useSaveProfile(userId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (update: ProfileUpdateInput) =>
			apiClient<ProfileResponse>(`/api/profile/${userId}`, {
				method: "PUT",
				body: JSON.stringify(update),
			}),
		onSuccess: (saved) => {
			// The response is the new source of truth: it carries the new version.
			queryClient.setQueryData(profileQueryKey(userId), saved);
			// Other screens read the same rows through their own queries.
			for (const queryKey of [
				["member", userId],
				["sepa", userId],
				["members-list"],
				// Saving agreements can change the per-purpose consents (DB trigger).
				["member-consents", userId],
				["member-cv-consent", userId],
			]) {
				queryClient.invalidateQueries({ queryKey });
			}
		},
	});
}
