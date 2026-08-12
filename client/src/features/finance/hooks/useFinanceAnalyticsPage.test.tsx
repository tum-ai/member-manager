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
	tAccount: vi.fn(),
	setDepartment: vi.fn(),
	setPeriod: vi.fn(),
	selection: vi.fn(),
	clearSelection: vi.fn(),
	actions: vi.fn(),
	planActions: vi.fn(),
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
vi.mock("./useFinanceTAccount", () => ({
	useFinanceTAccount: mocks.tAccount,
}));
vi.mock("./useFinanceTAccountSelection", () => ({
	useFinanceTAccountSelection: mocks.selection,
}));
vi.mock("./useFinanceTAccountActions", () => ({
	useFinanceTAccountActions: mocks.actions,
}));
vi.mock("./useFinanceTAccountPlanActions", () => ({
	useFinanceTAccountPlanActions: mocks.planActions,
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
		mocks.budgets.mockReturnValue({
			period: { type: "semester", key: "2026-S1" },
		});
		mocks.plans.mockReturnValue({});
		mocks.setDepartment.mockClear();
		mocks.setPeriod.mockClear();
		mocks.tAccount.mockReturnValue({
			setDepartment: mocks.setDepartment,
			setPeriod: mocks.setPeriod,
			// The page hook composes the selection and action hooks on top of this
			// one, so the mock has to carry the shape they read.
			period: { type: "year", key: "2026" },
			department: null,
			groups: [],
			projects: [],
		});
		mocks.selection.mockReturnValue({
			selectedIds: [],
			count: 0,
			grossSum: 0,
			isSelected: () => false,
			toggle: vi.fn(),
			clear: mocks.clearSelection,
		});
		mocks.actions.mockReturnValue({
			createProject: vi.fn(),
			assignToProject: vi.fn(),
			isCreatingProject: false,
			isAssigning: false,
		});
		mocks.planActions.mockReturnValue({
			savePlanItem: vi.fn(),
			togglePlanItemActive: vi.fn(),
			correctPlanToActual: vi.fn(),
			matchPosting: vi.fn(),
			detachMatch: vi.fn(),
			isSavingPlanItem: false,
			isMatching: false,
		});
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

		act(() => result.current.setActiveTab("t-account"));
		expect(mocks.tAccount).toHaveBeenLastCalledWith({
			enabled: true,
			canManage: true,
			department: "Legal & Finance",
		});

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

	it("offers the T-view write surface to anyone with a department (FR-K6)", () => {
		// A reviewer may write every department…
		const reviewer = renderHookWithClient(() => useFinanceAnalyticsPage());
		expect(reviewer.result.current.tAccountWorkbench.canWrite).toBe(true);

		// …a scoped member their own…
		mocks.toolAccess.mockReturnValue({
			permissions: ["finance.department"],
			department: "Makeathon",
		});
		const member = renderHookWithClient(() => useFinanceAnalyticsPage());
		expect(member.result.current.tAccountWorkbench.canWrite).toBe(true);

		// …and someone with no department has nothing to write to. The server is
		// the authority either way (assertCanWriteDepartment).
		mocks.toolAccess.mockReturnValue({
			permissions: ["finance.department"],
			department: null,
		});
		const unscoped = renderHookWithClient(() => useFinanceAnalyticsPage());
		expect(unscoped.result.current.tAccountWorkbench.canWrite).toBe(false);
	});

	it("clears the selection once a bulk action has been applied (FR-K7)", () => {
		renderHookWithClient(() => useFinanceAnalyticsPage());

		// The actions hook is wired to the T-account's own department and period,
		// and its onApplied consumes the selection.
		const call = mocks.actions.mock.calls.at(-1)?.[0];
		expect(call.department).toBeNull();
		expect(call.period).toEqual({ type: "year", key: "2026" });

		call.onApplied();
		expect(mocks.clearSelection).toHaveBeenCalled();
	});

	it("drills from the budget overview into a department's T-account", () => {
		const { result } = renderHookWithClient(() => useFinanceAnalyticsPage());

		act(() => result.current.openDepartmentTAccount("Makeathon"));

		expect(mocks.setDepartment).toHaveBeenCalledWith("Makeathon");
		expect(result.current.activeTab).toBe("t-account");
	});

	it("carries the budget's active period into the T-account on drill-down", () => {
		const { result } = renderHookWithClient(() => useFinanceAnalyticsPage());

		act(() => result.current.openDepartmentTAccount("Makeathon"));

		// A non-default budget period (2026-S1) must be copied over so the
		// T-account renders the same period the user was viewing.
		expect(mocks.setPeriod).toHaveBeenCalledWith({
			type: "semester",
			key: "2026-S1",
		});
	});
});
