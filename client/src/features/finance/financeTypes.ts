import type {
	BuchhaltungsButlerTransaction,
	BuchhaltungsButlerTransactionsResponse,
	FinanceAccountLabelRow,
	FinanceAccountLabelsResponse,
	FinanceAccountLabelUpsert,
	FinanceAccountSummary,
	FinanceAnalyticsResponse,
	FinanceBereich,
	FinanceBereichSummary,
	FinanceCategoryMappingRow,
	FinanceCategoryMappingsResponse,
	FinanceCategoryMappingUpsert,
	FinanceCategorySummary,
	FinanceDepartmentMappingRow,
	FinanceDepartmentMappingsResponse,
	FinanceDepartmentMappingUpsert,
	FinanceDepartmentSummary,
	FinanceMonthlyPoint,
	FinanceVatRateSummary,
} from "@member-manager/shared";

export type {
	BuchhaltungsButlerTransaction,
	BuchhaltungsButlerTransactionsResponse,
	FinanceAccountLabelRow,
	FinanceAccountLabelsResponse,
	FinanceAccountLabelUpsert,
	FinanceAccountSummary,
	FinanceAnalyticsResponse,
	FinanceBereich,
	FinanceBereichSummary,
	FinanceCategoryMappingRow,
	FinanceCategoryMappingsResponse,
	FinanceCategoryMappingUpsert,
	FinanceCategorySummary,
	FinanceDepartmentMappingRow,
	FinanceDepartmentMappingsResponse,
	FinanceDepartmentMappingUpsert,
	FinanceDepartmentSummary,
	FinanceMonthlyPoint,
	FinanceVatRateSummary,
};

export interface FinanceDateRange {
	dateFrom: string;
	dateTo: string;
}

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
