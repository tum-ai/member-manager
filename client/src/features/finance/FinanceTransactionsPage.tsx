import type { ReactElement } from "react";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { BuchhaltungsButlerTransactionsSection } from "./components/BuchhaltungsButlerTransactionsSection";
import { FinanceSummarySection } from "./components/FinanceSummarySection";
import { useFinanceTransactions } from "./hooks/useFinanceTransactions";

export default function FinanceTransactionsPage(): ReactElement {
	const {
		filters,
		filteredTransactions,
		summary,
		generatedAt,
		isLoading,
		isFetching,
		error,
		updateDateFrom,
		updateDateTo,
		updateSearchTerm,
		updateDirection,
		updateSortOrder,
		refetchTransactions,
		exportTransactions,
	} = useFinanceTransactions();

	return (
		<ToolPageShell
			title="Finance Transactions"
			description="Review BuchhaltungsButler postings with their ledger accounts (Sachkonten) and cost centers (Kostenstellen)."
		>
			<div className="flex flex-col gap-5">
				<FinanceSummarySection summary={summary} isLoading={isLoading} />
				<BuchhaltungsButlerTransactionsSection
					filters={filters}
					transactions={filteredTransactions}
					generatedAt={generatedAt}
					isLoading={isLoading}
					isFetching={isFetching}
					error={error}
					onDateFromChange={updateDateFrom}
					onDateToChange={updateDateTo}
					onSearchTermChange={updateSearchTerm}
					onDirectionChange={updateDirection}
					onSortOrderChange={updateSortOrder}
					onRefresh={() => {
						void refetchTransactions();
					}}
					onExport={exportTransactions}
				/>
			</div>
		</ToolPageShell>
	);
}
