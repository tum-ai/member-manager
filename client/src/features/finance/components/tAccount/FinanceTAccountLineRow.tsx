import { ChevronRight, FolderClosed } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	type TAccountDisplayLine,
	vatLabel,
} from "@/features/finance/financeTAccountUtils";
import { formatFinanceAmount } from "@/features/finance/financeUtils";
import { cn } from "@/lib/utils";
import { FinancePlanItemDetailPanel } from "./FinancePlanItemDetailPanel";
import { FinancePostingDetailPanel } from "./FinancePostingDetailPanel";
import type { TAccountInteraction } from "./tAccountInteraction";

// The embedded VAT, stated in words next to the amount rather than hidden in a
// hover tooltip: it must be readable on touch and by a screen reader, and it
// must name its side of the ledger (FR-N1/FR-N2).
function VatNote({ line }: { line: TAccountDisplayLine }): ReactElement | null {
	if (line.vatAmount === null || line.vatAmount <= 0) {
		return null;
	}
	return (
		<span className="block text-xs font-normal text-muted-foreground">
			inkl. {formatFinanceAmount(line.vatAmount)} {vatLabel(line.direction)}
		</span>
	);
}

function LineLabel({ line }: { line: TAccountDisplayLine }): ReactElement {
	return (
		<span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
			{line.isProjectRollup ? (
				<FolderClosed
					className="size-3.5 shrink-0 self-center text-muted-foreground"
					aria-hidden
				/>
			) : null}
			<span className="truncate font-medium">{line.label}</span>
			{line.category ? (
				<span className="text-xs text-muted-foreground">· {line.category}</span>
			) : null}
			{line.kind === "plan" ? (
				<Badge variant="neutral" className="ml-0.5">
					Geplant
				</Badge>
			) : null}
			{line.isActive ? null : (
				<Badge variant="warning" className="ml-0.5">
					Deaktiviert
				</Badge>
			)}
		</span>
	);
}

function LineAmount({ line }: { line: TAccountDisplayLine }): ReactElement {
	return (
		<span className="shrink-0 text-right">
			<span className="tabular-nums">{formatFinanceAmount(line.amount)}</span>
			<VatNote line={line} />
		</span>
	);
}

// One row of a T-account column. Real lines (a booked posting or a Planposten)
// expand in place to their detail (FR-K2/FR-K4); a rolled-up child-project
// folder line has no detail of its own and stays static — the child renders as
// its own node below.
export function FinanceTAccountLineRow({
	line,
	interaction,
}: {
	line: TAccountDisplayLine;
	interaction?: TAccountInteraction;
}): ReactElement {
	const [open, setOpen] = useState(false);
	const isPlan = line.kind === "plan";
	const muted = isPlan || !line.isActive;
	const rowClass = cn(
		"flex w-full items-baseline justify-between gap-3 py-1.5 text-left text-sm",
		muted && "text-muted-foreground",
		!line.isActive && "opacity-70",
	);

	if (line.postingDetail === null && line.planDetail === null) {
		return (
			<div className={rowClass}>
				<LineLabel line={line} />
				<LineAmount line={line} />
			</div>
		);
	}

	// Only booked invoices are selectable, and only for someone who may write the
	// department (FR-K1/FR-K6). A Planposten is not an invoice; a read-only user
	// still gets the disclosure.
	const postingExternalId = line.postingExternalId;
	const selectable =
		interaction?.canWrite === true &&
		line.kind === "actual" &&
		postingExternalId !== null;

	return (
		<div className="flex items-start gap-2">
			{selectable ? (
				<Checkbox
					className="mt-2 shrink-0"
					checked={interaction.isSelected(postingExternalId)}
					onCheckedChange={() => interaction.onToggleSelect(postingExternalId)}
					aria-label={`${line.label} auswählen`}
				/>
			) : null}
			<Collapsible
				open={open}
				onOpenChange={setOpen}
				className="min-w-0 flex-1"
			>
				<CollapsibleTrigger
					className={cn(
						rowClass,
						"rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					)}
				>
					<span className="flex min-w-0 items-baseline gap-1.5">
						<ChevronRight
							className={cn(
								"size-3.5 shrink-0 self-center text-muted-foreground transition-transform",
								open && "rotate-90",
							)}
							aria-hidden
						/>
						<LineLabel line={line} />
					</span>
					<LineAmount line={line} />
				</CollapsibleTrigger>
				<CollapsibleContent>
					{line.postingDetail !== null ? (
						<FinancePostingDetailPanel
							line={line}
							detail={line.postingDetail}
							interaction={interaction}
							onAssignToProject={
								selectable
									? () =>
											interaction.onAssignPosting(
												postingExternalId,
												line.amount,
											)
									: undefined
							}
						/>
					) : null}
					{line.planDetail !== null ? (
						<FinancePlanItemDetailPanel
							line={line}
							detail={line.planDetail}
							interaction={interaction}
						/>
					) : null}
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}
