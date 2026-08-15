import { FolderPlus, Target, X } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { formatFinanceAmount } from "@/features/finance/financeUtils";

interface FinanceTAccountSelectionBarProps {
	count: number;
	grossSum: number;
	onCreateProject: () => void;
	onAssignToProject: () => void;
	onClear: () => void;
}

// Appears as soon as one invoice is ticked (FR-K5). Sticky at the bottom on
// small screens, where the selection is usually made far from the top of a long
// column; a plain bar above the folders on wider ones.
export function FinanceTAccountSelectionBar({
	count,
	grossSum,
	onCreateProject,
	onAssignToProject,
	onClear,
}: FinanceTAccountSelectionBarProps): ReactElement | null {
	if (count === 0) {
		return null;
	}
	return (
		<section
			// A named landmark, so a screen reader can find the bar again after
			// ticking a box far away from it.
			aria-label="Auswahl"
			className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-lg sm:static sm:shadow-none"
		>
			<p className="min-w-0 flex-1 text-sm">
				<span className="font-semibold">
					{count} {count === 1 ? "Buchung" : "Buchungen"}
				</span>{" "}
				<span className="text-muted-foreground">ausgewählt ·</span>{" "}
				<span className="font-semibold tabular-nums">
					{formatFinanceAmount(grossSum)}
				</span>
			</p>
			<div className="flex flex-wrap items-center gap-2">
				<Button type="button" size="sm" onClick={onCreateProject}>
					<FolderPlus />
					Neues Projekt aus Auswahl
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={onAssignToProject}
				>
					<Target />
					Zu Projekt hinzufügen
				</Button>
				<Button type="button" size="sm" variant="ghost" onClick={onClear}>
					<X />
					Auswahl aufheben
				</Button>
			</div>
		</section>
	);
}
