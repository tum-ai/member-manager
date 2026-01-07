import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MemberSchema } from "../lib/schemas";
import { supabase } from "../lib/supabaseClient";
import type { Member } from "../types";

export function useMemberData(userId: string) {
	const queryClient = useQueryClient();

	const {
		data: member,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["member", userId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("members")
				.select("*")
				.eq("user_id", userId)
				.single();
			if (error) throw error;
			return data as Member;
		},
	});

	const mutation = useMutation({
		mutationFn: async (data: MemberSchema) => {
			const { error } = await supabase
				.from("members")
				.upsert(data, { onConflict: "user_id" });
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["member", userId] });
		},
	});

	return {
		member,
		isLoading,
		error,
		updateMember: mutation.mutate,
		updateMemberAsync: mutation.mutateAsync,
		isUpdating: mutation.isPending,
		updateError: mutation.error,
	};
}
