import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import {
	type TAccountDisplayLine,
	vatLabel,
} from "@/features/finance/financeTAccountUtils";
import type {
	FinancePlanStatus,
	FinanceTAccountPlanDetail,
} from "@/features/finance/financeTypes";
import {
	formatFinanceAmount,
	formatFinanceMonth,
} from "@/features/finance/financeUtils";
import { cn } from "@/lib/utils";
import {
	DetailBlock,
	DetailField,
	DetailList,
	TAccountMatchList,
} from "./FinanceTAccountDetailList";

const STATUS_LABELS: Record<FinancePlanStatus, string> = {
	planned: "Geplant",
	committed: "Zugesagt",
	spent: "Ausgegeben",
};

// Overspent (more invoiced than planned) is the state worth flagging; an open
// remainder is normal. The sign in the number carries the meaning, colour only
// reinforces it (a11y).
function deltaClass(delta: number): string {
	if (delta > 0) return "text-destructive";
	return "text-foreground";
}

// The expanded detail of a Planposten (FR-K4) with the Plan / Ist / Delta
// readout that "Plan auf Ist korrigieren" will act on in Phase 3 (FR-M6).
export function FinancePlanItemDetailPanel({
	line,
	detail,
}: {
	line: TAccountDisplayLine;
	detail: FinanceTAccountPlanDetail;
}): ReactElement {
	const plannedVat =
		detail.vat_rate !== null && detail.vat_rate > 0 && line.vatAmount !== null
			? formatFinanceAmount(line.vatAmount)
			: null;

	return (
		<div className="mb-2 ml-5 grid gap-3 rounded-md border border-border/60 bg-background p-3">
			<DetailList>
				<DetailField
					label="Status"
					value={
						<span className="flex flex-wrap items-center gap-1.5">
							<Badge variant="neutral">
								{line.status ? STATUS_LABELS[line.status] : "Geplant"}
							</Badge>
							{detail.is_active ? null : (
								<Badge variant="warning">Deaktiviert</Badge>
							)}
						</span>
					}
				/>
				<DetailField
					label="Erwarteter Monat"
					value={
						detail.expected_month === null
							? null
							: formatFinanceMonth(detail.expected_month)
					}
				/>
				<DetailField
					label="Steuersatz"
					value={
						detail.vat_rate === null
							? null
							: `${detail.vat_rate.toLocaleString("de-DE")} %`
					}
				/>
				<DetailField
					label={`${vatLabel(line.direction)} (geplant)`}
					value={plannedVat}
				/>
				<DetailField label="Kategorie" value={line.category} />
				<DetailField label="Notiz" value={detail.note} />
			</DetailList>

			<div className="grid gap-2 lg:grid-cols-2">
				<DetailBlock title="Plan / Ist / Delta">
					<dl className="mt-2 grid gap-1 text-sm">
						<div className="flex items-baseline justify-between gap-2">
							<dt className="text-muted-foreground">Plan</dt>
							<dd className="tabular-nums">
								{formatFinanceAmount(detail.planned_amount)}
							</dd>
						</div>
						<div className="flex items-baseline justify-between gap-2">
							<dt className="text-muted-foreground">Ist</dt>
							<dd className="tabular-nums">
								{formatFinanceAmount(detail.matched_amount)}
							</dd>
						</div>
						<div className="flex items-baseline justify-between gap-2">
							<dt className="text-muted-foreground">Delta</dt>
							<dd
								className={cn(
									"font-semibold tabular-nums",
									deltaClass(detail.delta),
								)}
							>
								{formatFinanceAmount(detail.delta)}
							</dd>
						</div>
					</dl>
				</DetailBlock>
				<DetailBlock title="Zugeordnete Buchungen">
					<TAccountMatchList
						matches={line.matches}
						emptyLabel="Noch keine Buchung zugeordnet."
					/>
				</DetailBlock>
			</div>
		</div>
	);
}
