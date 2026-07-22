import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import type {
	FinanceBudgetVsActualResponse,
	FinancePeriodType,
} from "@/features/finance/financeTypes";
import {
	type FinancePeriod,
	getDefaultFinancePeriod,
	switchFinancePeriodType,
} from "@/features/finance/financeUtils";
import { apiClient } from "@/lib/apiClient";

export const FINANCE_BUDGETS_QUERY_KEY = "finance-budgets";

interface BudgetUpsertInput {
	department: string;
	amountPlanned: number;
	note?: string | null;
}

function buildBudgetsEndpoint(period: FinancePeriod): string {
	const params = new URLSearchParams({
		period_type: period.type,
		period_key: period.key,
	});
	return `/api/finance/budgets?${params.toString()}`;
}

export function useFinanceBudgets({
	enabled = true,
}: {
	enabled?: boolean;
} = {}) {
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const defaultPeriod = useMemo(() => getDefaultFinancePeriod(), []);
	const [period, setPeriod] = useState<FinancePeriod>(defaultPeriod);

	const { data, isLoading, isFetching, error } =
		useQuery<FinanceBudgetVsActualResponse>({
			queryKey: [FINANCE_BUDGETS_QUERY_KEY, period.type, period.key],
			queryFn: async () => await apiClient(buildBudgetsEndpoint(period)),
			enabled,
		});

	const mutation = useMutation({
		mutationFn: async (input: BudgetUpsertInput) =>
			await apiClient("/api/finance/budgets", {
				method: "PUT",
				body: JSON.stringify({
					department: input.department,
					period_type: period.type,
					period_key: period.key,
					amount_planned: input.amountPlanned,
					note: input.note ?? null,
				}),
			}),
		onSuccess: () => {
			showToast("Budget saved.", "success");
			void queryClient.invalidateQueries({
				queryKey: [FINANCE_BUDGETS_QUERY_KEY],
			});
		},
		onError: (mutationError: unknown) => {
			showToast(
				mutationError instanceof Error
					? mutationError.message
					: "Could not save the budget.",
				"error",
			);
		},
	});

	function setPeriodType(type: FinancePeriodType): void {
		setPeriod((current) =>
			current.type === type
				? current
				: switchFinancePeriodType(type, current.key),
		);
	}

	function setPeriodKey(key: string): void {
		setPeriod((current) => ({ ...current, key }));
	}

	return {
		period,
		rows: data?.rows ?? [],
		totals: data?.totals,
		source: data?.source,
		isLoading,
		isFetching,
		error: error as Error | null,
		saveBudget: mutation.mutate,
		savingDepartment: mutation.isPending
			? (mutation.variables?.department ?? null)
			: null,
		setPeriodType,
		setPeriodKey,
	};
}
