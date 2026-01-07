import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type SepaSchema, sepaSchema } from "../lib/schemas";
import { supabase } from "../lib/supabaseClient";
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
			const { data, error } = await supabase
				.from("sepa")
				.select("*")
				.eq("user_id", userId)
				.single();
			if (error && error.code !== "PGRST116") throw error; // Ignore not found error
			return data as Sepa;
		},
	});

	const mutation = useMutation({
		mutationFn: async (data: SepaSchema) => {
			const { error } = await supabase
				.from("sepa")
				.upsert(data, { onConflict: "user_id" });
			if (error) throw error;
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
