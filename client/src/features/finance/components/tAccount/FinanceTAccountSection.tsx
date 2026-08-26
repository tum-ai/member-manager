import { TUMAI_DEPARTMENTS } from "@member-manager/shared";
import { FolderPlus } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceManagementPeriodControls } from "@/features/finance/components/FinanceManagementPeriodControls";
import {
	buildTAccountTree,
	collectSubTeamOptions,
} from "@/features/finance/financeTAccountUtils";
import type {
	FinancePeriodType,
	FinanceProject,
	FinanceTAccountGroup as FinanceTAccountGroupData,
	FinanceTAccountResponse,
} from "@/features/finance/financeTypes";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import type { TAccountProjectInput } from "@/features/finance/hooks/useFinanceTAccountActions";
import type { FinanceTAccountSelection } from "@/features/finance/hooks/useFinanceTAccountSelection";
import {
	type FinanceAssignDialogPreset,
	FinanceAssignToProjectDialog,
} from "./FinanceAssignToProjectDialog";
import {
	FinanceProjectDialog,
	type FinanceProjectDialogPreset,
} from "./FinanceProjectDialog";
import { FinanceTAccountGroup } from "./FinanceTAccountGroup";
import { FinanceTAccountSelectionBar } from "./FinanceTAccountSelectionBar";
import { TotalsSummary } from "./FinanceTAccountTotals";
import type { TAccountInteraction } from "./tAccountInteraction";

const OTHER_DEPARTMENT = "Other";
const DEPARTMENT_OPTIONS = [...TUMAI_DEPARTMENTS, OTHER_DEPARTMENT] as const;

interface FinanceTAccountSectionProps {
	period: FinancePeriod;
	canChooseDepartment: boolean;
	department: string | null;
	groups: FinanceTAccountGroupData[];
	totals?: FinanceTAccountResponse["totals"];
	isLoading: boolean;
	error: Error | null;
	onPeriodTypeChange: (type: FinancePeriodType) => void;
	onPeriodKeyChange: (key: string) => void;
	onDepartmentChange: (department: string) => void;
	// Write surface (FR-K5–K7, FR-L). Omitted for a read-only viewer: rows still
	// expand, nothing is selectable (FR-K6).
	canWrite?: boolean;
	projects?: FinanceProject[];
	selection?: FinanceTAccountSelection;
	isCreatingProject?: boolean;
	isAssigning?: boolean;
	onCreateProject?: (input: TAccountProjectInput) => Promise<void>;
	onAssignToProject?: (
		projectId: string,
		postingExternalIds: string[],
	) => Promise<void>;
}

export function FinanceTAccountSection({
	period,
	canChooseDepartment,
	department,
	groups,
	totals,
	isLoading,
	error,
	onPeriodTypeChange,
	onPeriodKeyChange,
	onDepartmentChange,
	canWrite = false,
	projects = [],
	selection,
	isCreatingProject = false,
	isAssigning = false,
	onCreateProject,
	onAssignToProject,
}: FinanceTAccountSectionProps): ReactElement {
	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap items-end gap-3">
				{canChooseDepartment ? (
					<div className="grid gap-1.5">
						<Label htmlFor="t-account-department">Department</Label>
						<Select value={department ?? ""} onValueChange={onDepartmentChange}>
							<SelectTrigger
								id="t-account-department"
								className="w-56"
								aria-label="Department"
							>
								<SelectValue placeholder="Department wählen" />
							</SelectTrigger>
							<SelectContent>
								{DEPARTMENT_OPTIONS.map((option) => (
									<SelectItem key={option} value={option}>
										{option}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				) : null}
				<FinanceManagementPeriodControls
					idPrefix="t-account"
					period={period}
					onPeriodTypeChange={onPeriodTypeChange}
					onPeriodKeyChange={onPeriodKeyChange}
				/>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : null}

			{department === null ? (
				<Card>
					<CardContent className="py-10 text-center text-muted-foreground">
						Bitte ein Department wählen, um das T-Konto anzuzeigen.
					</CardContent>
				</Card>
			) : (
				<TAccountBody
					department={department}
					period={period}
					groups={groups}
					totals={totals}
					isLoading={isLoading}
					canWrite={canWrite}
					projects={projects}
					selection={selection}
					isCreatingProject={isCreatingProject}
					isAssigning={isAssigning}
					onCreateProject={onCreateProject}
					onAssignToProject={onAssignToProject}
				/>
			)}
		</div>
	);
}

function TAccountBody({
	department,
	period,
	groups,
	totals,
	isLoading,
	canWrite,
	projects,
	selection,
	isCreatingProject,
	isAssigning,
	onCreateProject,
	onAssignToProject,
}: {
	department: string;
	period: FinancePeriod;
	groups: FinanceTAccountGroupData[];
	totals?: FinanceTAccountResponse["totals"];
	isLoading: boolean;
	canWrite: boolean;
	projects: FinanceProject[];
	selection?: FinanceTAccountSelection;
	isCreatingProject: boolean;
	isAssigning: boolean;
	onCreateProject?: (input: TAccountProjectInput) => Promise<void>;
	onAssignToProject?: (
		projectId: string,
		postingExternalIds: string[],
	) => Promise<void>;
}): ReactElement {
	// Build the nested display tree (per-column subtotals + child roll-ups) once
	// per data change, before any early return so the hook order stays stable.
	const tree = useMemo(() => buildTAccountTree(groups), [groups]);
	// The sub-team folders the dialog may drop a new project into (FR-L4).
	const subTeamOptions = useMemo(
		() => collectSubTeamOptions(groups, projects),
		[groups, projects],
	);
	// Which dialog is open is pure view state — it never outlives the section and
	// nothing else needs it, so it stays here rather than in the page hook.
	const [projectPreset, setProjectPreset] =
		useState<FinanceProjectDialogPreset | null>(null);
	const [assignPreset, setAssignPreset] =
		useState<FinanceAssignDialogPreset | null>(null);

	const writable = canWrite && selection !== undefined;
	const interaction: TAccountInteraction | undefined = writable
		? {
				canWrite: true,
				isSelected: selection.isSelected,
				onToggleSelect: selection.toggle,
				onCreateProject: (node) =>
					setProjectPreset({
						// A project node becomes the parent of a sub-project; a sub-team
						// folder passes its sub-team on (FR-L3/FR-L4). Both are only the
						// dialog's starting point — the user can still place it elsewhere.
						parentProjectId: node.projectId,
						subTeam: node.subTeam,
						postingExternalIds: [],
						selectionSum: 0,
					}),
				onAssignPosting: (postingExternalId, amount) =>
					setAssignPreset({
						postingExternalIds: [postingExternalId],
						selectionSum: amount,
					}),
			}
		: undefined;

	if (isLoading) {
		return <Skeleton className="h-64 w-full" />;
	}

	// A named project or sub-team folder is renderable content even with no lines:
	// the server deliberately emits empty projects so a freshly created one shows
	// up (FR-I3). Only the bare ungrouped bucket (no name, no id) counts as "no
	// activity" and falls through to the empty-state card.
	const hasActivity = tree.some(
		(node) =>
			node.projectId !== null ||
			node.projectName !== null ||
			node.expenseLines.length > 0 ||
			node.incomeLines.length > 0 ||
			node.children.length > 0,
	);

	return (
		<div className="flex flex-col gap-5">
			<TotalsSummary department={department} period={period} totals={totals} />
			{hasActivity ? (
				<div className="flex flex-col gap-4">
					<p className="text-xs text-muted-foreground">
						Grau = geplant · schwarz = gebucht. Projekte und einzelne Zeilen
						sind aufklappbar.
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
								// A selection spans folders, so it starts unplaced: the
								// dialog's parent and sub-team pickers decide where it lands
								// (FR-L1).
								setProjectPreset({
									parentProjectId: null,
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
				</div>
			) : (
				<Card>
					<CardContent className="flex flex-col items-center gap-4 py-10 text-center">
						<p className="text-muted-foreground">
							Keine Buchungen oder Planposten für {department} im Zeitraum.
						</p>
						{/* A department that may be written must be able to open its first
						    project here too — otherwise an empty department has no way in
						    at all (FR-L3). */}
						{interaction ? (
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() =>
									setProjectPreset({
										parentProjectId: null,
										subTeam: null,
										postingExternalIds: [],
										selectionSum: 0,
									})
								}
							>
								<FolderPlus />
								Neues Projekt
							</Button>
						) : null}
					</CardContent>
				</Card>
			)}

			<FinanceProjectDialog
				preset={projectPreset}
				projects={projects}
				subTeamOptions={subTeamOptions}
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
		</div>
	);
}
