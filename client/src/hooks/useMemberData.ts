import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

/**
 * Read-only view of the member row. Profile edits go through the profile
 * contract (`useProfileQuery` / `useSaveProfile`); admins edit members through
 * `useAdminData`.
 */
export function useMemberData(userId: string) {
	const {
		data: member,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["member", userId],
		queryFn: async () => {
			return await apiClient(`/api/members/${userId}`, {
				method: "GET",
			});
		},
	});

	return { member, isLoading, error };
}
