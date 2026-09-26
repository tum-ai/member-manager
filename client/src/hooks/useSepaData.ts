import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { ProfileSepa } from "@/lib/schemas";
import type { Sepa } from "@/types";

/**
 * The member's bank details and agreements. `GET /api/sepa/:userId` answers
 * 200 even when no bank details were ever saved (blank `iban`/`bic`/
 * `bank_name` plus the stored agreements), so `sepa` is only undefined while
 * loading or on a real error. `updateSepaAsync` with blank bank fields saves
 * the agreements alone.
 */

export function useSepaData(userId: string) {
	const queryClient = useQueryClient();

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

	const mutation = useMutation({
		mutationFn: async (data: ProfileSepa) => {
			return (await apiClient(`/api/sepa/${userId}`, {
				method: "PUT",
				body: JSON.stringify(data),
			})) as Sepa;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sepa", userId] });
		},
	});

	return {
		sepa,
		isLoading,
		error,
		updateSepa: mutation.mutate,
		updateSepaAsync: mutation.mutateAsync,
		isUpdating: mutation.isPending,
		updateError: mutation.error,
	};
}
