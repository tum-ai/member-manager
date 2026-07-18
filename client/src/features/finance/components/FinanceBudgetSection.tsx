import { AlertTriangle, Loader2 } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	FinanceBudgetVsActualResponse,
	FinanceBudgetVsActualRow,
	FinancePeriodType,
} from "@/features/finance/financeTypes";
import {
	type FinancePeriod,
	formatFinanceAmount,
	formatFinancePeriodLabel,
	listFinancePeriodKeys,
} from "@/features/finance/financeUtils";

interface SaveInput {
	department: string;
	amountPlanned: number;
}

interface FinanceBudgetSectionProps {
	period: FinancePeriod;
	rows: FinanceBudgetVsActualRow[];
	totals?: FinanceBudgetVsActualResponse["totals"];
	isLoading: boolean;
	error: Error | null;
	savingDepartment: string | null;
	// Reviewers edit budgets inline; department viewers see them read-only.
	canEdit?: boolean;
	onPeriodTypeChange: (type: FinancePeriodType) => void;
	onPeriodKeyChange: (key: string) => void;
	onSave: (input: SaveInput) => void;
}

export function FinanceBudgetSection({
	period,
	rows,
	totals,
	isLoading,
	error,
	savingDepartment,
	canEdit = true,
	onPeriodTypeChange,
	onPeriodKeyChange,
	onSave,
}: FinanceBudgetSectionProps): ReactElement {
	const overBudgetCount = rows.filter((row) => row.over_budget).length;

	return (
		<div className="flex flex-col gap-5">
			<PeriodControls
				period={period}
				onPeriodTypeChange={onPeriodTypeChange}
				onPeriodKeyChange={onPeriodKeyChange}
			/>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : null}

			{!isLoading && overBudgetCount > 0 ? (
				<Alert variant="destructive">
					<AlertTriangle className="size-4" />
					<AlertDescription>
						{overBudgetCount} Department(s) über Budget im Zeitraum{" "}
						{formatFinancePeriodLabel(period)}.
					</AlertDescription>
				</Alert>
			) : null}

			<TotalsRow totals={totals} isLoading={isLoading} />

			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Budget vs. Ist — {formatFinancePeriodLabel(period)}
					</CardTitle>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<Skeleton className="h-64 w-full" />
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-48">Department</TableHead>
										<TableHead className="w-40 text-right">Budget</TableHead>
										<TableHead className="text-right">Ist</TableHead>
										<TableHead className="text-right">Rest</TableHead>
										<TableHead className="w-56">Auslastung</TableHead>
										<TableHead className="w-10" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{rows.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center text-muted-foreground"
											>
												Keine Budgets oder Ausgaben im Zeitraum.
											</TableCell>
										</TableRow>
									) : (
										rows.map((row) => (
											<BudgetRow
												key={row.department}
												row={row}
												saving={savingDepartment === row.department}
												canEdit={canEdit}
												onSave={onSave}
											/>
										))
									)}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function PeriodControls({
	period,
	onPeriodTypeChange,
	onPeriodKeyChange,
}: {
	period: FinancePeriod;
	onPeriodTypeChange: (type: FinancePeriodType) => void;
	onPeriodKeyChange: (key: string) => void;
}): ReactElement {
	const keyOptions = listFinancePeriodKeys(period.type);

	return (
		<div className="flex flex-wrap items-end gap-3">
			<div className="flex flex-col gap-1">
				<Label htmlFor="finance-budget-type">Zeitraumtyp</Label>
				<Select
					value={period.type}
					onValueChange={(value) =>
						onPeriodTypeChange(value as FinancePeriodType)
					}
				>
					<SelectTrigger id="finance-budget-type" className="w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="year">Jahr</SelectItem>
						<SelectItem value="semester">Semester</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="flex flex-col gap-1">
				<Label htmlFor="finance-budget-period">Zeitraum</Label>
				<Select value={period.key} onValueChange={onPeriodKeyChange}>
					<SelectTrigger id="finance-budget-period" className="w-48">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{keyOptions.map((key) => (
							<SelectItem key={key} value={key}>
								{formatFinancePeriodLabel({ type: period.type, key })}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

function TotalsRow({
	totals,
	isLoading,
}: {
	totals?: FinanceBudgetVsActualResponse["totals"];
	isLoading: boolean;
}): ReactElement {
	const metrics = [
		{ label: "Budget gesamt", value: totals?.amount_planned ?? 0 },
		{ label: "Ist gesamt", value: totals?.actual_expenses ?? 0 },
		{ label: "Rest gesamt", value: totals?.remaining ?? 0 },
	];

	return (
		<section
			aria-label="Budgetkennzahlen"
			className="grid grid-cols-1 gap-4 sm:grid-cols-3"
		>
			{metrics.map((metric) => (
				<Card key={metric.label}>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							{metric.label}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<Skeleton className="h-8 w-28" />
						) : (
							<p
								className={`text-2xl font-semibold tabular-nums ${
									metric.label === "Rest gesamt" && metric.value < 0
										? "text-destructive"
										: "text-foreground"
								}`}
							>
								{formatFinanceAmount(metric.value)}
							</p>
						)}
					</CardContent>
				</Card>
			))}
		</section>
	);
}

function BudgetRow({
	row,
	saving,
	canEdit,
	onSave,
}: {
	row: FinanceBudgetVsActualRow;
	saving: boolean;
	canEdit: boolean;
	onSave: (input: SaveInput) => void;
}): ReactElement {
	const [amount, setAmount] = useState<string>(
		row.amount_planned === null ? "" : String(row.amount_planned),
	);

	// Persist on blur / Enter when the parsed amount changed. Empty clears the
	// budget back to 0.
	function persist(): void {
		const parsed = amount.trim() === "" ? 0 : Number(amount);
		if (!Number.isFinite(parsed) || parsed < 0) {
			return;
		}
		if (parsed === (row.amount_planned ?? 0)) {
			return;
		}
		onSave({ department: row.department, amountPlanned: parsed });
	}

	const pct = row.pct_used ?? 0;

	return (
		<TableRow>
			<TableCell className="font-medium">{row.department}</TableCell>
			<TableCell className="text-right tabular-nums">
				{canEdit ? (
					<Input
						type="number"
						min={0}
						inputMode="decimal"
						value={amount}
						onChange={(event) => setAmount(event.target.value)}
						onBlur={persist}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.currentTarget.blur();
							}
						}}
						placeholder="—"
						className="w-32 text-right tabular-nums"
						aria-label={`Budget für ${row.department}`}
					/>
				) : row.amount_planned === null ? (
					"—"
				) : (
					formatFinanceAmount(row.amount_planned)
				)}
			</TableCell>
			<TableCell className="text-right tabular-nums">
				{formatFinanceAmount(row.actual_expenses)}
			</TableCell>
			<TableCell
				className={`text-right tabular-nums ${
					row.over_budget ? "text-destructive" : ""
				}`}
			>
				{row.remaining === null ? "—" : formatFinanceAmount(row.remaining)}
			</TableCell>
			<TableCell>
				{row.pct_used === null ? (
					<span className="text-sm text-muted-foreground">Kein Budget</span>
				) : (
					<div className="flex items-center gap-2">
						<Progress
							value={Math.min(pct, 100)}
							className={row.over_budget ? "[&>div]:bg-destructive" : ""}
						/>
						<span className="w-12 shrink-0 text-right text-sm tabular-nums">
							{Math.round(pct)}%
						</span>
						{row.over_budget ? (
							<Badge variant="destructive" className="shrink-0">
								Über
							</Badge>
						) : null}
					</div>
				)}
			</TableCell>
			<TableCell className="w-10 text-muted-foreground">
				{saving ? (
					<Loader2 aria-label="Speichern" className="size-4 animate-spin" />
				) : null}
			</TableCell>
		</TableRow>
	);
}
