import type {
	FinancePostingAllocationInput,
	FinanceReallocationRequestCreate,
} from "@member-manager/shared";
import { type ReactElement, useMemo, useState } from "react";
import {
	collectMatchCandidates,
	openPostingAmount,
	type TAccountDisplayLine,
	type TAccountNode,
} from "@/features/finance/financeTAccountUtils";
import type { FinanceProject } from "@/features/finance/financeTypes";
import type { TAccountProjectInput } from "@/features/finance/hooks/useFinanceTAccountActions";
import type {
	TAccountMatchInput,
	TAccountPlanItemInput,
} from "@/features/finance/hooks/useFinanceTAccountPlanActions";
import type { FinanceTAccountSelection } from "@/features/finance/hooks/useFinanceTAccountSelection";
import {
	type FinanceAssignDialogPreset,
	FinanceAssignToProjectDialog,
} from "./FinanceAssignToProjectDialog";
import {
	type FinanceMatchDialogPreset,
	FinanceMatchPlanItemDialog,
} from "./FinanceMatchPlanItemDialog";
import {
	FinancePlanItemDialog,
	type FinancePlanItemDialogPreset,
} from "./FinancePlanItemDialog";
import {
	FinanceProjectDialog,
	type FinanceProjectDialogPreset,
} from "./FinanceProjectDialog";
import {
	type FinanceReallocationDialogPreset,
	FinanceReallocationRequestDialog,
} from "./FinanceReallocationRequestDialog";
import {
	FinanceSplitAllocationDialog,
	type FinanceSplitDialogPreset,
} from "./FinanceSplitAllocationDialog";
import { FinanceTAccountGroup } from "./FinanceTAccountGroup";
import { FinanceTAccountSelectionBar } from "./FinanceTAccountSelectionBar";
import type { TAccountInteraction } from "./tAccountInteraction";

export interface FinanceTAccountWorkbenchProps {
	tree: TAccountNode[];
	canWrite: boolean;
	projects: FinanceProject[];
	selection?: FinanceTAccountSelection;
	isCreatingProject: boolean;
	isAssigning: boolean;
	isSavingPlanItem: boolean;
	isMatching: boolean;
	onCreateProject?: (input: TAccountProjectInput) => Promise<void>;
	onAssignToProject?: (
		projectId: string,
		postingExternalIds: string[],
	) => Promise<void>;
	onSavePlanItem?: (input: TAccountPlanItemInput) => Promise<void>;
	onTogglePlanItem?: (planItemId: string, isActive: boolean) => void;
	onCorrectPlanToActual?: (planItemId: string, matchedAmount: number) => void;
	onMatch?: (input: TAccountMatchInput) => Promise<void>;
	onDetachMatch?: (matchId: string) => void;
	onDeletePlanItem?: (planItemId: string) => void;
	department?: string | null;
	isRequestingReallocation?: boolean;
	onRequestReallocation?: (
		input: FinanceReallocationRequestCreate,
	) => Promise<void>;
	isSplitting?: boolean;
	onSplitAllocation?: (input: {
		postingExternalId: string;
		allocations: FinancePostingAllocationInput[];
	}) => Promise<void>;
}

// The interactive half of the T-view: the folder tree, the selection bar and
// every dialog they open. Which dialog is open is pure view state — it never
// outlives this component and nothing else needs it, so it lives here rather
// than in the page hook.
export function FinanceTAccountWorkbench({
	tree,
	canWrite,
	projects,
	selection,
	isCreatingProject,
	isAssigning,
	isSavingPlanItem,
	isMatching,
	onCreateProject,
	onAssignToProject,
	onSavePlanItem,
	onTogglePlanItem,
	onCorrectPlanToActual,
	onMatch,
	onDetachMatch,
	onDeletePlanItem,
	department = null,
	isRequestingReallocation = false,
	onRequestReallocation,
	isSplitting = false,
	onSplitAllocation,
}: FinanceTAccountWorkbenchProps): ReactElement {
	const [projectPreset, setProjectPreset] =
		useState<FinanceProjectDialogPreset | null>(null);
	const [assignPreset, setAssignPreset] =
		useState<FinanceAssignDialogPreset | null>(null);
	const [planItemPreset, setPlanItemPreset] =
		useState<FinancePlanItemDialogPreset | null>(null);
	const [matchPreset, setMatchPreset] =
		useState<FinanceMatchDialogPreset | null>(null);
	const [reallocationPreset, setReallocationPreset] =
		useState<FinanceReallocationDialogPreset | null>(null);
	const [splitPreset, setSplitPreset] =
		useState<FinanceSplitDialogPreset | null>(null);

	const candidates = useMemo(() => collectMatchCandidates(tree), [tree]);

	const writable = canWrite && selection !== undefined;
	const interaction: TAccountInteraction | undefined = writable
		? {
				canWrite: true,
				isSelected: selection.isSelected,
				onToggleSelect: selection.toggle,
				onAssignPosting: (postingExternalId, amount) =>
					setAssignPreset({
						postingExternalIds: [postingExternalId],
						selectionSum: amount,
					}),
				onCreateProject: (node) =>
					setProjectPreset({
						// A project node becomes the parent of a sub-project; a sub-team
						// folder passes its sub-team on (FR-L3/FR-L4).
						parentProjectId: node.projectId,
						parentProjectName:
							node.projectId !== null ? node.projectName : null,
						subTeam: node.subTeam,
						postingExternalIds: [],
						selectionSum: 0,
					}),
				onCreatePlanItem: (node) =>
					setPlanItemPreset({
						id: null,
						// FR-M1: the node decides the project the Planposten lands in.
						projectId: node.projectId,
						folderName: node.projectName,
						label: "",
						category: null,
						direction: "expense",
						plannedAmount: 0,
						expectedMonth: null,
						status: "planned",
						note: null,
						vatRate: null,
						matchedAmount: 0,
					}),
				onEditPlanItem: (line) =>
					setPlanItemPreset(planItemPresetFromLine(line)),
				onTogglePlanItem: (planItemId, isActive) =>
					onTogglePlanItem?.(planItemId, isActive),
				onCorrectPlanToActual: (planItemId, matchedAmount) =>
					onCorrectPlanToActual?.(planItemId, matchedAmount),
				onMatchFromPlanItem: (line) => {
					if (line.planItemId === null) return;
					setMatchPreset({
						from: "planItem",
						planItemId: line.planItemId,
						postingExternalId: null,
						fixedLabel: line.label,
						openAmount: line.amount,
						candidates: candidates.postings.filter(
							(candidate) =>
								candidate.direction === line.direction &&
								candidate.projectId === line.projectId,
						),
					});
				},
				onMatchFromPosting: (line) => {
					if (line.postingExternalId === null) return;
					setMatchPreset({
						from: "posting",
						planItemId: null,
						postingExternalId: line.postingExternalId,
						fixedLabel: line.label,
						openAmount: openPostingAmount(line),
						candidates: candidates.planItems.filter(
							(candidate) =>
								candidate.direction === line.direction &&
								candidate.projectId === line.projectId,
						),
					});
				},
				onDetachMatch: (matchId) => onDetachMatch?.(matchId),
				onEditSplit: (line) => {
					if (line.postingExternalId === null) return;
					setSplitPreset({
						postingExternalId: line.postingExternalId,
						label: line.label,
					});
				},
				onRequestReallocation: (line) => {
					if (line.postingExternalId === null) return;
					setReallocationPreset({
						postingExternalId: line.postingExternalId,
						label: line.label,
					});
				},
				onDeletePlanItem: (planItemId, label) => {
					// Deleting a Planposten cannot be undone from a toast the way
					// parking can, so it asks first.
					if (
						window.confirm(
							`Planposten „${label}" wirklich löschen? Zum Zurückstellen gibt es „Deaktivieren".`,
						)
					) {
						onDeletePlanItem?.(planItemId);
					}
				},
			}
		: undefined;

	return (
		<div className="flex flex-col gap-4">
			<p className="text-xs text-muted-foreground">
				Grau = geplant · schwarz = gebucht. Projekte und einzelne Zeilen sind
				aufklappbar.
			</p>
			{tree.map((node) => (
				<FinanceTAccountGroup
					key={node.key}
					node={node}
					interaction={interaction}
				/>
			))}
			{selection ? (
				<FinanceTAccountSelectionBar
					count={selection.count}
					grossSum={selection.grossSum}
					onCreateProject={() =>
						setProjectPreset({
							parentProjectId: null,
							parentProjectName: null,
							subTeam: null,
							postingExternalIds: selection.selectedIds,
							selectionSum: selection.grossSum,
						})
					}
					onAssignToProject={() =>
						setAssignPreset({
							postingExternalIds: selection.selectedIds,
							selectionSum: selection.grossSum,
						})
					}
					onClear={selection.clear}
				/>
			) : null}

			<FinanceProjectDialog
				preset={projectPreset}
				isPending={isCreatingProject}
				onClose={() => setProjectPreset(null)}
				onSubmit={async (input) => {
					await onCreateProject?.(input);
					setProjectPreset(null);
				}}
			/>
			<FinanceAssignToProjectDialog
				preset={assignPreset}
				projects={projects}
				isPending={isAssigning}
				onClose={() => setAssignPreset(null)}
				onSubmit={async (projectId, postingExternalIds) => {
					await onAssignToProject?.(projectId, postingExternalIds);
					setAssignPreset(null);
				}}
			/>
			<FinancePlanItemDialog
				preset={planItemPreset}
				isPending={isSavingPlanItem}
				onClose={() => setPlanItemPreset(null)}
				onSubmit={async (input) => {
					await onSavePlanItem?.(input);
					setPlanItemPreset(null);
				}}
			/>
			<FinanceSplitAllocationDialog
				preset={splitPreset}
				projects={projects}
				department={department}
				isPending={isSplitting}
				onClose={() => setSplitPreset(null)}
				onAllocateToProject={async ({ postingExternalId, projectId }) => {
					await onSplitAllocation?.({
						postingExternalId,
						allocations: [{ project_id: projectId, percentage: 100 }],
					});
				}}
				onSplitAllocation={async (input) => {
					await onSplitAllocation?.(input);
				}}
			/>
			<FinanceReallocationRequestDialog
				preset={reallocationPreset}
				projects={projects}
				department={department}
				isPending={isRequestingReallocation}
				onClose={() => setReallocationPreset(null)}
				onSubmit={async (input) => {
					await onRequestReallocation?.(input);
				}}
			/>
			<FinanceMatchPlanItemDialog
				preset={matchPreset}
				isPending={isMatching}
				onClose={() => setMatchPreset(null)}
				onSubmit={async (input) => {
					await onMatch?.(input);
					setMatchPreset(null);
				}}
			/>
		</div>
	);
}

// An edit starts from the Planposten's own values (FR-M2). `line.amount` is the
// still-open remainder, so the full planned amount comes off the detail.
function planItemPresetFromLine(
	line: TAccountDisplayLine,
): FinancePlanItemDialogPreset | null {
	if (line.planItemId === null || line.planDetail === null) {
		return null;
	}
	return {
		id: line.planItemId,
		projectId: line.projectId,
		folderName: null,
		label: line.label,
		category: line.category,
		direction: line.direction,
		plannedAmount: line.planDetail.planned_amount,
		expectedMonth: line.planDetail.expected_month,
		status: line.status ?? "planned",
		note: line.planDetail.note,
		vatRate: line.planDetail.vat_rate,
		matchedAmount: line.planDetail.matched_amount,
	};
}
