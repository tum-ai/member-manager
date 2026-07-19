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
		source,
		generatedAt,
		isLoading,
		isFetching,
		error,
		updateDateFrom,
		updateDateTo,
		updateSearchTerm,
		updateDirection,
		refetchTransactions,
		exportTransactions,
	} = useFinanceTransactions();

	return (
		<ToolPageShell
			title="Finance Transactions"
			description="Review BuchhaltungsButler postings for the finance ledger."
		>
			<div className="flex flex-col gap-5">
				<FinanceSummarySection summary={summary} isLoading={isLoading} />
				<BuchhaltungsButlerTransactionsSection
					filters={filters}
					transactions={filteredTransactions}
					source={source}
					generatedAt={generatedAt}
					isLoading={isLoading}
					isFetching={isFetching}
					error={error}
					onDateFromChange={updateDateFrom}
					onDateToChange={updateDateTo}
					onSearchTermChange={updateSearchTerm}
					onDirectionChange={updateDirection}
					onRefresh={() => {
						void refetchTransactions();
					}}
					onExport={exportTransactions}
				/>
			</div>
		</ToolPageShell>
	);
}
