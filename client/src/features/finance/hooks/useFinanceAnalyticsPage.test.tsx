import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinanceAnalyticsPage } from "./useFinanceAnalyticsPage";

const mocks = vi.hoisted(() => ({
	toolAccess: vi.fn(),
	analytics: vi.fn(),
	mappings: vi.fn(),
	categories: vi.fn(),
	accounts: vi.fn(),
	budgets: vi.fn(),
	plans: vi.fn(),
	management: vi.fn(),
}));

vi.mock("@/hooks/useToolAccess", () => ({
	useToolAccess: mocks.toolAccess,
}));
vi.mock("./useFinanceAnalytics", () => ({
	useFinanceAnalytics: mocks.analytics,
}));
vi.mock("./useFinanceDepartmentMappings", () => ({
	useFinanceDepartmentMappings: mocks.mappings,
}));
vi.mock("./useFinanceCategoryMappings", () => ({
	useFinanceCategoryMappings: mocks.categories,
}));
vi.mock("./useFinanceAccountLabels", () => ({
	useFinanceAccountLabels: mocks.accounts,
}));
vi.mock("./useFinanceBudgets", () => ({
	useFinanceBudgets: mocks.budgets,
}));
vi.mock("./useFinancePlanItems", () => ({
	useFinancePlanItems: mocks.plans,
}));
vi.mock("./useFinanceManagement", () => ({
	useFinanceManagement: mocks.management,
}));

const range = { dateFrom: "2026-01-01", dateTo: "2026-12-31" };

describe("useFinanceAnalyticsPage", () => {
	beforeEach(() => {
		mocks.toolAccess.mockReturnValue({
			permissions: ["finance.review"],
			department: "Legal & Finance",
		});
		mocks.analytics.mockReturnValue({ range });
		mocks.mappings.mockReturnValue({});
		mocks.categories.mockReturnValue({});
		mocks.accounts.mockReturnValue({});
		mocks.budgets.mockReturnValue({});
		mocks.plans.mockReturnValue({});
		mocks.management.mockReturnValue({});
	});

	it("enables only the queries needed for the active tab", () => {
		const { result } = renderHookWithClient(() => useFinanceAnalyticsPage());

		expect(mocks.analytics).toHaveBeenLastCalledWith({ enabled: true });
		expect(mocks.mappings).toHaveBeenLastCalledWith(range, { enabled: false });
		expect(mocks.budgets).toHaveBeenLastCalledWith({ enabled: false });
		expect(mocks.plans).toHaveBeenLastCalledWith({ enabled: false });

		act(() => result.current.setActiveTab("budget"));
		expect(mocks.analytics).toHaveBeenLastCalledWith({ enabled: false });
		expect(mocks.budgets).toHaveBeenLastCalledWith({ enabled: true });

		act(() => result.current.setActiveTab("planning"));
		expect(mocks.plans).toHaveBeenLastCalledWith({ enabled: true });

		act(() => result.current.setActiveTab("projects"));
		expect(mocks.management).toHaveBeenLastCalledWith({
			activeSection: "projects",
			canManage: true,
			department: null,
		});

		act(() => result.current.setActiveTab("mapping"));
		expect(mocks.mappings).toHaveBeenLastCalledWith(range, { enabled: true });
		expect(mocks.categories).toHaveBeenLastCalledWith(range, { enabled: true });
		expect(mocks.accounts).toHaveBeenLastCalledWith(range, { enabled: true });
	});

	it("never enables reviewer-only mapping queries for department viewers", () => {
		mocks.toolAccess.mockReturnValue({
			permissions: ["finance.department"],
			department: "Makeathon",
		});
		const { result } = renderHookWithClient(() => useFinanceAnalyticsPage());

		act(() => result.current.setActiveTab("mapping"));

		expect(result.current.canManage).toBe(false);
		expect(mocks.mappings).toHaveBeenLastCalledWith(range, { enabled: false });
		expect(mocks.categories).toHaveBeenLastCalledWith(range, {
			enabled: false,
		});
		expect(mocks.accounts).toHaveBeenLastCalledWith(range, {
			enabled: false,
		});

		act(() => result.current.setActiveTab("projects"));
		expect(mocks.management).toHaveBeenLastCalledWith({
			activeSection: "projects",
			canManage: false,
			department: "Makeathon",
		});
	});
});
