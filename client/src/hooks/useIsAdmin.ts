import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";

function isLocalSupabaseProject(): boolean {
	try {
		const supabaseUrl = new URL(import.meta.env.VITE_SUPABASE_URL);
		return (
			supabaseUrl.hostname === "127.0.0.1" ||
			supabaseUrl.hostname === "localhost"
		);
	} catch {
		return false;
	}
}

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

			if (isLocalSupabaseProject()) {
				try {
					await apiClient("/api/members/bootstrap-local-admin", {
						method: "POST",
					});
				} catch (error) {
					if (
						error instanceof Error &&
						/not in the local admin allowlist/i.test(error.message)
					) {
						// Not every local user should be admin; continue with a normal role read.
					} else {
						console.error("Failed to bootstrap local admin role:", error);
					}
				}
			}

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
