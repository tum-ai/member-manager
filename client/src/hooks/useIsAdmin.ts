import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

// Reads the current user's role from the public `user_roles` table.
// RLS policy `users_read_their_row` lets authenticated users read their own
// row, so we don't need a dedicated backend endpoint for this check.
export function useIsAdmin(userId: string | undefined): {
	isAdmin: boolean;
	isLoading: boolean;
} {
	const { data, isLoading } = useQuery({
		queryKey: ["user-role", userId],
		enabled: Boolean(userId),
		queryFn: async () => {
			if (!userId) return null;
			const { data, error } = await supabase
				.from("user_roles")
				.select("role")
				.eq("user_id", userId)
				.maybeSingle();

			if (error) {
				console.error("Failed to fetch user role:", error);
				return null;
			}
			return data?.role ?? null;
		},
	});

	return { isAdmin: data === "admin", isLoading };
}
