import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import { summarizeAllocationResults } from "@/features/finance/financeTAccountUtils";
import type {
	FinanceAllocationResult,
	FinanceBereich,
	FinancePeriodType,
	FinancePostingAllocationBulkResponse,
	FinanceProject,
	FinanceProjectFromPostingsResponse,
	FinanceProjectStatus,
} from "@/features/finance/financeTypes";
import { apiClient } from "@/lib/apiClient";
import { FINANCE_MANAGEMENT_QUERY_KEYS } from "./useFinanceManagement";
import { FINANCE_T_ACCOUNT_QUERY_KEY } from "./useFinanceTAccount";

// Everything the two project dialogs collect. `postingExternalIds` empty means
// "just create the folder" (FR-L3); non-empty means "create it from this
// selection" (FR-L1), which is one atomic server call, never an N+1 loop.
export interface TAccountProjectInput {
	name: string;
	parentProjectId: string | null;
	subTeam: string | null;
	taxArea: FinanceBereich | null;
	targetAmount: number;
	status: FinanceProjectStatus;
	postingExternalIds: string[];
}

export interface TAccountAssignInput {
	projectId: string;
	postingExternalIds: string[];
}

export function useFinanceTAccountActions({
	department,
	period,
	onApplied,
}: {
	department: string | null;
	period: { type: FinancePeriodType; key: string };
	// Called after a write that consumed the selection, so the caller can clear it
	// (FR-K7). Not called when nothing was applied.
	onApplied?: () => void;
}) {
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	function invalidate(): void {
		void queryClient.invalidateQueries({
			queryKey: [FINANCE_T_ACCOUNT_QUERY_KEY],
		});
		void queryClient.invalidateQueries({
			queryKey: [FINANCE_MANAGEMENT_QUERY_KEYS.projects],
		});
	}

	function reportError(error: unknown, fallback: string): void {
		showToast(error instanceof Error ? error.message : fallback, "error");
	}

	// A partial success is still a success: the applied postings stay applied and
	// the skips are named rather than swallowed (FR-L6).
	function reportResults(
		results: FinanceAllocationResult[],
		prefix?: string,
	): void {
		const summary = summarizeAllocationResults(results);
		showToast(
			prefix ? `${prefix} ${summary.message}` : summary.message,
			summary.hasSkips ? "warning" : "success",
		);
	}

	function projectBody(input: TAccountProjectInput) {
		return {
			name: input.name,
			parent_project_id: input.parentProjectId,
			sub_team: input.subTeam,
			department,
			period_type: period.type,
			period_key: period.key,
			tax_area: input.taxArea,
			target_amount: input.targetAmount,
			status: input.status,
		};
	}

	const createProjectMutation = useMutation({
		mutationFn: async (input: TAccountProjectInput) => {
			if (input.postingExternalIds.length === 0) {
				const project = await apiClient<FinanceProject>(
					"/api/finance/projects",
					{ method: "POST", body: JSON.stringify(projectBody(input)) },
				);
				return { project, results: [] };
			}
			return await apiClient<FinanceProjectFromPostingsResponse>(
				"/api/finance/projects/from-postings",
				{
					method: "POST",
					body: JSON.stringify({
						...projectBody(input),
						posting_external_ids: input.postingExternalIds,
					}),
				},
			);
		},
		onSuccess: (data) => {
			if (data.results.length === 0) {
				showToast(`Projekt „${data.project.name}" angelegt.`, "success");
			} else {
				reportResults(data.results, `Projekt „${data.project.name}" angelegt.`);
			}
			onApplied?.();
			invalidate();
		},
		onError: (error) =>
			reportError(error, "Projekt konnte nicht angelegt werden."),
	});

	const assignMutation = useMutation({
		mutationFn: async (input: TAccountAssignInput) =>
			await apiClient<FinancePostingAllocationBulkResponse>(
				"/api/finance/posting-allocations/bulk",
				{
					method: "POST",
					body: JSON.stringify({
						project_id: input.projectId,
						posting_external_ids: input.postingExternalIds,
					}),
				},
			),
		onSuccess: (data) => {
			reportResults(data.results);
			onApplied?.();
			invalidate();
		},
		onError: (error) =>
			reportError(error, "Zuordnung konnte nicht gespeichert werden."),
	});

	return {
		createProject: async (input: TAccountProjectInput) => {
			await createProjectMutation.mutateAsync(input);
		},
		assignToProject: async (input: TAccountAssignInput) => {
			await assignMutation.mutateAsync(input);
		},
		isCreatingProject: createProjectMutation.isPending,
		isAssigning: assignMutation.isPending,
	};
}
