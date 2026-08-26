import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type {
	FinancePeriodType,
	FinanceProjectsResponse,
	FinanceTAccountResponse,
} from "@/features/finance/financeTypes";
import {
	type FinancePeriod,
	getDefaultFinancePeriod,
	switchFinancePeriodType,
} from "@/features/finance/financeUtils";
import { apiClient } from "@/lib/apiClient";
import { FINANCE_MANAGEMENT_QUERY_KEYS } from "./useFinanceManagement";

export const FINANCE_T_ACCOUNT_QUERY_KEY = "finance-t-account";

function buildPeriodDepartmentQuery(
	period: FinancePeriod,
	department: string,
): string {
	return new URLSearchParams({
		period_type: period.type,
		period_key: period.key,
		department,
	}).toString();
}

function buildTAccountEndpoint(
	period: FinancePeriod,
	department: string,
): string {
	return `/api/finance/t-account?${buildPeriodDepartmentQuery(period, department)}`;
}

// The T-account is always for exactly one department. A reviewer (canManage)
// picks the department; a scoped member is pinned to their own. The query only
// runs once a department is resolved, so LnF sees an explicit "pick a
// department" prompt instead of an error.
export function useFinanceTAccount({
	enabled = true,
	canManage,
	department,
}: {
	enabled?: boolean;
	canManage: boolean;
	department: string | null;
}) {
	const defaultPeriod = useMemo(() => getDefaultFinancePeriod(), []);
	const [period, setPeriod] = useState<FinancePeriod>(defaultPeriod);
	// Reviewers start without a selection; scoped members are fixed to their own.
	const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
		null,
	);

	const activeDepartment = canManage ? selectedDepartment : department;

	const { data, isLoading, isFetching, error } =
		useQuery<FinanceTAccountResponse>({
			queryKey: [
				FINANCE_T_ACCOUNT_QUERY_KEY,
				period.type,
				period.key,
				activeDepartment,
			],
			queryFn: async () =>
				await apiClient(
					buildTAccountEndpoint(period, activeDepartment as string),
				),
			enabled: enabled && Boolean(activeDepartment),
		});

	// The department's projects for this period back the "add to project" dialog
	// (FR-L2) and are refetched by the same invalidation as the T-account, so a
	// project created from the T-view appears in the picker immediately.
	const projectsQuery = useQuery<FinanceProjectsResponse>({
		queryKey: [
			FINANCE_MANAGEMENT_QUERY_KEYS.projects,
			period.type,
			period.key,
			activeDepartment,
		],
		queryFn: async () =>
			await apiClient(
				`/api/finance/projects?${buildPeriodDepartmentQuery(period, activeDepartment as string)}`,
			),
		enabled: enabled && Boolean(activeDepartment),
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
		canChooseDepartment: canManage,
		department: activeDepartment,
		response: data ?? null,
		groups: data?.groups ?? [],
		projects: projectsQuery.data?.projects ?? [],
		totals: data?.totals,
		source: data?.source,
		isLoading: Boolean(activeDepartment) && isLoading,
		isFetching,
		error: error as Error | null,
		setPeriodType,
		setPeriodKey,
		// Adopt a period wholesale — used when a drill-down (e.g. from the budget
		// overview) must open the T-account on the same period the user was viewing
		// instead of resetting to the default.
		setPeriod,
		setDepartment: setSelectedDepartment,
	};
}
