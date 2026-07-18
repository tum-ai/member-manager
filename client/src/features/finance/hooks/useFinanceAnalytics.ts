import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type {
	FinanceAnalyticsResponse,
	FinanceDateRange,
} from "@/features/finance/financeTypes";
import { getDefaultFinanceDateRange } from "@/features/finance/financeUtils";
import { apiClient } from "@/lib/apiClient";

export const FINANCE_ANALYTICS_QUERY_KEY = "finance-analytics";

function buildAnalyticsEndpoint(range: FinanceDateRange): string {
	const params = new URLSearchParams();
	if (range.dateFrom) {
		params.set("date_from", range.dateFrom);
	}
	if (range.dateTo) {
		params.set("date_to", range.dateTo);
	}
	const queryString = params.toString();
	return `/api/finance/analytics${queryString ? `?${queryString}` : ""}`;
}

export function useFinanceAnalytics() {
	const defaultRange = useMemo(() => getDefaultFinanceDateRange(), []);
	const [range, setRange] = useState<FinanceDateRange>(defaultRange);

	const { data, isLoading, isFetching, error, refetch } =
		useQuery<FinanceAnalyticsResponse>({
			queryKey: [FINANCE_ANALYTICS_QUERY_KEY, range.dateFrom, range.dateTo],
			queryFn: async () => await apiClient(buildAnalyticsEndpoint(range)),
		});

	function updateDateFrom(value: string) {
		setRange((current) => ({ ...current, dateFrom: value }));
	}

	function updateDateTo(value: string) {
		setRange((current) => ({ ...current, dateTo: value }));
	}

	return {
		range,
		analytics: data,
		isLoading,
		isFetching,
		error: error as Error | null,
		updateDateFrom,
		updateDateTo,
		refetch,
	};
}
