import type { ReactElement } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
	FinanceAnalyticsResponse,
	FinanceVatRateSummary,
} from "@/features/finance/financeTypes";
import { formatFinanceAmount } from "@/features/finance/financeUtils";

interface FinanceVatSummarySectionProps {
	totals?: FinanceAnalyticsResponse["totals"];
	byVatRate?: FinanceVatRateSummary[];
	isLoading: boolean;
}

// Whole-percent rates render without decimals ("19 %"), fractional ones keep
// up to one ("8,5 %").
function formatVatRate(rate: number): string {
	return `${rate.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

export function FinanceVatSummarySection({
	totals,
	byVatRate,
	isLoading,
}: FinanceVatSummarySectionProps): ReactElement {
	const grossExpenses = totals?.expenses ?? 0;
	const vat = totals?.vat ?? 0;
	const netExpenses = grossExpenses - vat;

	const metrics = [
		{ label: "Ausgaben brutto", value: grossExpenses },
		{ label: "enthaltene USt.", value: vat },
		{ label: "Ausgaben netto", value: netExpenses },
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Umsatzsteuer</CardTitle>
				<CardDescription>
					In den Bruttoausgaben enthaltene USt. und der Nettobetrag, aufgeteilt
					nach Steuersatz.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					{metrics.map((metric) => (
						<div key={metric.label} className="rounded-lg border bg-card p-4">
							<p className="text-sm font-medium text-muted-foreground">
								{metric.label}
							</p>
							{isLoading ? (
								<Skeleton className="mt-2 h-7 w-28" />
							) : (
								<p className="mt-1 text-xl font-semibold tabular-nums">
									{formatFinanceAmount(metric.value)}
								</p>
							)}
						</div>
					))}
				</div>

				{isLoading ? (
					<Skeleton className="h-40 w-full" />
				) : (
					<VatRateTable byVatRate={byVatRate} />
				)}
			</CardContent>
		</Card>
	);
}

function VatRateTable({
	byVatRate,
}: {
	byVatRate?: FinanceVatRateSummary[];
}): ReactElement {
	const rows = byVatRate ?? [];
	if (rows.length === 0) {
		return (
			<div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
				Keine Ausgaben im gewählten Zeitraum.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Steuersatz</TableHead>
						<TableHead className="text-right">Brutto</TableHead>
						<TableHead className="text-right">USt.</TableHead>
						<TableHead className="text-right">Netto</TableHead>
						<TableHead className="text-right">Buchungen</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row.rate}>
							<TableCell className="font-medium tabular-nums">
								{formatVatRate(row.rate)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatFinanceAmount(row.expenses)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatFinanceAmount(row.vat)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatFinanceAmount(row.expenses - row.vat)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{row.count}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
