import { useQuery } from "@tanstack/react-query";
import type { DepartmentReimbursementsResponse } from "@/features/reimbursements/reimbursementTypes";
import { apiClient } from "@/lib/apiClient";

/**
 * What the member's department has already submitted, in summary form.
 *
 * The key extends the key of the member's own list, so submitting or
 * resubmitting a request refreshes this list as well.
 */
export function useDepartmentReimbursements(userId: string) {
	const { data, isLoading, error } = useQuery({
		queryKey: ["reimbursement-requests", userId, "department"],
		queryFn: async () =>
			await apiClient<DepartmentReimbursementsResponse>(
				"/api/reimbursements/department",
			),
	});

	return {
		department: data?.department ?? null,
		requests: data?.requests ?? [],
		isLoading,
		error,
	};
}
