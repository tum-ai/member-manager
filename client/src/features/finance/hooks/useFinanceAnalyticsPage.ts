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
import { useFinancePlanItems } from "./useFinancePlanItems";
import { useFinanceTAccount } from "./useFinanceTAccount";

export type FinanceAnalyticsTab =
	| "overview"
	| "budget"
	| "planning"
	| "t-account"
	| "categories"
	| "accounts"
	| "projects"
	| "reconciliation"
	| "report"
	| "mapping";

export function useFinanceAnalyticsPage() {
	const [activeTab, setActiveTab] = useState<FinanceAnalyticsTab>("overview");
	const { permissions, department } = useToolAccess();
	const canManage = permissions.includes("finance.review");
	const analyticsEnabled =
		activeTab === "overview" ||
		activeTab === "categories" ||
		activeTab === "accounts";

	const analytics = useFinanceAnalytics({ enabled: analyticsEnabled });
	const mappings = useFinanceDepartmentMappings(analytics.range, {
		enabled: canManage && activeTab === "mapping",
	});
	const categories = useFinanceCategoryMappings(analytics.range, {
		enabled: canManage && activeTab === "mapping",
	});
	const accounts = useFinanceAccountLabels(analytics.range, {
		enabled: canManage && activeTab === "mapping",
	});
	const budgets = useFinanceBudgets({ enabled: activeTab === "budget" });
	const plans = useFinancePlanItems({ enabled: activeTab === "planning" });
	const tAccount = useFinanceTAccount({
		enabled: activeTab === "t-account",
		canManage,
		department,
	});
	const managementSection: FinanceManagementSection | null =
		activeTab === "projects" ||
		activeTab === "reconciliation" ||
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
	// members are already pinned to their own.
	function openDepartmentTAccount(nextDepartment: string): void {
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
		plans,
		tAccount,
		management,
	};
}
