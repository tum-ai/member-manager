import type { ProfileResponse } from "@member-manager/shared";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export const profileQueryKey = (userId: string) => ["profile", userId] as const;

/**
 * The member's profile as the server stores it: personal data, bank details
 * and agreements, plus the version to echo back on save and the completeness
 * the server computed from stored data.
 */
export function useProfileQuery(userId: string) {
	return useQuery({
		queryKey: profileQueryKey(userId),
		queryFn: () => apiClient<ProfileResponse>(`/api/profile/${userId}`),
	});
}
