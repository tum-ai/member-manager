import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FinanceTAccountGroup } from "@/features/finance/financeTypes";

export interface FinanceTAccountSelection {
	selectedIds: string[];
	count: number;
	// Σ of the selected invoices as a gross magnitude, for the selection bar.
	grossSum: number;
	isSelected: (postingExternalId: string) => boolean;
	toggle: (postingExternalId: string) => void;
	clear: () => void;
}

// Index every booked line by its posting id so the selection can be summed.
// Deliberately built from the *flat* server groups rather than the display tree:
// the tree injects rolled-up folder lines that repeat a child's money in its
// parent, which would double-count. A posting split across two projects has one
// line per share, and the selection holds the whole invoice, so the shares are
// summed back together.
function collectPostingAmounts(
	groups: FinanceTAccountGroup[],
): Map<string, number> {
	const amounts = new Map<string, number>();
	for (const group of groups) {
		for (const line of [...group.expense_lines, ...group.income_lines]) {
			if (line.kind !== "actual" || line.posting_external_id === null) {
				continue;
			}
			const id = line.posting_external_id;
			amounts.set(id, (amounts.get(id) ?? 0) + line.amount);
		}
	}
	return amounts;
}

// Selection is scoped to the whole department view, not to one folder, so
// invoices from different sub-teams and projects can be collected into one new
// project (FR-K1). It is deliberately *not* derived from the query data: a
// background refetch must not drop what the user has ticked (FR-K7).
export function useFinanceTAccountSelection({
	groups,
	department,
	periodKey,
	periodType,
}: {
	groups: FinanceTAccountGroup[];
	department: string | null;
	periodKey: string;
	periodType: string;
}): FinanceTAccountSelection {
	const [selected, setSelected] = useState<ReadonlySet<string>>(
		() => new Set<string>(),
	);

	// Changing department or period changes what the ids even mean, so the
	// selection is cleared — but only on an actual change, never on a refetch.
	const scope = `${department ?? ""}${periodType}${periodKey}`;
	const lastScope = useRef(scope);
	useEffect(() => {
		if (lastScope.current === scope) {
			return;
		}
		lastScope.current = scope;
		setSelected(new Set<string>());
	}, [scope]);

	const amounts = useMemo(() => collectPostingAmounts(groups), [groups]);

	const toggle = useCallback((postingExternalId: string): void => {
		setSelected((current) => {
			const next = new Set(current);
			if (!next.delete(postingExternalId)) {
				next.add(postingExternalId);
			}
			return next;
		});
	}, []);

	const clear = useCallback((): void => {
		setSelected(new Set<string>());
	}, []);

	const isSelected = useCallback(
		(postingExternalId: string): boolean => selected.has(postingExternalId),
		[selected],
	);

	const selectedIds = useMemo(() => [...selected], [selected]);
	const grossSum = useMemo(() => {
		let sum = 0;
		for (const id of selected) {
			sum += amounts.get(id) ?? 0;
		}
		return Math.round(sum * 100) / 100;
	}, [selected, amounts]);

	return {
		selectedIds,
		count: selected.size,
		grossSum,
		isSelected,
		toggle,
		clear,
	};
}
