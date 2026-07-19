import { ArrowDownLeft, ArrowUpRight, ReceiptText, Scale } from "lucide-react";
import type { ReactElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FinanceSummary } from "@/features/finance/financeTypes";
import { formatFinanceAmount } from "@/features/finance/financeUtils";

interface FinanceSummarySectionProps {
	summary: FinanceSummary;
	isLoading: boolean;
}

export function FinanceSummarySection({
	summary,
	isLoading,
}: FinanceSummarySectionProps): ReactElement {
	const metrics = [
		{
			label: "Income",
			value: formatFinanceAmount(summary.income),
			icon: ArrowUpRight,
			className: "text-emerald-700 dark:text-emerald-400",
		},
		{
			label: "Expenses",
			value: formatFinanceAmount(summary.expenses),
			icon: ArrowDownLeft,
			className: "text-destructive",
		},
		{
			label: "Net",
			value: formatFinanceAmount(summary.net),
			icon: Scale,
			className:
				summary.net >= 0
					? "text-emerald-700 dark:text-emerald-400"
					: "text-destructive",
		},
		{
			label: "Postings",
			value: String(summary.count),
			icon: ReceiptText,
			className: "text-foreground",
		},
	] as const;

	return (
		<section
			aria-label="Finance summary"
			className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
		>
			{metrics.map((metric) => (
				<Card key={metric.label}>
					<CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							{metric.label}
						</CardTitle>
						<metric.icon className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<Skeleton className="h-8 w-32" />
						) : (
							<p
								className={`text-2xl font-semibold tabular-nums ${metric.className}`}
							>
								{metric.value}
							</p>
						)}
					</CardContent>
				</Card>
			))}
		</section>
	);
}
