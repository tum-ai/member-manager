import { Unlink } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { TAccountMatchView } from "@/features/finance/financeTAccountUtils";
import { formatFinanceAmount } from "@/features/finance/financeUtils";

// Shared building blocks for the two detail panels (FR-K2/FR-K4), so a posting
// and a Planposten read as the same object with different fields.

export function DetailList({
	children,
}: {
	children: ReactNode;
}): ReactElement {
	return (
		<dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
			{children}
		</dl>
	);
}

// A missing value renders as an em dash, never as "0 €" — an unknown VAT rate
// and a zero-rated invoice are different facts (FR-N5).
export function DetailField({
	label,
	value,
}: {
	label: string;
	value: ReactNode;
}): ReactElement {
	return (
		<div className="min-w-0">
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd className="break-words text-sm text-foreground">{value ?? "—"}</dd>
		</div>
	);
}

export function DetailBlock({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}): ReactElement {
	return (
		<div className="rounded-md bg-muted/40 p-3">
			<h5 className="text-xs font-semibold uppercase text-muted-foreground">
				{title}
			</h5>
			{children}
		</div>
	);
}

export function TAccountMatchList({
	matches,
	emptyLabel,
	onDetach,
}: {
	matches: TAccountMatchView[];
	emptyLabel: string;
	// Detaching restores the open remainder and walks the Planposten's status
	// back (FR-M7). Absent for a read-only viewer.
	onDetach?: (matchId: string) => void;
}): ReactElement {
	if (matches.length === 0) {
		return <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>;
	}
	return (
		<ul className="mt-2 grid gap-1 text-sm">
			{matches.map((match) => (
				<li
					key={match.key}
					className="flex flex-wrap items-center justify-between gap-2"
				>
					<span className="min-w-0 truncate">{match.label}</span>
					<span className="flex items-center gap-1">
						<span className="tabular-nums">
							{formatFinanceAmount(match.amount)}
						</span>
						{onDetach ? (
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								aria-label={`Zuordnung ${match.label} entfernen`}
								onClick={() => onDetach(match.key)}
							>
								<Unlink />
							</Button>
						) : null}
					</span>
				</li>
			))}
		</ul>
	);
}
