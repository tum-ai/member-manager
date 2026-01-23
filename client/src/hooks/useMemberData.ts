import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { MemberSchema } from "../lib/schemas";

export function useMemberData(userId: string) {
	const queryClient = useQueryClient();

	const {
		data: member,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["member", userId],
		queryFn: async () => {
			return await apiClient(`api/members/me`, {
				method: "GET",
			});
		},
	});

	const mutation = useMutation({
		mutationFn: async (data: MemberSchema) => {
			await apiClient(`api/members/me`, {
				method: "PUT",
				body: JSON.stringify(data),
			});
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
