import type { ReactElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinanceTAccountResponse } from "@/features/finance/financeTypes";
import {
	type FinancePeriod,
	formatFinanceAmount,
	formatFinancePeriodLabel,
} from "@/features/finance/financeUtils";
import { cn } from "@/lib/utils";

function saldoClass(value: number): string {
	if (value > 0) return "text-emerald-600 dark:text-emerald-400";
	if (value < 0) return "text-destructive";
	return "text-foreground";
}

// The department's headline numbers: both salden and the VAT the department owes
// the tax office, named by direction (FR-N2/FR-N3).
export function TotalsSummary({
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
	const vatPayload = totals?.vat_payload ?? 0;
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base">
					{department} — {formatFinancePeriodLabel(period)}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
						hint={
							vatPayload < 0
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
