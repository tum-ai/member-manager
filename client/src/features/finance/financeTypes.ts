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
	FinanceBudgetVsActualResponse,
	FinanceBudgetVsActualRow,
	FinanceCategoryMappingRow,
	FinanceCategoryMappingsResponse,
	FinanceCategoryMappingUpsert,
	FinanceCategorySummary,
	FinanceDepartmentMappingRow,
	FinanceDepartmentMappingsResponse,
	FinanceDepartmentMappingUpsert,
	FinanceDepartmentSummary,
	FinanceMonthlyPoint,
	FinancePeriodType,
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
	FinanceBudgetVsActualResponse,
	FinanceBudgetVsActualRow,
	FinanceCategoryMappingRow,
	FinanceCategoryMappingsResponse,
	FinanceCategoryMappingUpsert,
	FinanceCategorySummary,
	FinanceDepartmentMappingRow,
	FinanceDepartmentMappingsResponse,
	FinanceDepartmentMappingUpsert,
	FinanceDepartmentSummary,
	FinanceMonthlyPoint,
	FinancePeriodType,
	FinanceVatRateSummary,
};

export interface FinanceDateRange {
	dateFrom: string;
	dateTo: string;
}

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
