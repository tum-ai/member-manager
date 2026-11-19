import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { DepartmentReimbursementsResponse } from "@/features/reimbursements/reimbursementTypes";
import { apiClient } from "@/lib/apiClient";

/**
 * What the member's department has already submitted, in summary form, one
 * page at a time.
 *
 * The key extends the key of the member's own list, so submitting or
 * resubmitting a request refreshes this list as well.
 */
export function useDepartmentReimbursements(userId: string) {
	const [requestedPage, setRequestedPage] = useState(1);
	const { data, isLoading, isPlaceholderData, error } = useQuery({
		queryKey: ["reimbursement-requests", userId, "department", requestedPage],
		queryFn: async () =>
			await apiClient<DepartmentReimbursementsResponse>(
				`/api/reimbursements/department?page=${requestedPage}`,
			),
		// Keeps the current page on screen while the next one loads.
		placeholderData: keepPreviousData,
	});

	return {
		department: data?.department ?? null,
		requests: data?.requests ?? [],
		// The server's page: it answers with the last page when asked for one
		// past the end.
		page: data?.page ?? 1,
		pageCount: data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1,
		goToPage: setRequestedPage,
		isChangingPage: isPlaceholderData,
		isLoading,
		error,
	};
}
