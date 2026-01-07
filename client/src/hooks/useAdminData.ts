import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import type { Member, Sepa } from "../types";

interface AdminMember extends Member {
	sepa: Sepa;
}

export function useAdminData() {
	const queryClient = useQueryClient();

	const {
		data: members,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["admin-members"],
		queryFn: async () => {
			const { data: members, error: membersError } = await supabase
				.from("members")
				.select("*");
			const { data: sepa, error: sepaError } = await supabase
				.from("sepa")
				.select("*");

			if (membersError) throw membersError;
			if (sepaError) throw sepaError;

			if (!members) return [];

			// Join data manually since Supabase join syntax can be complex with strict types
			// biome-ignore lint/suspicious/noExplicitAny: Allow indexing
			const joined: AdminMember[] = members.map((member: any) => ({
				...member,
				// biome-ignore lint/suspicious/noExplicitAny: Allow indexing
				sepa: sepa?.find((s: any) => s.user_id === member.user_id) || {},
			}));

			return joined;
		},
	});

	const toggleStatusMutation = useMutation({
		mutationFn: async ({
			userId,
			newStatus,
		}: { userId: string; newStatus: boolean }) => {
			const { error } = await supabase
				.from("members")
				.update({ active: newStatus })
				.eq("user_id", userId);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-members"] });
		},
	});

	return {
		members,
		isLoading,
		error,
		toggleStatus: toggleStatusMutation.mutateAsync,
		isToggling: toggleStatusMutation.isPending,
	};
}
