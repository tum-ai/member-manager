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
import { FinancePlanSection } from "./components/FinancePlanSection";
import { FinanceProjectsSection } from "./components/FinanceProjectsSection";
import { FinanceReconciliationSection } from "./components/FinanceReconciliationSection";
import { FinanceReportSection } from "./components/FinanceReportSection";
import { FinanceVatSummarySection } from "./components/FinanceVatSummarySection";
import { useFinanceAnalyticsPage } from "./hooks/useFinanceAnalyticsPage";

export default function FinanceAnalyticsPage(): ReactElement {
	const {
		activeTab,
		setActiveTab,
		canManage,
		department,
		analytics,
		mappings,
		categories,
		accounts,
		budgets,
		plans,
		management,
	} = useFinanceAnalyticsPage();

	return (
		<ToolPageShell
			title="Finance Analytics"
			description="Department-level expense overview for the Legal & Finance team, powered by BuchhaltungsButler."
		>
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="w-full justify-start overflow-x-auto">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="budget">Budget</TabsTrigger>
					<TabsTrigger value="planning">Planning</TabsTrigger>
					<TabsTrigger value="projects">Projects</TabsTrigger>
					<TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
					<TabsTrigger value="report">Reports</TabsTrigger>
					<TabsTrigger value="categories">Categories</TabsTrigger>
					<TabsTrigger value="accounts">Accounts</TabsTrigger>
					{canManage ? (
						<TabsTrigger value="mapping">Mapping</TabsTrigger>
					) : null}
				</TabsList>
				<TabsContent value="overview" className="mt-5 flex flex-col gap-5">
					<FinanceAnalyticsSection
						analytics={analytics.analytics}
						range={analytics.range}
						isLoading={analytics.isLoading}
						isFetching={analytics.isFetching}
						error={analytics.error}
						onDateFromChange={analytics.updateDateFrom}
						onDateToChange={analytics.updateDateTo}
						onRefresh={() => {
							void analytics.refetch();
						}}
					/>
					<FinanceVatSummarySection
						totals={analytics.analytics?.totals}
						byVatRate={analytics.analytics?.by_vat_rate}
						isLoading={analytics.isLoading}
					/>
				</TabsContent>
				<TabsContent value="budget" className="mt-5">
					<FinanceBudgetSection
						period={budgets.period}
						rows={budgets.rows}
						totals={budgets.totals}
						isLoading={budgets.isLoading}
						error={budgets.error}
						savingDepartment={budgets.savingDepartment}
						canEdit={canManage}
						onPeriodTypeChange={budgets.setPeriodType}
						onPeriodKeyChange={budgets.setPeriodKey}
						onSave={budgets.saveBudget}
					/>
				</TabsContent>
				<TabsContent value="planning" className="mt-5">
					<FinancePlanSection
						period={plans.period}
						items={plans.items}
						totals={plans.totals}
						isLoading={plans.isLoading}
						error={plans.error}
						canChooseDepartment={canManage}
						department={department}
						onPeriodTypeChange={plans.setPeriodType}
						onPeriodKeyChange={plans.setPeriodKey}
						onCreate={plans.createItem}
						onUpdate={plans.updateItem}
						onDelete={plans.deleteItem}
					/>
				</TabsContent>
				<TabsContent value="projects" className="mt-5">
					<FinanceProjectsSection {...management.projectSection} />
				</TabsContent>
				<TabsContent value="reconciliation" className="mt-5">
					<FinanceReconciliationSection {...management.reconciliationSection} />
				</TabsContent>
				<TabsContent value="report" className="mt-5">
					<FinanceReportSection {...management.reportSection} />
				</TabsContent>
				<TabsContent value="categories" className="mt-5">
					<FinanceCategoryBreakdownSection
						categories={analytics.analytics?.by_category}
						isLoading={analytics.isLoading}
					/>
				</TabsContent>
				<TabsContent value="accounts" className="mt-5">
					<FinanceAccountBreakdownSection
						accounts={analytics.analytics?.by_account}
						isLoading={analytics.isLoading}
					/>
				</TabsContent>
				{canManage ? (
					<TabsContent value="mapping" className="mt-5 flex flex-col gap-5">
						<DepartmentMappingEditorSection
							rows={mappings.rows}
							isLoading={mappings.isLoading}
							error={mappings.error}
							savingCostLocation={mappings.savingCostLocation}
							onSave={mappings.saveMapping}
						/>
						<CategoryMappingEditorSection
							rows={categories.rows}
							isLoading={categories.isLoading}
							error={categories.error}
							savingCostLocationTwo={categories.savingCostLocationTwo}
							onSave={categories.saveCategory}
						/>
						<AccountLabelEditorSection
							rows={accounts.rows}
							isLoading={accounts.isLoading}
							error={accounts.error}
							savingAccount={accounts.savingAccount}
							onSave={accounts.saveAccount}
						/>
					</TabsContent>
				) : null}
			</Tabs>
		</ToolPageShell>
	);
}
