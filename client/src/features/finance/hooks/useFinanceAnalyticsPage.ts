import { useState } from "react";
import { useToolAccess } from "@/hooks/useToolAccess";
import { useFinanceAccountLabels } from "./useFinanceAccountLabels";
import { useFinanceAnalytics } from "./useFinanceAnalytics";
import { useFinanceBudgets } from "./useFinanceBudgets";
import { useFinanceCategoryMappings } from "./useFinanceCategoryMappings";
import { useFinanceDepartmentMappings } from "./useFinanceDepartmentMappings";
import {
	type FinanceManagementSection,
	useFinanceManagement,
} from "./useFinanceManagement";
import { useFinanceTAccount } from "./useFinanceTAccount";
import { useFinanceTAccountActions } from "./useFinanceTAccountActions";
import { useFinanceTAccountPlanActions } from "./useFinanceTAccountPlanActions";
import { useFinanceTAccountSelection } from "./useFinanceTAccountSelection";

// Six tabs (FR-O1). Kategorien, Konten and the VAT summary are panels of
// Übersicht now; Planung, Projekte and Abgleich were absorbed by the T-Konto
// and the new Anträge inbox.
export type FinanceAnalyticsTab =
	| "overview"
	| "budget"
	| "t-account"
	| "approvals"
	| "report"
	| "settings";

export function useFinanceAnalyticsPage() {
	const { permissions, department } = useToolAccess();
	const canManage = permissions.includes("finance.review");
	// FR-O2: LnF lands on the org-wide overview, a department-scoped member on
	// the surface they actually work in.
	const [activeTab, setActiveTab] = useState<FinanceAnalyticsTab>(
		canManage ? "overview" : "t-account",
	);
	const analyticsEnabled = activeTab === "overview";

	const analytics = useFinanceAnalytics({ enabled: analyticsEnabled });
	const settingsActive = canManage && activeTab === "settings";
	const mappings = useFinanceDepartmentMappings(analytics.range, {
		enabled: settingsActive,
	});
	const categories = useFinanceCategoryMappings(analytics.range, {
		enabled: settingsActive,
	});
	const accounts = useFinanceAccountLabels(analytics.range, {
		enabled: settingsActive,
	});
	const budgets = useFinanceBudgets({ enabled: activeTab === "budget" });
	const tAccount = useFinanceTAccount({
		enabled: activeTab === "t-account",
		canManage,
		department,
	});
	const tAccountSelection = useFinanceTAccountSelection({
		groups: tAccount.groups,
		department: tAccount.department,
		periodType: tAccount.period.type,
		periodKey: tAccount.period.key,
	});
	const tAccountActions = useFinanceTAccountActions({
		department: tAccount.department,
		period: tAccount.period,
		// A bulk action consumes the selection; clearing it here means the bar
		// disappears exactly when the work is done (FR-K7).
		onApplied: tAccountSelection.clear,
	});
	const tAccountPlanActions = useFinanceTAccountPlanActions({
		department: tAccount.department,
		period: tAccount.period,
	});
	const managementSection: FinanceManagementSection | null =
		activeTab === "approvals" ||
		activeTab === "settings" ||
		activeTab === "report"
			? activeTab
			: null;
	const management = useFinanceManagement({
		activeSection: managementSection,
		canManage,
		department: canManage ? null : department,
	});

	// Drill down from the budget overview into one department's T-account
	// ("rauf/runterstufen" — FR-H2). Only reviewers pick a department; scoped
	// members are already pinned to their own. Carry the budget's active period
	// across so the T-account shows the same semester/year the user was viewing,
	// not its own independent default.
	function openDepartmentTAccount(nextDepartment: string): void {
		tAccount.setPeriod(budgets.period);
		tAccount.setDepartment(nextDepartment);
		setActiveTab("t-account");
	}

	return {
		activeTab,
		setActiveTab: (value: string) => setActiveTab(value as FinanceAnalyticsTab),
		canManage,
		openDepartmentTAccount,
		department,
		analytics,
		mappings,
		categories,
		accounts,
		budgets,
		tAccount,
		// Everything the T-view needs to be a working surface, in one prop bag the
		// page can spread onto the section (FR-K5–K7, FR-L).
		tAccountWorkbench: {
			// The server is the authority (assertCanWriteDepartment); this only
			// decides whether the UI offers the actions at all (FR-K6). A viewer
			// without a department never gets a T-account to write to.
			canWrite: canManage || department !== null,
			projects: tAccount.projects,
			selection: tAccountSelection,
			isCreatingProject: tAccountActions.isCreatingProject,
			isAssigning: tAccountActions.isAssigning,
			onCreateProject: tAccountActions.createProject,
			onAssignToProject: async (
				projectId: string,
				postingExternalIds: string[],
			) => {
				await tAccountActions.assignToProject({
					projectId,
					postingExternalIds,
				});
			},
			// Planposten live next to the actuals they plan (FR-M).
			isSavingPlanItem: tAccountPlanActions.isSavingPlanItem,
			isMatching: tAccountPlanActions.isMatching,
			onSavePlanItem: tAccountPlanActions.savePlanItem,
			onTogglePlanItem: tAccountPlanActions.togglePlanItemActive,
			onCorrectPlanToActual: tAccountPlanActions.correctPlanToActual,
			onMatch: tAccountPlanActions.matchPosting,
			onDetachMatch: tAccountPlanActions.detachMatch,
			onDeletePlanItem: tAccountPlanActions.deletePlanItem,
			// Raising a cross-department reallocation still goes through the
			// management hook — it is a request, reviewed in the Anträge tab.
			isRequestingReallocation: management.reallocationRequest.isPending,
			isSplitting: tAccountActions.isSplitting,
			onSplitAllocation: tAccountActions.splitAllocation,
			onRequestReallocation: management.reallocationRequest.onSubmit,
		},
		management,
	};
}
