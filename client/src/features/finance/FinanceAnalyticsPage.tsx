import type { ReactElement } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { AccountLabelEditorSection } from "./components/AccountLabelEditorSection";
import { CategoryMappingEditorSection } from "./components/CategoryMappingEditorSection";
import { DepartmentMappingEditorSection } from "./components/DepartmentMappingEditorSection";
import { FinanceAccountBreakdownSection } from "./components/FinanceAccountBreakdownSection";
import { FinanceAnalyticsSection } from "./components/FinanceAnalyticsSection";
import { FinanceBudgetSection } from "./components/FinanceBudgetSection";
import { FinanceCategoryBreakdownSection } from "./components/FinanceCategoryBreakdownSection";
import { FinanceVatSummarySection } from "./components/FinanceVatSummarySection";
import { useFinanceAccountLabels } from "./hooks/useFinanceAccountLabels";
import { useFinanceAnalytics } from "./hooks/useFinanceAnalytics";
import { useFinanceBudgets } from "./hooks/useFinanceBudgets";
import { useFinanceCategoryMappings } from "./hooks/useFinanceCategoryMappings";
import { useFinanceDepartmentMappings } from "./hooks/useFinanceDepartmentMappings";

export default function FinanceAnalyticsPage(): ReactElement {
	const {
		range,
		analytics,
		isLoading,
		isFetching,
		error,
		updateDateFrom,
		updateDateTo,
		refetch,
	} = useFinanceAnalytics();

	const {
		rows,
		isLoading: mappingsLoading,
		error: mappingsError,
		saveMapping,
		savingCostLocation,
	} = useFinanceDepartmentMappings();

	const {
		rows: categoryRows,
		isLoading: categoryLoading,
		error: categoryError,
		saveCategory,
		savingCostLocationTwo,
	} = useFinanceCategoryMappings();

	const {
		rows: accountRows,
		isLoading: accountLoading,
		error: accountError,
		saveAccount,
		savingAccount,
	} = useFinanceAccountLabels();

	const {
		period,
		rows: budgetRows,
		totals: budgetTotals,
		isLoading: budgetLoading,
		error: budgetError,
		savingDepartment,
		setPeriodType,
		setPeriodKey,
		saveBudget,
	} = useFinanceBudgets();

	return (
		<ToolPageShell
			title="Finance Analytics"
			description="Ausgabenüberblick pro Department für das LnF-Team, gestützt auf BuchhaltungsButler."
		>
			<Tabs defaultValue="overview">
				<TabsList>
					<TabsTrigger value="overview">Übersicht</TabsTrigger>
					<TabsTrigger value="budget">Budget</TabsTrigger>
					<TabsTrigger value="categories">Kategorien</TabsTrigger>
					<TabsTrigger value="accounts">Konten</TabsTrigger>
					<TabsTrigger value="mapping">Zuordnung</TabsTrigger>
				</TabsList>
				<TabsContent value="overview" className="mt-5 flex flex-col gap-5">
					<FinanceAnalyticsSection
						analytics={analytics}
						range={range}
						isLoading={isLoading}
						isFetching={isFetching}
						error={error}
						onDateFromChange={updateDateFrom}
						onDateToChange={updateDateTo}
						onRefresh={() => {
							void refetch();
						}}
					/>
					<FinanceVatSummarySection
						totals={analytics?.totals}
						byVatRate={analytics?.by_vat_rate}
						isLoading={isLoading}
					/>
				</TabsContent>
				<TabsContent value="budget" className="mt-5">
					<FinanceBudgetSection
						period={period}
						rows={budgetRows}
						totals={budgetTotals}
						isLoading={budgetLoading}
						error={budgetError}
						savingDepartment={savingDepartment}
						onPeriodTypeChange={setPeriodType}
						onPeriodKeyChange={setPeriodKey}
						onSave={saveBudget}
					/>
				</TabsContent>
				<TabsContent value="categories" className="mt-5">
					<FinanceCategoryBreakdownSection
						categories={analytics?.by_category}
						isLoading={isLoading}
					/>
				</TabsContent>
				<TabsContent value="accounts" className="mt-5">
					<FinanceAccountBreakdownSection
						accounts={analytics?.by_account}
						isLoading={isLoading}
					/>
				</TabsContent>
				<TabsContent value="mapping" className="mt-5 flex flex-col gap-5">
					<DepartmentMappingEditorSection
						rows={rows}
						isLoading={mappingsLoading}
						error={mappingsError}
						savingCostLocation={savingCostLocation}
						onSave={saveMapping}
					/>
					<CategoryMappingEditorSection
						rows={categoryRows}
						isLoading={categoryLoading}
						error={categoryError}
						savingCostLocationTwo={savingCostLocationTwo}
						onSave={saveCategory}
					/>
					<AccountLabelEditorSection
						rows={accountRows}
						isLoading={accountLoading}
						error={accountError}
						savingAccount={savingAccount}
						onSave={saveAccount}
					/>
				</TabsContent>
			</Tabs>
		</ToolPageShell>
	);
}
