import type {
	BuchhaltungsButlerTransaction,
	BuchhaltungsButlerTransactionsResponse,
} from "@member-manager/shared";

export type {
	BuchhaltungsButlerTransaction,
	BuchhaltungsButlerTransactionsResponse,
};

export type FinanceDirectionFilter = "all" | "income" | "expenses";
export type FinanceSortOrder = "date-desc" | "date-asc";

export interface FinanceFilters {
	dateFrom: string;
	dateTo: string;
	searchTerm: string;
	direction: FinanceDirectionFilter;
	sortOrder: FinanceSortOrder;
}

export interface FinanceSummary {
	count: number;
	income: number;
	expenses: number;
	net: number;
	vat: number;
}
