import type { ReactElement } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { CategoryMappingEditorSection } from "./components/CategoryMappingEditorSection";
import { DepartmentMappingEditorSection } from "./components/DepartmentMappingEditorSection";
import { FinanceAnalyticsSection } from "./components/FinanceAnalyticsSection";
import { FinanceCategoryBreakdownSection } from "./components/FinanceCategoryBreakdownSection";
import { useFinanceAnalytics } from "./hooks/useFinanceAnalytics";
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
	} = useFinanceDepartmentMappings(range);

	const {
		rows: categoryRows,
		isLoading: categoryLoading,
		error: categoryError,
		saveCategory,
		savingCostLocationTwo,
	} = useFinanceCategoryMappings();

	return (
		<ToolPageShell
			title="Finance Analytics"
			description="Ausgabenüberblick pro Department für das LnF-Team, gestützt auf BuchhaltungsButler."
		>
			<Tabs defaultValue="overview">
				<TabsList>
					<TabsTrigger value="overview">Übersicht</TabsTrigger>
					<TabsTrigger value="categories">Kategorien</TabsTrigger>
					<TabsTrigger value="mapping">Zuordnung</TabsTrigger>
				</TabsList>
				<TabsContent value="overview" className="mt-5">
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
				</TabsContent>
				<TabsContent value="categories" className="mt-5">
					<FinanceCategoryBreakdownSection
						categories={analytics?.by_category}
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
				</TabsContent>
			</Tabs>
		</ToolPageShell>
	);
}
