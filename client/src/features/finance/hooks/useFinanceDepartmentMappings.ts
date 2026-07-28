import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import type {
	FinanceBereich,
	FinanceDateRange,
	FinanceDepartmentMappingsResponse,
} from "@/features/finance/financeTypes";
import { FINANCE_ANALYTICS_QUERY_KEY } from "@/features/finance/hooks/useFinanceAnalytics";
import { FINANCE_BUDGETS_QUERY_KEY } from "@/features/finance/hooks/useFinanceBudgets";
import { FINANCE_PLAN_ITEMS_QUERY_KEY } from "@/features/finance/hooks/useFinancePlanItems";
import { apiClient } from "@/lib/apiClient";

export const FINANCE_MAPPINGS_QUERY_KEY = "finance-department-mappings";

interface MappingUpsertInput {
	costLocation: string;
	department: string | null;
	bereich: FinanceBereich | null;
	note: string | null;
}

function buildMappingsEndpoint(range: FinanceDateRange): string {
	const params = new URLSearchParams();
	if (range.dateFrom) {
		params.set("date_from", range.dateFrom);
	}
	if (range.dateTo) {
		params.set("date_to", range.dateTo);
	}
	const queryString = params.toString();
	return `/api/finance/department-mappings${
		queryString ? `?${queryString}` : ""
	}`;
}

export function useFinanceDepartmentMappings(
	range: FinanceDateRange,
	{ enabled = true }: { enabled?: boolean } = {},
) {
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const { data, isLoading, isFetching, error } =
		useQuery<FinanceDepartmentMappingsResponse>({
			queryKey: [FINANCE_MAPPINGS_QUERY_KEY, range.dateFrom, range.dateTo],
			queryFn: async () => await apiClient(buildMappingsEndpoint(range)),
			enabled,
		});

	const mutation = useMutation({
		mutationFn: async (input: MappingUpsertInput) =>
			await apiClient(
				`/api/finance/department-mappings/${encodeURIComponent(
					input.costLocation,
				)}`,
				{
					method: "PUT",
					body: JSON.stringify({
						department: input.department,
						bereich: input.bereich,
						note: input.note,
					}),
				},
			),
		scope: { id: "finance-department-mappings" },
		onSuccess: () => {
			showToast("Mapping saved.", "success");
			void queryClient.invalidateQueries({
				queryKey: [FINANCE_MAPPINGS_QUERY_KEY],
			});
			void queryClient.invalidateQueries({
				queryKey: [FINANCE_ANALYTICS_QUERY_KEY],
			});
			void queryClient.invalidateQueries({
				queryKey: [FINANCE_BUDGETS_QUERY_KEY],
			});
			void queryClient.invalidateQueries({
				queryKey: [FINANCE_PLAN_ITEMS_QUERY_KEY],
			});
		},
		onError: (mutationError: unknown) => {
			showToast(
				mutationError instanceof Error
					? mutationError.message
					: "Could not save the mapping.",
				"error",
			);
		},
	});

	return {
		rows: data?.rows ?? [],
		isLoading,
		isFetching,
		error: error as Error | null,
		saveMapping: mutation.mutateAsync,
		isSaving: mutation.isPending,
		savingCostLocation: mutation.isPending
			? (mutation.variables?.costLocation ?? null)
			: null,
	};
}
