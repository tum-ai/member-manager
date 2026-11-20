import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { Sepa } from "@/types";

/**
 * The member's bank details and agreements (read-only).
 * `GET /api/sepa/:userId` answers 200 even when no bank details were ever
 * saved (blank `iban`/`bic`/`bank_name` plus the stored agreements), so `sepa`
 * is only undefined while loading or on a real error. Profile edits go through
 * `useSaveProfile`.
 */
export function useSepaData(userId: string) {
	const {
		data: sepa,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["sepa", userId],
		queryFn: async () => {
			return (await apiClient(`/api/sepa/${userId}`, {
				method: "GET",
			})) as Sepa;
		},
	});

	return { sepa, isLoading, error };
}
