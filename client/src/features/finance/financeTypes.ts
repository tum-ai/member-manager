import type {
	BuchhaltungsButlerTransaction,
	BuchhaltungsButlerTransactionsResponse,
} from "@member-manager/shared";

export type {
	BuchhaltungsButlerTransaction,
	BuchhaltungsButlerTransactionsResponse,
};

export type FinanceDirectionFilter = "all" | "income" | "expenses";

export interface FinanceFilters {
	dateFrom: string;
	dateTo: string;
	searchTerm: string;
	direction: FinanceDirectionFilter;
}

export interface FinanceSummary {
	count: number;
	income: number;
	expenses: number;
	net: number;
	vat: number;
}
