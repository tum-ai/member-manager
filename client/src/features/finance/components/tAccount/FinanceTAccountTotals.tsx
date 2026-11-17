import { Receipt, Wallet } from "lucide-react";
import type { ReactElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TAccountAmountMode } from "@/features/finance/financeTAccountUtils";
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

// The department's headline numbers: both balances and the VAT the department
// owes the tax office, named by direction.
export function TotalsSummary({
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
	// The balances come from the server in both modes, so the header can never
	// disagree with the columns below it.
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
						{/* The active mode is stated, never merely implied. */}
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
						// Signed on purpose: a negative "Zahllast" is a refund, not a debt.
						// The forecast is only worth stating when the still-open plan
						// actually changes it.
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
