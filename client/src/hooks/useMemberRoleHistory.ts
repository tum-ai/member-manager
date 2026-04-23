import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { MemberRole } from "../lib/constants";

export interface RoleHistoryEntry {
	id: string;
	user_id: string;
	role: MemberRole;
	semester: string | null;
	started_at: string | null;
	ended_at: string | null;
	note: string | null;
	created_at: string;
}

export interface NewRoleHistoryEntry {
	role: MemberRole;
	semester?: string | null;
	started_at?: string | null;
	ended_at?: string | null;
	note?: string | null;
}

export function useMemberRoleHistory(userId: string | null) {
	const queryClient = useQueryClient();
	const queryKey = ["member-role-history", userId ?? ""] as const;

	const { data, isLoading, error } = useQuery({
		queryKey,
		queryFn: async () => {
			if (!userId) return [] as RoleHistoryEntry[];
			return await apiClient<RoleHistoryEntry[]>(
				`/api/admin/members/${userId}/role-history`,
			);
		},
		enabled: !!userId,
	});

	const addEntry = useMutation({
		mutationFn: async (entry: NewRoleHistoryEntry) => {
			if (!userId) throw new Error("No user selected");
			return await apiClient<RoleHistoryEntry>(
				`/api/admin/members/${userId}/role-history`,
				{
					method: "POST",
					body: JSON.stringify(entry),
				},
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
		},
	});

	const deleteEntry = useMutation({
		mutationFn: async (entryId: string) => {
			if (!userId) throw new Error("No user selected");
			await apiClient(
				`/api/admin/members/${userId}/role-history/${entryId}`,
				{ method: "DELETE" },
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
		},
	});

	return {
		entries: data ?? [],
		isLoading,
		error,
		addEntry: addEntry.mutateAsync,
		isAdding: addEntry.isPending,
		deleteEntry: deleteEntry.mutateAsync,
		isDeleting: deleteEntry.isPending,
	};
}
