import type { ReactElement } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { AccountLabelEditorSection } from "./components/AccountLabelEditorSection";
import { FinanceApprovalsSection } from "./components/approvals/FinanceApprovalsSection";
import { CategoryMappingEditorSection } from "./components/CategoryMappingEditorSection";
import { DepartmentMappingEditorSection } from "./components/DepartmentMappingEditorSection";
import { FinanceAccountBreakdownSection } from "./components/FinanceAccountBreakdownSection";
import { FinanceAnalyticsSection } from "./components/FinanceAnalyticsSection";
import { FinanceBudgetSection } from "./components/FinanceBudgetSection";
import { FinanceCategoryBreakdownSection } from "./components/FinanceCategoryBreakdownSection";
import { FinanceReportSection } from "./components/FinanceReportSection";
import { FinanceTemplateManager } from "./components/FinanceTemplateManager";
import { FinanceVatSummarySection } from "./components/FinanceVatSummarySection";
import { FinancePlanTemplateAssignForm } from "./components/settings/FinancePlanTemplateAssignForm";
import { FinanceTAccountSection } from "./components/tAccount/FinanceTAccountSection";
import { useFinanceAnalyticsPage } from "./hooks/useFinanceAnalyticsPage";

// Six tabs, down from ten (FR-O1). Übersicht absorbed the category, account and
// VAT breakdowns; the T-Konto absorbed planning, project creation, allocation
// and matching; what is left of the old Abgleich tab is an approval inbox.
export default function FinanceAnalyticsPage(): ReactElement {
	const {
		activeTab,
		setActiveTab,
		canManage,
		openDepartmentTAccount,
		analytics,
		mappings,
		categories,
		accounts,
		budgets,
		tAccount,
		tAccountWorkbench,
		management,
	} = useFinanceAnalyticsPage();

	return (
		<ToolPageShell
			title="Finance Analytics"
			description="Ausgabenüberblick pro Department für das LnF-Team, gestützt auf BuchhaltungsButler."
		>
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="w-full justify-start overflow-x-auto">
					<TabsTrigger value="overview">Übersicht</TabsTrigger>
					<TabsTrigger value="budget">Budget</TabsTrigger>
					<TabsTrigger value="t-account">T-Konto</TabsTrigger>
					<TabsTrigger value="approvals">Anträge</TabsTrigger>
					<TabsTrigger value="report">Berichte</TabsTrigger>
					{canManage ? (
						<TabsTrigger value="settings">Einstellungen</TabsTrigger>
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
					<FinanceCategoryBreakdownSection
						categories={analytics.analytics?.by_category}
						isLoading={analytics.isLoading}
					/>
					<FinanceAccountBreakdownSection
						accounts={analytics.analytics?.by_account}
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
						onOpenDepartment={canManage ? openDepartmentTAccount : undefined}
						onPeriodTypeChange={budgets.setPeriodType}
						onPeriodKeyChange={budgets.setPeriodKey}
						onSave={budgets.saveBudget}
					/>
				</TabsContent>

				<TabsContent value="t-account" className="mt-5">
					<FinanceTAccountSection
						period={tAccount.period}
						canChooseDepartment={tAccount.canChooseDepartment}
						department={tAccount.department}
						groups={tAccount.groups}
						planItemLabels={tAccount.planItemLabels}
						totals={tAccount.totals}
						isLoading={tAccount.isLoading}
						error={tAccount.error}
						onPeriodTypeChange={tAccount.setPeriodType}
						onPeriodKeyChange={tAccount.setPeriodKey}
						onDepartmentChange={tAccount.setDepartment}
						{...tAccountWorkbench}
					/>
				</TabsContent>

				<TabsContent value="approvals" className="mt-5">
					<FinanceApprovalsSection {...management.approvalsSection} />
				</TabsContent>

				<TabsContent value="report" className="mt-5">
					<FinanceReportSection {...management.reportSection} />
				</TabsContent>

				{canManage ? (
					<TabsContent value="settings" className="mt-5 flex flex-col gap-5">
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
						<FinancePlanTemplateAssignForm {...management.templateAssignForm} />
						<FinanceTemplateManager {...management.templateManager} />
					</TabsContent>
				) : null}
			</Tabs>
		</ToolPageShell>
	);
}
