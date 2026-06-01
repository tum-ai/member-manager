import type { DepartmentPermissionMap } from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";

// Admin-only view of the department→tool-permission matrix, with a mutation to
// replace it. Saving invalidates every user's resolved tool access.
export function useDepartmentPermissions(): {
	assignments: DepartmentPermissionMap;
	isLoading: boolean;
	saveAssignmentsAsync: (
		assignments: DepartmentPermissionMap,
	) => Promise<{ assignments: DepartmentPermissionMap }>;
	isSaving: boolean;
} {
	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["department-permissions"],
		queryFn: async () =>
			await apiClient<{ assignments: DepartmentPermissionMap }>(
				"/api/admin/department-permissions",
			),
	});

	const mutation = useMutation({
		mutationFn: async (assignments: DepartmentPermissionMap) =>
			await apiClient<{ assignments: DepartmentPermissionMap }>(
				"/api/admin/department-permissions",
				{
					method: "PUT",
					body: JSON.stringify({ assignments }),
				},
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["department-permissions"] });
			queryClient.invalidateQueries({ queryKey: ["tool-access"] });
		},
	});

	return {
		assignments: data?.assignments ?? {},
		isLoading,
		saveAssignmentsAsync: mutation.mutateAsync,
		isSaving: mutation.isPending,
	};
}
