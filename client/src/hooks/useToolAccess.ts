import type { Permission } from "@member-manager/shared";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

// The current user's effective tool permissions plus board membership,
// resolved by the server from their department (admins inherit everything).
// Used to gate tool visibility, protected routes, and board-only actions
// (e.g. signing a contract as the board) on the client.
export function useToolAccess(): {
	permissions: Permission[];
	isBoardMember: boolean;
	department: string | null;
	isLoading: boolean;
} {
	const { data, isLoading } = useQuery({
		queryKey: ["tool-access"],
		queryFn: async () =>
			await apiClient<{
				permissions: Permission[];
				isBoardMember: boolean;
				department: string | null;
			}>("/api/me/tool-access"),
	});

	return {
		permissions: data?.permissions ?? [],
		isBoardMember: data?.isBoardMember ?? false,
		department: data?.department ?? null,
		isLoading,
	};
}
