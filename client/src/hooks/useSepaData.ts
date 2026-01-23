import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { SepaSchema } from "../lib/schemas";
import type { Sepa } from "../types";

export function useSepaData(userId: string) {
	const queryClient = useQueryClient();

	const {
		data: sepa,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["sepa", userId],
		queryFn: async () => {
			return (await apiClient(`api/sepa/me`, {
				method: "GET",
			})) as Sepa;
		},
	});

	const mutation = useMutation({
		mutationFn: async (data: SepaSchema) => {
			return (await apiClient(`api/sepa/me`, {
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
