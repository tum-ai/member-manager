import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../lib/apiClient";
import type { Member } from "../types";

export function useMembersListData() {
	const {
		data: members,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["members-list"],
		queryFn: async () => {
			return await apiClient<Member[]>("/api/members", {
				method: "GET",
			});
		},
	});

	return {
		members,
		isLoading,
		error,
	};
}
