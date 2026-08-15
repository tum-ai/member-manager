import { Link2, Send, Split, Target } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
	type TAccountDisplayLine,
	vatLabel,
} from "@/features/finance/financeTAccountUtils";
import type { FinanceTAccountPostingDetail } from "@/features/finance/financeTypes";
import {
	formatBereichLabel,
	formatFinanceAmount,
	formatFinanceDate,
} from "@/features/finance/financeUtils";
import {
	DetailBlock,
	DetailField,
	DetailList,
	TAccountMatchList,
} from "./FinanceTAccountDetailList";
import type { TAccountInteraction } from "./tAccountInteraction";

function formatRate(rate: number | null): string {
	// A rate the import never carried is unknown, not zero.
	return rate === null ? "—" : `${rate.toLocaleString("de-DE")} %`;
}

function accountValue(detail: FinanceTAccountPostingDetail): string {
	const accounts = `${detail.debit_account ?? "—"} / ${detail.credit_account ?? "—"}`;
	return detail.account_label
		? `${accounts} · ${detail.account_label}`
		: accounts;
}

function costLocationValue(detail: FinanceTAccountPostingDetail): string {
	const costLocation = detail.cost_location ?? "—";
	return detail.sub_team
		? `${costLocation} · ${detail.sub_team}`
		: costLocation;
}

// The expanded detail of a booked invoice (FR-K2). Everything shown here travels
// inline on the T-account line, so opening a row costs no request (FR-K3).
export function FinancePostingDetailPanel({
	line,
	detail,
	interaction,
	onAssignToProject,
}: {
	line: TAccountDisplayLine;
	detail: FinanceTAccountPostingDetail;
	interaction?: TAccountInteraction;
	// Absent for a read-only viewer (FR-K6); present, this files just this one
	// invoice into an existing project (FR-L2).
	onAssignToProject?: () => void;
}): ReactElement {
	// `line.amount` is this department's share after allocation splits, while
	// `posting_amount` is what the bank booked — on a split posting they differ,
	// and showing both is the point of the panel.
	const isSplitShare =
		Math.abs(Math.abs(detail.posting_amount) - line.amount) >= 0.01;

	return (
		<div className="mb-2 ml-5 grid gap-3 rounded-md border border-border/60 bg-background p-3">
			<DetailList>
				<DetailField
					label="Buchungsdatum"
					value={formatFinanceDate(detail.booking_date)}
				/>
				<DetailField label="Belegnummer" value={detail.invoice_number} />
				<DetailField label="Gegenpartei" value={detail.counterparty} />
				<DetailField label="Verwendungszweck" value={detail.purpose} />
				<DetailField
					label="Buchungsbetrag"
					value={formatFinanceAmount(detail.posting_amount, detail.currency)}
				/>
				{isSplitShare ? (
					<DetailField
						label="Anteil dieses Departments"
						value={formatFinanceAmount(line.amount)}
					/>
				) : null}
				<DetailField label="Steuersatz" value={formatRate(line.vatRate)} />
				<DetailField
					label={vatLabel(line.direction)}
					value={
						line.vatAmount === null ? null : formatFinanceAmount(line.vatAmount)
					}
				/>
				<DetailField
					label="Netto"
					value={formatFinanceAmount(line.netAmount)}
				/>
				<DetailField
					label="Konto (Soll / Haben)"
					value={accountValue(detail)}
				/>
				<DetailField label="Kostenstelle" value={costLocationValue(detail)} />
				<DetailField label="Kategorie" value={line.category} />
			</DetailList>

			<div className="grid gap-2 lg:grid-cols-2">
				<DetailBlock title="Zuordnung">
					{line.allocations.length === 0 ? (
						<p className="mt-2 text-sm text-muted-foreground">
							Automatische Zuordnung aus der Kostenstelle.
						</p>
					) : (
						<ul className="mt-2 grid gap-1 text-sm">
							{line.allocations.map((allocation) => (
								<li
									key={allocation.key}
									className="flex flex-wrap items-baseline justify-between gap-2"
								>
									<span className="min-w-0">
										{allocation.department ?? "Ohne Department"}
										{allocation.projectName
											? ` · ${allocation.projectName}`
											: ""}{" "}
										· {formatBereichLabel(allocation.taxArea)}
									</span>
									<span className="tabular-nums">
										{allocation.percentage.toLocaleString("de-DE")} % ·{" "}
										{formatFinanceAmount(allocation.amount)}
									</span>
								</li>
							))}
						</ul>
					)}
				</DetailBlock>
				<DetailBlock title="Planabgleich">
					<TAccountMatchList
						matches={line.matches}
						emptyLabel="Noch kein Planposten verknüpft."
						onDetach={
							interaction?.canWrite === true
								? (matchId) => interaction.onDetachMatch(matchId)
								: undefined
						}
					/>
				</DetailBlock>
			</div>

			{onAssignToProject ? (
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onAssignToProject}
					>
						<Target />
						Zu Projekt hinzufügen
					</Button>
					{/* FR-M5 from the invoice side: pick the Planposten this invoice
					    settles. */}
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => interaction?.onMatchFromPosting(line)}
					>
						<Link2 />
						Planposten zuordnen
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => interaction?.onRequestReallocation(line)}
					>
						<Send />
						Umverteilung beantragen
					</Button>
					{/* A split posting cannot take the fast path without destroying its
					    split, so it is edited here instead (FR-L5). */}
					{line.allocations.length > 1 ? (
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => interaction?.onEditSplit(line)}
						>
							<Split />
							Aufteilung bearbeiten
						</Button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
