import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import writeXlsxFile from "write-excel-file/browser";
import { useToast } from "@/contexts/ToastContext";
import type {
	BuchhaltungsButlerTransactionsResponse,
	FinanceDirectionFilter,
	FinanceFilters,
} from "@/features/finance/financeTypes";
import {
	buildFinanceExportRows,
	buildFinanceXlsxData,
	filterFinanceTransactions,
	getDefaultFinanceDateRange,
	summarizeFinanceTransactions,
} from "@/features/finance/financeUtils";
import { apiClient } from "@/lib/apiClient";

function buildTransactionsEndpoint(
	filters: Pick<FinanceFilters, "dateFrom" | "dateTo">,
): string {
	const params = new URLSearchParams();
	if (filters.dateFrom) {
		params.set("date_from", filters.dateFrom);
	}
	if (filters.dateTo) {
		params.set("date_to", filters.dateTo);
	}

	const queryString = params.toString();
	return `/api/finance/buchhaltungsbutler/transactions${
		queryString ? `?${queryString}` : ""
	}`;
}

export function useFinanceTransactions() {
	const { showToast } = useToast();
	const defaultRange = useMemo(() => getDefaultFinanceDateRange(), []);
	const [filters, setFilters] = useState<FinanceFilters>({
		...defaultRange,
		searchTerm: "",
		direction: "all",
	});

	const {
		data,
		isLoading,
		isFetching,
		error,
		refetch: refetchTransactions,
	} = useQuery<BuchhaltungsButlerTransactionsResponse>({
		queryKey: [
			"finance-buchhaltungsbutler-transactions",
			filters.dateFrom,
			filters.dateTo,
		],
		queryFn: async () => await apiClient(buildTransactionsEndpoint(filters)),
	});

	const transactions = data?.transactions ?? [];
	const filteredTransactions = useMemo(
		() => filterFinanceTransactions(transactions, filters),
		[transactions, filters],
	);
	const summary = useMemo(
		() => summarizeFinanceTransactions(filteredTransactions),
		[filteredTransactions],
	);

	function updateDateFrom(value: string) {
		setFilters((current) => ({ ...current, dateFrom: value }));
	}

	function updateDateTo(value: string) {
		setFilters((current) => ({ ...current, dateTo: value }));
	}

	function updateSearchTerm(value: string) {
		setFilters((current) => ({ ...current, searchTerm: value }));
	}

	function updateDirection(value: FinanceDirectionFilter) {
		setFilters((current) => ({ ...current, direction: value }));
	}

	async function exportTransactions() {
		if (filteredTransactions.length === 0) {
			showToast("No finance transactions to export.", "warning");
			return;
		}

		try {
			const data = buildFinanceXlsxData(
				buildFinanceExportRows(filteredTransactions),
			);
			await writeXlsxFile(data).toFile("buchhaltungsbutler_transactions.xlsx");
			showToast("Finance transactions exported.", "success");
		} catch {
			showToast("Could not generate the finance export.", "error");
		}
	}

	return {
		filters,
		transactions,
		filteredTransactions,
		summary,
		source: data?.source,
		generatedAt: data?.generated_at,
		isLoading,
		isFetching,
		error,
		updateDateFrom,
		updateDateTo,
		updateSearchTerm,
		updateDirection,
		refetchTransactions,
		exportTransactions,
	};
}
