import { TUMAI_DEPARTMENTS } from "@member-manager/shared";
import { type ReactElement, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
	FinanceTAccountGroup as FinanceTAccountGroupData,
	FinanceTAccountPlanItemRef,
	FinanceTAccountResponse,
} from "@/features/finance/financeTypes";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import { TotalsSummary } from "./FinanceTAccountTotals";
import {
	FinanceTAccountWorkbench,
	type FinanceTAccountWorkbenchProps,
} from "./FinanceTAccountWorkbench";

const OTHER_DEPARTMENT = "Other";
const DEPARTMENT_OPTIONS = [...TUMAI_DEPARTMENTS, OTHER_DEPARTMENT] as const;

// The department picker, the period controls and the totals card — the parts
// that are there whether or not the viewer may write anything.
interface FinanceTAccountChromeProps {
	period: FinancePeriod;
	canChooseDepartment: boolean;
	department: string | null;
	groups: FinanceTAccountGroupData[];
	// Name and project for Planposten that have no line of their own (fully
	// matched ones), so an expanded invoice can still say what it funds and which
	// project's share of it that match spends.
	planItems?: Record<string, FinanceTAccountPlanItemRef>;
	totals?: FinanceTAccountResponse["totals"];
	isLoading: boolean;
	error: Error | null;
	onPeriodTypeChange: (type: FinancePeriodType) => void;
	onPeriodKeyChange: (key: string) => void;
	onDepartmentChange: (department: string) => void;
}

// The write surface (FR-K5–K7, FR-L, FR-M) travels straight through to the
// workbench. All optional: omitted, the view is read-only — rows still expand,
// nothing is selectable or writable (FR-K6).
type FinanceTAccountSectionProps = FinanceTAccountChromeProps &
	Partial<Omit<FinanceTAccountWorkbenchProps, TAccountBodyOwnedProp>>;

// Props the body derives from the groups it already has — never passed in.
type TAccountBodyOwnedProp = "tree" | "department" | "subTeamOptions";

export function FinanceTAccountSection({
	period,
	canChooseDepartment,
	department,
	groups,
	planItems = {},
	totals,
	isLoading,
	error,
	onPeriodTypeChange,
	onPeriodKeyChange,
	onDepartmentChange,
	...workbench
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
					planItems={planItems}
					totals={totals}
					isLoading={isLoading}
					{...workbench}
				/>
			)}
		</div>
	);
}

function TAccountBody({
	department,
	period,
	groups,
	planItems,
	totals,
	isLoading,
	canWrite = false,
	projects = [],
	isCreatingProject = false,
	isAssigning = false,
	isSavingPlanItem = false,
	isMatching = false,
	...workbench
}: {
	department: string;
	period: FinancePeriod;
	groups: FinanceTAccountGroupData[];
	planItems: Record<string, FinanceTAccountPlanItemRef>;
	totals?: FinanceTAccountResponse["totals"];
	isLoading: boolean;
} & Partial<
	Omit<FinanceTAccountWorkbenchProps, TAccountBodyOwnedProp>
>): ReactElement {
	// Build the nested display tree (per-column subtotals + child roll-ups) once
	// per data change, before any early return so the hook order stays stable.
	const tree = useMemo(
		() => buildTAccountTree(groups, planItems),
		[groups, planItems],
	);
	// The sub-team folders the project dialog may drop a new project into
	// (FR-L4). Derived from the groups rather than the display tree, so a folder
	// with no lines of its own is still offered.
	const subTeamOptions = useMemo(
		() => collectSubTeamOptions(groups, projects),
		[groups, projects],
	);

	if (isLoading) {
		return <Skeleton className="h-64 w-full" />;
	}

	return (
		<div className="flex flex-col gap-5">
			<TotalsSummary department={department} period={period} totals={totals} />
			<FinanceTAccountWorkbench
				tree={tree}
				department={department}
				canWrite={canWrite}
				projects={projects}
				subTeamOptions={subTeamOptions}
				isCreatingProject={isCreatingProject}
				isAssigning={isAssigning}
				isSavingPlanItem={isSavingPlanItem}
				isMatching={isMatching}
				{...workbench}
			/>
		</div>
	);
}
