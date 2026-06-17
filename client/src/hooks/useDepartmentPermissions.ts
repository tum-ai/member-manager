import type { DepartmentPermissionMap } from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

// Stable reference returned while the query is loading so effects keyed on
// `assignments` don't re-run on every render.
const EMPTY_ASSIGNMENTS: DepartmentPermissionMap = {};

// Admin-only view of the department→tool-permission matrix, with a mutation to
// replace it. Saving invalidates the cached matrix and this browser's resolved
// tool access; other clients pick up the change on their next fetch.
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
		assignments: data?.assignments ?? EMPTY_ASSIGNMENTS,
		isLoading,
		saveAssignmentsAsync: mutation.mutateAsync,
		isSaving: mutation.isPending,
	};
}
