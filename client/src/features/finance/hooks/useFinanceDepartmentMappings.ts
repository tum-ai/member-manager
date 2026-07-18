import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import type {
	FinanceBereich,
	FinanceDateRange,
	FinanceDepartmentMappingsResponse,
} from "@/features/finance/financeTypes";
import { getDefaultFinanceDateRange } from "@/features/finance/financeUtils";
import { FINANCE_ANALYTICS_QUERY_KEY } from "@/features/finance/hooks/useFinanceAnalytics";
import { apiClient } from "@/lib/apiClient";

export const FINANCE_MAPPINGS_QUERY_KEY = "finance-department-mappings";

interface MappingUpsertInput {
	costLocation: string;
	department: string | null;
	bereich: FinanceBereich | null;
	note?: string | null;
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

export function useFinanceDepartmentMappings({
	enabled = true,
}: {
	enabled?: boolean;
} = {}) {
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const defaultRange = useMemo(() => getDefaultFinanceDateRange(), []);
	const [range] = useState<FinanceDateRange>(defaultRange);

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
						note: input.note ?? null,
					}),
				},
			),
		onSuccess: () => {
			showToast("Zuordnung gespeichert.", "success");
			void queryClient.invalidateQueries({
				queryKey: [FINANCE_MAPPINGS_QUERY_KEY],
			});
			void queryClient.invalidateQueries({
				queryKey: [FINANCE_ANALYTICS_QUERY_KEY],
			});
		},
		onError: (mutationError: unknown) => {
			showToast(
				mutationError instanceof Error
					? mutationError.message
					: "Zuordnung konnte nicht gespeichert werden.",
				"error",
			);
		},
	});

	return {
		rows: data?.rows ?? [],
		isLoading,
		isFetching,
		error: error as Error | null,
		saveMapping: mutation.mutate,
		isSaving: mutation.isPending,
		savingCostLocation: mutation.isPending
			? (mutation.variables?.costLocation ?? null)
			: null,
	};
}
