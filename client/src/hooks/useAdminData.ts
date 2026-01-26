import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { Member, Sepa } from "../types";

interface AdminMember extends Member {
	sepa: Sepa;
}

interface AdminResponse {
	data: AdminMember[];
	total: number;
	page: number;
	limit: number;
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
			const response = await apiClient<AdminResponse>(
				"/api/admin/members?limit=1000",
			);
			return response.data;
		},
	});

	const toggleStatusMutation = useMutation({
		mutationFn: async ({
			userId,
			newStatus,
		}: {
			userId: string;
			newStatus: boolean;
		}) => {
			await apiClient(`/api/admin/members/${userId}/status`, {
				method: "PATCH",
				body: JSON.stringify({ active: newStatus }),
			});
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
