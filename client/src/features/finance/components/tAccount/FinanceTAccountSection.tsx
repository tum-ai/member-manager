import { TUMAI_DEPARTMENTS } from "@member-manager/shared";
import { Receipt, Wallet } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FinanceManagementPeriodControls } from "@/features/finance/components/FinanceManagementPeriodControls";
import {
	buildTAccountTree,
	type TAccountAmountMode,
} from "@/features/finance/financeTAccountUtils";
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
	// Names for Planposten that have no line of their own (fully matched ones),
	// so an expanded invoice can still say what it funds.
	planItemLabels?: Record<string, string>;
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
	Partial<Omit<FinanceTAccountWorkbenchProps, "tree">>;

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
	planItemLabels = {},
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
					planItemLabels={planItemLabels}
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
	planItemLabels,
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
	planItemLabels: Record<string, string>;
	totals?: FinanceTAccountResponse["totals"];
	isLoading: boolean;
} & Partial<Omit<FinanceTAccountWorkbenchProps, "tree">>): ReactElement {
	// Build the nested display tree (per-column subtotals + child roll-ups) once
	// per data change, before any early return so the hook order stays stable.
	// Gross is the default: it is what the bank moved and what an invoice says.
	// Net is the working view for anyone reasoning about the department's real
	// cost, and the header always states which one is on (FR-N4).
	const [amountMode, setAmountMode] = useState<TAccountAmountMode>("gross");
	const tree = useMemo(
		() => buildTAccountTree(groups, { planItemLabels, amountMode }),
		[groups, planItemLabels, amountMode],
	);

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
			<TotalsSummary
				department={department}
				period={period}
				totals={totals}
				amountMode={amountMode}
				onAmountModeChange={setAmountMode}
			/>
			{hasActivity ? (
				<FinanceTAccountWorkbench
					tree={tree}
					department={department}
					canWrite={canWrite}
					projects={projects}
					isCreatingProject={isCreatingProject}
					isAssigning={isAssigning}
					isSavingPlanItem={isSavingPlanItem}
					isMatching={isMatching}
					{...workbench}
				/>
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
	amountMode,
	onAmountModeChange,
}: {
	department: string;
	period: FinancePeriod;
	totals?: FinanceTAccountResponse["totals"];
	amountMode: TAccountAmountMode;
	onAmountModeChange: (mode: TAccountAmountMode) => void;
}): ReactElement {
	const isNet = amountMode === "net";
	// The saldi come from the server in both modes, so the header can never
	// disagree with the columns below it (FR-N6).
	const saldi = isNet
		? { actual: totals?.actual_net, plan: totals?.plan_net }
		: { actual: totals?.actual, plan: totals?.plan };
	const actualSaldo = saldi.actual?.saldo ?? 0;
	const planSaldo = saldi.plan?.saldo ?? 0;
	const vatPayload = totals?.vat_payload ?? 0;
	const vatPayloadForecast = totals?.vat_payload_forecast ?? 0;
	return (
		<Card>
			<CardHeader className="pb-2">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<CardTitle className="text-base">
						{department} — {formatFinancePeriodLabel(period)}
						{/* The active mode is stated, never merely implied (FR-N4). */}
						<span className="ml-2 font-normal text-muted-foreground">
							· Beträge {isNet ? "netto" : "brutto"}
						</span>
					</CardTitle>
					<ToggleGroup
						type="single"
						value={amountMode}
						variant="outline"
						size="sm"
						onValueChange={(value) => {
							if (value === "gross" || value === "net") {
								onAmountModeChange(value);
							}
						}}
						aria-label="Beträge"
					>
						<ToggleGroupItem value="gross" aria-label="Bruttobeträge">
							<Wallet />
							Brutto
						</ToggleGroupItem>
						<ToggleGroupItem value="net" aria-label="Nettobeträge">
							<Receipt />
							Netto
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
					<Metric
						label="Ist-Saldo"
						value={formatFinanceAmount(actualSaldo)}
						className={saldoClass(actualSaldo)}
						hint={isNet ? "netto" : undefined}
					/>
					<Metric
						label="Plan-Saldo"
						value={formatFinanceAmount(planSaldo)}
						className={saldoClass(planSaldo)}
						hint={isNet ? "netto" : undefined}
					/>
					<Metric
						label="Umsatzsteuer"
						value={formatFinanceAmount(totals?.vat_income ?? 0)}
						hint="in den Einnahmen"
					/>
					<Metric
						label="Vorsteuer"
						value={formatFinanceAmount(totals?.vat_expenses ?? 0)}
						hint="in den Ausgaben"
					/>
					<Metric
						label="Zahllast"
						value={formatFinanceAmount(vatPayload)}
						// Signed on purpose: a negative Zahllast is a refund, not a debt.
						// The forecast is only worth stating when the still-open plan
						// actually changes it (FR-N5).
						hint={
							vatPayloadForecast !== vatPayload
								? `Forecast ${formatFinanceAmount(vatPayloadForecast)}`
								: vatPayload < 0
									? "Erstattung (USt − Vorsteuer)"
									: "USt − Vorsteuer"
						}
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
	hint,
}: {
	label: string;
	value: string;
	className?: string;
	hint?: string;
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
				{hint ? (
					<span className="block text-xs font-normal text-muted-foreground">
						{hint}
					</span>
				) : null}
			</dd>
		</div>
	);
}
