import type { MemberDoorPin } from "@member-manager/shared";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export function memberDoorPinQueryKey(userId: string) {
	return ["door-pin", userId] as const;
}

/**
 * A member's office door PIN (`GET /api/members/:userId/door-pin`). Members
 * get `welcome_required` for their own PIN until they have saved a decision
 * on /welcome; admins always get the PIN.
 *
 * `gcTime: 0` drops the plaintext PIN from the query cache as soon as nothing
 * renders it. Pass `enabled: false` to fetch only on demand (`refetch`).
 */
export function useMemberDoorPin(
	userId: string,
	{ enabled = true }: { enabled?: boolean } = {},
) {
	const query = useQuery({
		queryKey: memberDoorPinQueryKey(userId),
		queryFn: async () =>
			(await apiClient(`/api/members/${userId}/door-pin`, {
				method: "GET",
			})) as MemberDoorPin,
		enabled,
		gcTime: 0,
	});

	return {
		doorPin: query.data,
		isLoading: query.isLoading,
		isFetching: query.isFetching,
		error: query.error,
	};
}
