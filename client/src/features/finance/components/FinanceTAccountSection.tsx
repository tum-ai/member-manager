import { TUMAI_DEPARTMENTS } from "@member-manager/shared";
import { type ReactElement, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { buildTAccountTree } from "@/features/finance/financeTAccountUtils";
import type {
	FinancePeriodType,
	FinanceTAccountGroup as FinanceTAccountGroupData,
	FinanceTAccountResponse,
} from "@/features/finance/financeTypes";
import {
	type FinancePeriod,
	formatFinanceAmount,
	formatFinancePeriodLabel,
} from "@/features/finance/financeUtils";
import { cn } from "@/lib/utils";
import { FinanceManagementPeriodControls } from "./FinanceManagementPeriodControls";
import { FinanceTAccountGroup } from "./FinanceTAccountGroup";

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
}

function saldoClass(value: number): string {
	if (value > 0) return "text-emerald-600 dark:text-emerald-400";
	if (value < 0) return "text-destructive";
	return "text-foreground";
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
}: {
	department: string;
	period: FinancePeriod;
	groups: FinanceTAccountGroupData[];
	totals?: FinanceTAccountResponse["totals"];
	isLoading: boolean;
}): ReactElement {
	// Build the nested display tree (per-column subtotals + child roll-ups) once
	// per data change, before any early return so the hook order stays stable.
	const tree = useMemo(() => buildTAccountTree(groups), [groups]);

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
						Grau = geplant · schwarz = gebucht. Projekte sind aufklappbar.
					</p>
					{tree.map((node) => (
						<FinanceTAccountGroup
							key={node.projectId ?? node.projectName ?? "__ungrouped__"}
							node={node}
						/>
					))}
				</div>
			) : (
				<Card>
					<CardContent className="py-10 text-center text-muted-foreground">
						Keine Buchungen oder Planposten für {department} im Zeitraum.
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function TotalsSummary({
	department,
	period,
	totals,
}: {
	department: string;
	period: FinancePeriod;
	totals?: FinanceTAccountResponse["totals"];
}): ReactElement {
	const actualSaldo = totals?.actual.saldo ?? 0;
	const planSaldo = totals?.plan.saldo ?? 0;
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base">
					{department} — {formatFinancePeriodLabel(period)}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<Metric
						label="Ist-Saldo"
						value={formatFinanceAmount(actualSaldo)}
						className={saldoClass(actualSaldo)}
					/>
					<Metric
						label="Plan-Saldo"
						value={formatFinanceAmount(planSaldo)}
						className={saldoClass(planSaldo)}
					/>
					<Metric
						label="USt (Einnahmen)"
						value={formatFinanceAmount(totals?.vat_income ?? 0)}
					/>
					<Metric
						label="USt (Ausgaben)"
						value={formatFinanceAmount(totals?.vat_expenses ?? 0)}
					/>
				</dl>
			</CardContent>
		</Card>
	);
}

function Metric({
	label,
	value,
	className,
}: {
	label: string;
	value: string;
	className?: string;
}): ReactElement {
	return (
		<div>
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd
				className={cn(
					"text-xl font-semibold tabular-nums",
					className ?? "text-foreground",
				)}
			>
				{value}
			</dd>
		</div>
	);
}
