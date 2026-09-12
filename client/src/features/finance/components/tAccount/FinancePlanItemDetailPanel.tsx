import {
	Equal,
	Link2,
	PauseCircle,
	Pencil,
	PlayCircle,
	Trash2,
} from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { TAccountInteraction } from "./tAccountInteraction";

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

// The expanded detail of a Planposten (FR-K4), and the place it is worked on:
// edit, park, match, detach, and correct the plan to what actually arrived
// (FR-M2/M3/M5/M6/M7).
export function FinancePlanItemDetailPanel({
	line,
	detail,
	interaction,
}: {
	line: TAccountDisplayLine;
	detail: FinanceTAccountPlanDetail;
	interaction?: TAccountInteraction;
}): ReactElement {
	const planItemId = line.planItemId;
	const canWrite = interaction?.canWrite === true && planItemId !== null;
	// Correcting is only meaningful once something has arrived and the two
	// numbers disagree.
	const canCorrect =
		canWrite && detail.matched_amount > 0 && detail.delta !== 0;
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
						onDetach={
							canWrite
								? (matchId) => interaction.onDetachMatch(matchId)
								: undefined
						}
					/>
				</DetailBlock>
			</div>

			{canWrite ? (
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => interaction.onEditPlanItem(line)}
					>
						<Pencil />
						Bearbeiten
					</Button>
					{detail.is_active ? (
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => interaction.onMatchFromPlanItem(line)}
						>
							<Link2 />
							Buchung zuordnen
						</Button>
					) : null}
					{canCorrect ? (
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() =>
								interaction.onCorrectPlanToActual(
									planItemId,
									detail.matched_amount,
								)
							}
						>
							<Equal />
							Plan auf Ist korrigieren
						</Button>
					) : null}
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={() =>
							interaction.onTogglePlanItem(planItemId, !detail.is_active)
						}
					>
						{detail.is_active ? <PauseCircle /> : <PlayCircle />}
						{detail.is_active ? "Deaktivieren" : "Aktivieren"}
					</Button>
					{/* Only offered while nothing is matched: money that already
					    arrived should be detached deliberately first (FR-M7). */}
					{detail.matched_amount === 0 ? (
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="text-destructive hover:text-destructive"
							onClick={() =>
								interaction.onDeletePlanItem(planItemId, line.label)
							}
						>
							<Trash2 />
							Löschen
						</Button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
