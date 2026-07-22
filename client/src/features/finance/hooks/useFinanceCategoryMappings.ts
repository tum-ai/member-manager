import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import type {
	FinanceCategoryMappingsResponse,
	FinanceDateRange,
} from "@/features/finance/financeTypes";
import { FINANCE_ANALYTICS_QUERY_KEY } from "@/features/finance/hooks/useFinanceAnalytics";
import { apiClient } from "@/lib/apiClient";

export const FINANCE_CATEGORY_MAPPINGS_QUERY_KEY = "finance-category-mappings";

interface CategoryUpsertInput {
	costLocationTwo: string;
	label: string | null;
	note: string | null;
}

function buildCategoryMappingsEndpoint(range: FinanceDateRange): string {
	const params = new URLSearchParams();
	if (range.dateFrom) {
		params.set("date_from", range.dateFrom);
	}
	if (range.dateTo) {
		params.set("date_to", range.dateTo);
	}
	const queryString = params.toString();
	return `/api/finance/category-mappings${
		queryString ? `?${queryString}` : ""
	}`;
}

export function useFinanceCategoryMappings(
	range: FinanceDateRange,
	{ enabled = true }: { enabled?: boolean } = {},
) {
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const { data, isLoading, isFetching, error } =
		useQuery<FinanceCategoryMappingsResponse>({
			queryKey: [
				FINANCE_CATEGORY_MAPPINGS_QUERY_KEY,
				range.dateFrom,
				range.dateTo,
			],
			queryFn: async () =>
				await apiClient(buildCategoryMappingsEndpoint(range)),
			enabled,
		});

	const mutation = useMutation({
		mutationFn: async (input: CategoryUpsertInput) =>
			await apiClient(
				`/api/finance/category-mappings/${encodeURIComponent(
					input.costLocationTwo,
				)}`,
				{
					method: "PUT",
					body: JSON.stringify({
						label: input.label,
						note: input.note,
					}),
				},
			),
		scope: { id: "finance-category-mappings" },
		onSuccess: () => {
			showToast("Kategorie gespeichert.", "success");
			void queryClient.invalidateQueries({
				queryKey: [FINANCE_CATEGORY_MAPPINGS_QUERY_KEY],
			});
			void queryClient.invalidateQueries({
				queryKey: [FINANCE_ANALYTICS_QUERY_KEY],
			});
		},
		onError: (mutationError: unknown) => {
			showToast(
				mutationError instanceof Error
					? mutationError.message
					: "Kategorie konnte nicht gespeichert werden.",
				"error",
			);
		},
	});

	return {
		rows: data?.rows ?? [],
		isLoading,
		isFetching,
		error: error as Error | null,
		saveCategory: mutation.mutateAsync,
		isSaving: mutation.isPending,
		savingCostLocationTwo: mutation.isPending
			? (mutation.variables?.costLocationTwo ?? null)
			: null,
	};
}
