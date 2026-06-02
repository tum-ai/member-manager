import type { Permission } from "@member-manager/shared";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";

// The current user's effective tool permissions, resolved by the server from
// their department (admins inherit everything). Used to gate tool visibility
// and protected routes on the client.
export function useToolAccess(): {
	permissions: Permission[];
	isLoading: boolean;
} {
	const { data, isLoading } = useQuery({
		queryKey: ["tool-access"],
		queryFn: async () =>
			await apiClient<{ permissions: Permission[] }>("/api/me/tool-access"),
	});

	return { permissions: data?.permissions ?? [], isLoading };
}
