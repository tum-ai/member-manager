import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import type {
	FinancePeriodType,
	FinancePlanDirection,
	FinancePlanItem,
	FinancePlanItemsResponse,
	FinancePlanStatus,
} from "@/features/finance/financeTypes";
import {
	type FinancePeriod,
	getDefaultFinancePeriod,
	switchFinancePeriodType,
} from "@/features/finance/financeUtils";
import { apiClient } from "@/lib/apiClient";

export const FINANCE_PLAN_ITEMS_QUERY_KEY = "finance-plan-items";

export interface PlanItemCreateInput {
	department: string;
	label: string;
	category: string | null;
	direction?: FinancePlanDirection;
	plannedAmount: number;
	expectedMonth: string | null;
	status: FinancePlanStatus;
	note?: string | null;
}

export interface PlanItemUpdateInput {
	id: string;
	label: string;
	category: string | null;
	direction?: FinancePlanDirection;
	plannedAmount: number;
	expectedMonth: string | null;
	status: FinancePlanStatus;
	note?: string | null;
}

function buildPlanItemsEndpoint(period: FinancePeriod): string {
	const params = new URLSearchParams({
		period_type: period.type,
		period_key: period.key,
	});
	return `/api/finance/plan-items?${params.toString()}`;
}

export function useFinancePlanItems({
	enabled = true,
}: {
	enabled?: boolean;
} = {}) {
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const defaultPeriod = useMemo(() => getDefaultFinancePeriod(), []);
	const [period, setPeriod] = useState<FinancePeriod>(defaultPeriod);

	const { data, isLoading, isFetching, error } =
		useQuery<FinancePlanItemsResponse>({
			queryKey: [FINANCE_PLAN_ITEMS_QUERY_KEY, period.type, period.key],
			queryFn: async () => await apiClient(buildPlanItemsEndpoint(period)),
			enabled,
		});

	function invalidate(): void {
		void queryClient.invalidateQueries({
			queryKey: [FINANCE_PLAN_ITEMS_QUERY_KEY],
		});
	}

	function reportError(err: unknown, fallback: string): void {
		showToast(err instanceof Error ? err.message : fallback, "error");
	}

	const createMutation = useMutation({
		mutationFn: async (input: PlanItemCreateInput) =>
			await apiClient<FinancePlanItem>("/api/finance/plan-items", {
				method: "POST",
				body: JSON.stringify({
					department: input.department,
					period_type: period.type,
					period_key: period.key,
					label: input.label,
					category: input.category,
					direction: input.direction ?? "expense",
					planned_amount: input.plannedAmount,
					expected_month: input.expectedMonth,
					status: input.status,
					note: input.note ?? null,
				}),
			}),
		onSuccess: () => {
			showToast("Plan item added.", "success");
			invalidate();
		},
		onError: (err) => reportError(err, "Could not create the plan item."),
	});

	const updateMutation = useMutation({
		mutationFn: async (input: PlanItemUpdateInput) =>
			await apiClient<FinancePlanItem>(
				`/api/finance/plan-items/${encodeURIComponent(input.id)}`,
				{
					method: "PUT",
					body: JSON.stringify({
						label: input.label,
						category: input.category,
						direction: input.direction ?? "expense",
						planned_amount: input.plannedAmount,
						expected_month: input.expectedMonth,
						status: input.status,
						note: input.note ?? null,
					}),
				},
			),
		onSuccess: () => {
			showToast("Plan item updated.", "success");
			invalidate();
		},
		onError: (err) => reportError(err, "Could not save the plan item."),
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) =>
			await apiClient(`/api/finance/plan-items/${encodeURIComponent(id)}`, {
				method: "DELETE",
			}),
		onSuccess: () => {
			showToast("Plan item deleted.", "success");
			invalidate();
		},
		onError: (err) => reportError(err, "Could not delete the plan item."),
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
		items: data?.items ?? [],
		totals: data?.totals,
		isLoading,
		isFetching,
		error: error as Error | null,
		createItem: createMutation.mutate,
		updateItem: updateMutation.mutate,
		deleteItem: deleteMutation.mutate,
		isMutating:
			createMutation.isPending ||
			updateMutation.isPending ||
			deleteMutation.isPending,
		setPeriodType,
		setPeriodKey,
	};
}
