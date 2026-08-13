import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import type {
	FinancePeriodType,
	FinancePlanDirection,
	FinancePlanItem,
	FinancePlanStatus,
	FinanceTAccountResponse,
} from "@/features/finance/financeTypes";
import { apiClient } from "@/lib/apiClient";
import { FINANCE_T_ACCOUNT_QUERY_KEY } from "./useFinanceTAccount";

// Everything the Planposten dialog collects. `id` present = edit in place
// (FR-M2), absent = create on the node the dialog was opened from (FR-M1).
export interface TAccountPlanItemInput {
	id: string | null;
	label: string;
	category: string | null;
	direction: FinancePlanDirection;
	plannedAmount: number;
	expectedMonth: string | null;
	status: FinancePlanStatus;
	note: string | null;
	vatRate: number | null;
	projectId: string | null;
}

export interface TAccountMatchInput {
	planItemId: string;
	postingExternalId: string;
	matchedAmount: number;
}

export function useFinanceTAccountPlanActions({
	department,
	period,
}: {
	department: string | null;
	period: { type: FinancePeriodType; key: string };
}) {
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	function invalidate(): void {
		void queryClient.invalidateQueries({
			queryKey: [FINANCE_T_ACCOUNT_QUERY_KEY],
		});
	}

	function reportError(error: unknown, fallback: string): void {
		showToast(error instanceof Error ? error.message : fallback, "error");
	}

	async function putPlanItem(
		id: string,
		body: Record<string, unknown>,
	): Promise<FinancePlanItem> {
		return await apiClient<FinancePlanItem>(
			`/api/finance/plan-items/${encodeURIComponent(id)}`,
			{ method: "PUT", body: JSON.stringify(body) },
		);
	}

	const saveMutation = useMutation({
		mutationFn: async (input: TAccountPlanItemInput) => {
			const body = {
				label: input.label,
				category: input.category,
				direction: input.direction,
				planned_amount: input.plannedAmount,
				expected_month: input.expectedMonth,
				status: input.status,
				note: input.note,
				vat_rate: input.vatRate,
				project_id: input.projectId,
			};
			if (input.id !== null) {
				return await putPlanItem(input.id, body);
			}
			return await apiClient<FinancePlanItem>("/api/finance/plan-items", {
				method: "POST",
				body: JSON.stringify({
					...body,
					department,
					period_type: period.type,
					period_key: period.key,
				}),
			});
		},
		onSuccess: (_data, input) => {
			showToast(
				input.id !== null ? "Planposten gespeichert." : "Planposten angelegt.",
				"success",
			);
			invalidate();
		},
		onError: (error) =>
			reportError(error, "Planposten konnte nicht gespeichert werden."),
	});

	// FR-M3. Optimistic because the flip is the whole point of the control: the
	// row must mute (and leave the plan subtotals) the moment it is clicked. The
	// client recomputes every column subtotal from the lines, so patching the
	// flag in the cache is enough to keep them honest until the refetch lands.
	const toggleActiveMutation = useMutation({
		mutationFn: async (input: { planItemId: string; isActive: boolean }) =>
			await putPlanItem(input.planItemId, { is_active: input.isActive }),
		onMutate: async (input) => {
			await queryClient.cancelQueries({
				queryKey: [FINANCE_T_ACCOUNT_QUERY_KEY],
			});
			const snapshots = queryClient.getQueriesData<FinanceTAccountResponse>({
				queryKey: [FINANCE_T_ACCOUNT_QUERY_KEY],
			});
			for (const [key, data] of snapshots) {
				if (!data) continue;
				queryClient.setQueryData<FinanceTAccountResponse>(
					key,
					patchPlanItemActive(data, input.planItemId, input.isActive),
				);
			}
			return { snapshots };
		},
		onError: (error, _input, context) => {
			for (const [key, data] of context?.snapshots ?? []) {
				queryClient.setQueryData(key, data);
			}
			reportError(error, "Planposten konnte nicht geändert werden.");
		},
		onSuccess: (_data, input) => {
			showToast(
				input.isActive
					? "Planposten wieder aktiviert."
					: "Planposten deaktiviert.",
				"success",
				{
					// Parking a Planposten is one click, so undoing it has to be one
					// click too, right where the confirmation appears (FR-M3).
					action: {
						label: "Rückgängig",
						onClick: () => {
							toggleActiveMutation.mutate({
								planItemId: input.planItemId,
								isActive: !input.isActive,
							});
						},
					},
				},
			);
			invalidate();
		},
	});

	// FR-M6: the plan was an estimate, the invoices are the truth. The database
	// refuses a planned amount below the matched total, so setting it *to* that
	// total is always allowed.
	const correctToActualMutation = useMutation({
		mutationFn: async (input: { planItemId: string; matchedAmount: number }) =>
			await putPlanItem(input.planItemId, {
				planned_amount: input.matchedAmount,
			}),
		onSuccess: () => {
			showToast("Plan auf Ist korrigiert.", "success");
			invalidate();
		},
		onError: (error) =>
			reportError(error, "Plan konnte nicht korrigiert werden."),
	});

	const matchMutation = useMutation({
		mutationFn: async (input: TAccountMatchInput) =>
			await apiClient("/api/finance/plan-item-matches", {
				method: "POST",
				body: JSON.stringify({
					plan_item_id: input.planItemId,
					posting_external_id: input.postingExternalId,
					matched_amount: input.matchedAmount,
				}),
			}),
		onSuccess: () => {
			showToast("Buchung dem Planposten zugeordnet.", "success");
			invalidate();
		},
		onError: (error) =>
			reportError(error, "Zuordnung konnte nicht gespeichert werden."),
	});

	// The plan tab used to own this; with that tab gone (FR-O) the T-view is the
	// only place a Planposten can be removed, so the capability moves here rather
	// than disappearing. Parking (FR-M3) stays the softer, reversible option.
	const deleteMutation = useMutation({
		mutationFn: async (planItemId: string) =>
			await apiClient(
				`/api/finance/plan-items/${encodeURIComponent(planItemId)}`,
				{ method: "DELETE" },
			),
		onSuccess: () => {
			showToast("Planposten gelöscht.", "success");
			invalidate();
		},
		onError: (error) =>
			reportError(error, "Planposten konnte nicht gelöscht werden."),
	});

	const detachMutation = useMutation({
		mutationFn: async (matchId: string) =>
			await apiClient(
				`/api/finance/plan-item-matches/${encodeURIComponent(matchId)}`,
				{ method: "DELETE" },
			),
		onSuccess: () => {
			// The server walks the status back with the match (FR-M7).
			showToast("Zuordnung entfernt.", "success");
			invalidate();
		},
		onError: (error) =>
			reportError(error, "Zuordnung konnte nicht entfernt werden."),
	});

	return {
		savePlanItem: async (input: TAccountPlanItemInput) => {
			await saveMutation.mutateAsync(input);
		},
		togglePlanItemActive: (planItemId: string, isActive: boolean) => {
			toggleActiveMutation.mutate({ planItemId, isActive });
		},
		correctPlanToActual: (planItemId: string, matchedAmount: number) => {
			correctToActualMutation.mutate({ planItemId, matchedAmount });
		},
		matchPosting: async (input: TAccountMatchInput) => {
			await matchMutation.mutateAsync(input);
		},
		detachMatch: (matchId: string) => {
			detachMutation.mutate(matchId);
		},
		deletePlanItem: (planItemId: string) => {
			deleteMutation.mutate(planItemId);
		},
		isSavingPlanItem: saveMutation.isPending,
		isMatching: matchMutation.isPending,
	};
}

// Flip `is_active` on one plan line wherever it appears, leaving the rest of the
// response untouched. Server-computed group saldi and the department totals stay
// as they were until the refetch — the columns the user is looking at are
// derived client-side and update immediately.
function patchPlanItemActive(
	response: FinanceTAccountResponse,
	planItemId: string,
	isActive: boolean,
): FinanceTAccountResponse {
	const patchLines = (
		lines: FinanceTAccountResponse["groups"][number]["expense_lines"],
	) =>
		lines.map((line) =>
			line.plan_item_id === planItemId && line.plan_detail !== null
				? { ...line, plan_detail: { ...line.plan_detail, is_active: isActive } }
				: line,
		);
	return {
		...response,
		groups: response.groups.map((group) => ({
			...group,
			expense_lines: patchLines(group.expense_lines),
			income_lines: patchLines(group.income_lines),
		})),
	};
}
