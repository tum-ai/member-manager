import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import type {
	FinanceAccountLabelsResponse,
	FinanceDateRange,
} from "@/features/finance/financeTypes";
import { FINANCE_ANALYTICS_QUERY_KEY } from "@/features/finance/hooks/useFinanceAnalytics";
import { apiClient } from "@/lib/apiClient";

export const FINANCE_ACCOUNT_LABELS_QUERY_KEY = "finance-account-labels";

interface AccountLabelUpsertInput {
	account: string;
	label: string | null;
	note: string | null;
}

function buildAccountLabelsEndpoint(range: FinanceDateRange): string {
	const params = new URLSearchParams();
	if (range.dateFrom) {
		params.set("date_from", range.dateFrom);
	}
	if (range.dateTo) {
		params.set("date_to", range.dateTo);
	}
	const queryString = params.toString();
	return `/api/finance/account-labels${queryString ? `?${queryString}` : ""}`;
}

export function useFinanceAccountLabels(
	range: FinanceDateRange,
	{ enabled = true }: { enabled?: boolean } = {},
) {
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const { data, isLoading, isFetching, error } =
		useQuery<FinanceAccountLabelsResponse>({
			queryKey: [
				FINANCE_ACCOUNT_LABELS_QUERY_KEY,
				range.dateFrom,
				range.dateTo,
			],
			queryFn: async () => await apiClient(buildAccountLabelsEndpoint(range)),
			enabled,
		});

	const mutation = useMutation({
		mutationFn: async (input: AccountLabelUpsertInput) =>
			await apiClient(
				`/api/finance/account-labels/${encodeURIComponent(input.account)}`,
				{
					method: "PUT",
					body: JSON.stringify({
						label: input.label,
						note: input.note,
					}),
				},
			),
		scope: { id: "finance-account-labels" },
		onSuccess: () => {
			showToast("Ledger account label saved.", "success");
			void queryClient.invalidateQueries({
				queryKey: [FINANCE_ACCOUNT_LABELS_QUERY_KEY],
			});
			void queryClient.invalidateQueries({
				queryKey: [FINANCE_ANALYTICS_QUERY_KEY],
			});
		},
		onError: (mutationError: unknown) => {
			showToast(
				mutationError instanceof Error
					? mutationError.message
					: "Could not save the ledger account label.",
				"error",
			);
		},
	});

	return {
		rows: data?.rows ?? [],
		isLoading,
		isFetching,
		error: error as Error | null,
		saveAccount: mutation.mutateAsync,
		isSaving: mutation.isPending,
		savingAccount: mutation.isPending
			? (mutation.variables?.account ?? null)
			: null,
	};
}
