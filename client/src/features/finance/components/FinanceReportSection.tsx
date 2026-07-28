import type {
	FinancePeriodReportAmounts,
	FinancePeriodReportResponse,
	FinanceProject,
} from "@member-manager/shared";
import { Download, Loader2, Printer } from "lucide-react";
import type { ReactElement } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import {
	formatBereichLabel,
	formatFinanceAmount,
	formatFinancePeriodLabel,
} from "@/features/finance/financeUtils";
import { FinanceManagementPeriodControls } from "./FinanceManagementPeriodControls";

export interface FinanceReportSectionProps {
	period: FinancePeriod;
	report?: FinancePeriodReportResponse;
	isLoading: boolean;
	error: Error | null;
	isExporting: boolean;
	onPeriodTypeChange: (type: FinanceProject["period_type"]) => void;
	onPeriodKeyChange: (key: string) => void;
	onExport: () => Promise<void>;
	onPrint: () => void;
}

export function FinanceReportSection({
	period,
	report,
	isLoading,
	error,
	isExporting,
	onPeriodTypeChange,
	onPeriodKeyChange,
	onExport,
	onPrint,
}: FinanceReportSectionProps): ReactElement {
	return (
		<div className="flex flex-col gap-4 print:gap-2">
			<div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
				<FinanceManagementPeriodControls
					idPrefix="finance-report"
					period={period}
					onPeriodTypeChange={onPeriodTypeChange}
					onPeriodKeyChange={onPeriodKeyChange}
				/>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={!report}
						onClick={onPrint}
					>
						<Printer />
						Print
					</Button>
					<Button
						type="button"
						disabled={!report || isExporting}
						className="bg-[#9A64D9] text-white hover:bg-[#523573]"
						onClick={() => {
							void onExport();
						}}
					>
						{isExporting ? <Loader2 className="animate-spin" /> : <Download />}
						Export XLSX
					</Button>
				</div>
			</div>

			<div className="hidden print:block">
				<h2 className="text-xl font-semibold">
					Finance report {formatFinancePeriodLabel(period)}
				</h2>
			</div>

			{error ? (
				<Alert variant="destructive" className="print:hidden">
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : null}

			{isLoading ? (
				<Skeleton className="h-80 w-full" />
			) : report ? (
				<>
					<ReportMetrics totals={report.totals} />
					<DepartmentTable report={report} />
					<TaxAreaTable report={report} />
					<p className="text-right text-xs text-muted-foreground">
						{report.source === "real" ? "Live data" : "Mock data"} · Generated{" "}
						{formatGeneratedAt(report.generated_at)}
					</p>
				</>
			) : (
				<p className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
					No report data for the selected period.
				</p>
			)}
		</div>
	);
}

function ReportMetrics({
	totals,
}: {
	totals: FinancePeriodReportAmounts;
}): ReactElement {
	const metrics = [
		{ label: "Budget", value: totals.budget },
		{ label: "Planned expenses", value: totals.plan },
		{ label: "Planned income", value: totals.planned_income ?? 0 },
		{ label: "Planned net", value: totals.planned_net ?? -totals.plan },
		{ label: "Actual", value: totals.actual },
		{ label: "Remaining", value: totals.remaining },
		{ label: "Forecast", value: totals.forecast },
	];

	return (
		<section
			aria-label="Report metrics"
			className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7"
		>
			{metrics.map((metric) => (
				<div
					key={metric.label}
					className="rounded-md border bg-card px-3 py-3 shadow-sm print:border-0 print:px-0 print:shadow-none"
				>
					<p className="text-xs text-muted-foreground">{metric.label}</p>
					<p
						className={`mt-1 text-lg font-semibold tabular-nums ${
							metric.label === "Remaining" && metric.value < 0
								? "text-destructive"
								: ""
						}`}
					>
						{formatFinanceAmount(metric.value)}
					</p>
				</div>
			))}
		</section>
	);
}

function DepartmentTable({
	report,
}: {
	report: FinancePeriodReportResponse;
}): ReactElement {
	return (
		<section className="overflow-hidden rounded-md border bg-card shadow-sm print:border-0 print:shadow-none">
			<div className="flex items-center justify-between border-b px-4 py-3 print:px-0">
				<h3 className="text-sm font-semibold">Departments</h3>
				<Badge variant="neutral">{report.departments.length}</Badge>
			</div>
			<div className="scrollbar-thin overflow-x-auto">
				<Table className="min-w-[760px]">
					<TableHeader>
						<TableRow>
							<TableHead>Department</TableHead>
							<TableHead className="text-right">Budget</TableHead>
							<TableHead className="text-right">Plan</TableHead>
							<TableHead className="text-right">Planned income</TableHead>
							<TableHead className="text-right">Planned net</TableHead>
							<TableHead className="text-right">Actual</TableHead>
							<TableHead className="text-right">Remaining</TableHead>
							<TableHead className="text-right">Forecast</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{report.departments.map((row) => (
							<TableRow key={row.department}>
								<TableCell className="font-medium">{row.department}</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.budget)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.plan)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.planned_income ?? 0)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.planned_net ?? -row.plan)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.actual)}
								</TableCell>
								<TableCell
									className={`text-right tabular-nums ${
										row.remaining < 0 ? "text-destructive" : ""
									}`}
								>
									{formatFinanceAmount(row.remaining)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.forecast)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}

function TaxAreaTable({
	report,
}: {
	report: FinancePeriodReportResponse;
}): ReactElement {
	return (
		<section className="overflow-hidden rounded-md border bg-card shadow-sm print:border-0 print:shadow-none">
			<div className="flex items-center justify-between border-b px-4 py-3 print:px-0">
				<h3 className="text-sm font-semibold">Tax realms</h3>
				<Badge variant="neutral">{report.tax_area_totals.length}</Badge>
			</div>
			<div className="scrollbar-thin overflow-x-auto">
				<Table className="min-w-[920px]">
					<TableHeader>
						<TableRow>
							<TableHead>Tax realm</TableHead>
							<TableHead className="text-right">Target</TableHead>
							<TableHead className="text-right">Plan</TableHead>
							<TableHead className="text-right">Planned income</TableHead>
							<TableHead className="text-right">Planned net</TableHead>
							<TableHead className="text-right">Income</TableHead>
							<TableHead className="text-right">Expenses</TableHead>
							<TableHead className="text-right">Net</TableHead>
							<TableHead className="text-right">Forecast expenses</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{report.tax_area_totals.map((row) => (
							<TableRow key={row.tax_area ?? "none"}>
								<TableCell className="font-medium">
									{formatBereichLabel(row.tax_area)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.target_amount)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.plan)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.planned_income ?? 0)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.planned_net ?? -row.plan)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.actual_income)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.actual_expenses)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.actual_net)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatFinanceAmount(row.forecast_expenses)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}

function formatGeneratedAt(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}
