import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useFinanceManagement } from "./useFinanceManagement";

const showToast = vi.fn();
const { writeXlsxFileMock, toFileMock } = vi.hoisted(() => {
	const toFileMock = vi.fn(() => Promise.resolve());
	const writeXlsxFileMock = vi.fn(() => ({
		toFile: toFileMock,
		toBlob: vi.fn(),
	}));
	return { writeXlsxFileMock, toFileMock };
});

vi.mock("../../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("../../../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

vi.mock("write-excel-file/browser", () => ({
	default: writeXlsxFileMock,
}));

const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const TEMPLATE_ID = "20000000-0000-4000-8000-000000000001";
const TEMPLATE_ITEM_ID = "30000000-0000-4000-8000-000000000001";
const PLAN_ITEM_ID = "40000000-0000-4000-8000-000000000001";
const MATCH_ID = "50000000-0000-4000-8000-000000000001";
const REQUEST_ID = "60000000-0000-4000-8000-000000000001";

const project = {
	id: PROJECT_ID,
	parent_project_id: null,
	name: "Makeathon 2026",
	department: "Makeathon",
	period_type: "year",
	period_key: "2026",
	tax_area: "wirtschaftlich",
	target_amount: -20000,
	status: "active",
	description: null,
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
};

const template = {
	id: TEMPLATE_ID,
	name: "Event baseline",
	description: null,
	tax_area: "wirtschaftlich",
	is_active: true,
	items: [],
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
};

const transaction = {
	external_id: "BB-1",
	date: "2026-05-04",
	postingtext: "Makeathon venue",
	amount: -4800,
	currency: "EUR",
	vat: 19,
	credit_type: "debit",
	debit_postingaccount_number: "6300",
	credit_postingaccount_number: "1200",
	cost_location: "161",
	cost_location_two: "5",
	transaction_amount: -4800,
	transaction_purpose: "Venue deposit",
};

function financeGetHandlers() {
	return [
		http.get("/api/finance/projects", () =>
			HttpResponse.json({ projects: [project] }),
		),
		http.get("/api/finance/plan-templates", () =>
			HttpResponse.json({ templates: [template] }),
		),
		http.get("/api/finance/plan-items", () =>
			HttpResponse.json({
				period_type: "year",
				period_key: "2026",
				items: [
					{
						id: PLAN_ITEM_ID,
						department: "Makeathon",
						period_type: "year",
						period_key: "2026",
						label: "Venue",
						category: "Location",
						planned_amount: 5000,
						expected_month: "2026-05",
						status: "planned",
						note: null,
					},
				],
				totals: { planned: 5000, budget: 15000, actual: 4800 },
				source: "mock",
				generated_at: "2026-07-21T12:00:00.000Z",
			}),
		),
		http.get("/api/finance/reconciliation", () =>
			HttpResponse.json({
				period_type: "year",
				period_key: "2026",
				matches: [],
				unmatched_postings: [],
				unplanned_postings: [],
				source: "mock",
				generated_at: "2026-07-21T12:00:00.000Z",
			}),
		),
		http.get("/api/finance/reallocation-requests", () =>
			HttpResponse.json({ requests: [] }),
		),
		http.get("/api/finance/budget-transfer-requests", () =>
			HttpResponse.json({ requests: [] }),
		),
	];
}

describe("useFinanceManagement", () => {
	beforeEach(() => {
		showToast.mockClear();
		writeXlsxFileMock.mockClear();
		toFileMock.mockClear();
	});

	it("enables section queries only when the active scope is available", async () => {
		let projectRequests = 0;
		let templateRequests = 0;
		server.use(
			http.get("/api/finance/projects", () => {
				projectRequests += 1;
				return HttpResponse.json({ projects: [project] });
			}),
			http.get("/api/finance/plan-templates", () => {
				templateRequests += 1;
				return HttpResponse.json({ templates: [template] });
			}),
		);

		const { result, rerender } = renderHookWithClient(
			(options: { canManage: boolean; department: string | null }) =>
				useFinanceManagement({
					activeSection: "projects",
					...options,
				}),
			{ initialProps: { canManage: false, department: null } },
		);

		expect(result.current.projectSection.isLoading).toBe(false);
		expect(projectRequests).toBe(0);
		expect(templateRequests).toBe(0);

		rerender({ canManage: true, department: null });
		await waitFor(() =>
			expect(result.current.projectSection.projects).toHaveLength(1),
		);
		expect(projectRequests).toBe(1);
		expect(templateRequests).toBe(1);
	});

	it("creates projects and templates, manages template items, and assigns templates", async () => {
		const requests: Array<{ method: string; body?: unknown }> = [];
		server.use(
			...financeGetHandlers(),
			http.post("/api/finance/projects", async ({ request }) => {
				requests.push({ method: "project", body: await request.json() });
				return HttpResponse.json(project, { status: 201 });
			}),
			http.post("/api/finance/plan-templates", async ({ request }) => {
				requests.push({ method: "template", body: await request.json() });
				return HttpResponse.json(template, { status: 201 });
			}),
			http.post(
				"/api/finance/plan-templates/:templateId/items",
				async ({ request }) => {
					requests.push({
						method: "template-item",
						body: await request.json(),
					});
					return HttpResponse.json(
						{
							id: TEMPLATE_ITEM_ID,
							template_id: TEMPLATE_ID,
							label: "Venue",
							category: "Location",
							planned_amount: 5000,
							expected_month: "2026-05",
							note: null,
							sort_order: 0,
						},
						{ status: 201 },
					);
				},
			),
			http.delete(
				"/api/finance/plan-templates/:templateId/items/:itemId",
				() => new HttpResponse(null, { status: 204 }),
			),
			http.post("/api/finance/projects/:projectId/template-assignments", () =>
				HttpResponse.json(
					{
						project_id: PROJECT_ID,
						template_id: TEMPLATE_ID,
						created_plan_items: [],
					},
					{ status: 201 },
				),
			),
		);

		const { result } = renderHookWithClient(() =>
			useFinanceManagement({
				activeSection: "projects",
				canManage: true,
				department: null,
			}),
		);
		await waitFor(() =>
			expect(result.current.projectSection.projects).toHaveLength(1),
		);

		await act(async () => {
			await result.current.projectSection.onCreateProject({
				name: "Makeathon sub-project",
				department: "Makeathon",
				period_type: "year",
				period_key: "2026",
				target_amount: -5000,
				status: "draft",
			});
			await result.current.projectSection.onCreateTemplate({
				name: "Event baseline",
				tax_area: "wirtschaftlich",
			});
			await result.current.projectSection.onCreateTemplateItem({
				templateId: TEMPLATE_ID,
				item: {
					label: "Venue",
					category: "Location",
					planned_amount: 5000,
					expected_month: "2026-05",
				},
			});
			await result.current.projectSection.onDeleteTemplateItem({
				templateId: TEMPLATE_ID,
				itemId: TEMPLATE_ITEM_ID,
			});
			await result.current.projectSection.onAssignTemplate({
				projectId: PROJECT_ID,
				templateId: TEMPLATE_ID,
			});
		});

		expect(requests.map((request) => request.method)).toEqual([
			"project",
			"template",
			"template-item",
		]);
		expect(showToast).toHaveBeenCalledWith(
			"0 plan item(s) created.",
			"success",
		);
	});

	it("handles allocations, requests, reviews, and plan-item matches", async () => {
		const methods: string[] = [];
		server.use(
			...financeGetHandlers(),
			http.put("/api/finance/posting-allocations/:externalId", () => {
				methods.push("allocation");
				return HttpResponse.json({
					posting: transaction,
					allocations: [],
				});
			}),
			http.post("/api/finance/reallocation-requests", () => {
				methods.push("request");
				return HttpResponse.json(
					{
						id: REQUEST_ID,
						posting_external_id: "BB-1",
						requesting_department: "Makeathon",
						reason: "Move it",
						status: "pending",
						requested_by: "user-1",
						reviewed_by: null,
						review_note: null,
						reviewed_at: null,
						allocations: [],
						created_at: "2026-07-21T12:00:00.000Z",
						updated_at: "2026-07-21T12:00:00.000Z",
					},
					{ status: 201 },
				);
			}),
			http.post("/api/finance/reallocation-requests/:requestId/review", () => {
				methods.push("review");
				return HttpResponse.json({
					id: REQUEST_ID,
					posting_external_id: "BB-1",
					requesting_department: "Makeathon",
					reason: "Move it",
					status: "approved",
					requested_by: "user-1",
					reviewed_by: "reviewer-1",
					review_note: "Confirmed",
					reviewed_at: "2026-07-21T12:00:00.000Z",
					allocations: [],
					created_at: "2026-07-21T12:00:00.000Z",
					updated_at: "2026-07-21T12:00:00.000Z",
				});
			}),
			http.post("/api/finance/budget-transfer-requests", () => {
				methods.push("budget-transfer");
				return HttpResponse.json(
					{
						id: REQUEST_ID,
						source_department: "Makeathon",
						target_department: "Community",
						period_type: "year",
						period_key: "2026",
						amount: 1000,
						reason: "Move budget",
						status: "pending",
						requested_by: "user-1",
						reviewed_by: null,
						review_note: null,
						reviewed_at: null,
						created_at: "2026-07-21T12:00:00.000Z",
						updated_at: "2026-07-21T12:00:00.000Z",
					},
					{ status: 201 },
				);
			}),
			http.post(
				"/api/finance/budget-transfer-requests/:requestId/review",
				() => {
					methods.push("budget-transfer-review");
					return HttpResponse.json({
						id: REQUEST_ID,
						source_department: "Makeathon",
						target_department: "Community",
						period_type: "year",
						period_key: "2026",
						amount: 1000,
						reason: "Move budget",
						status: "approved",
						requested_by: "user-1",
						reviewed_by: "reviewer-1",
						review_note: "Confirmed",
						reviewed_at: "2026-07-21T12:00:00.000Z",
						created_at: "2026-07-21T12:00:00.000Z",
						updated_at: "2026-07-21T12:00:00.000Z",
					});
				},
			),
			http.post("/api/finance/plan-item-matches", () => {
				methods.push("match");
				return HttpResponse.json(
					{
						id: MATCH_ID,
						plan_item_id: PLAN_ITEM_ID,
						posting_external_id: "BB-1",
						matched_amount: 1000,
						match_type: "manual",
						created_by: "user-1",
						created_at: "2026-07-21T12:00:00.000Z",
					},
					{ status: 201 },
				);
			}),
			http.delete("/api/finance/plan-item-matches/:matchId", () => {
				methods.push("delete-match");
				return new HttpResponse(null, { status: 204 });
			}),
		);

		const { result } = renderHookWithClient(() =>
			useFinanceManagement({
				activeSection: "reconciliation",
				canManage: true,
				department: null,
			}),
		);
		await waitFor(() =>
			expect(result.current.reconciliationSection.planItems).toHaveLength(1),
		);

		await act(async () => {
			await result.current.reconciliationSection.onAllocateToProject({
				postingExternalId: "BB-1",
				projectId: PROJECT_ID,
			});
			await result.current.reconciliationSection.onSplitAllocation({
				postingExternalId: "BB-1",
				allocations: [
					{ department: "Makeathon", percentage: 60 },
					{ department: "Community", percentage: 40 },
				],
			});
			await result.current.reconciliationSection.onCreateReallocation({
				posting_external_id: "BB-1",
				requesting_department: "Makeathon",
				reason: "Move it",
				allocations: [{ project_id: PROJECT_ID, percentage: 100 }],
			});
			await result.current.reconciliationSection.onReviewReallocation({
				requestId: REQUEST_ID,
				review: { decision: "approved", review_note: "Confirmed" },
			});
			await result.current.reconciliationSection.onCreateBudgetTransfer({
				source_department: "Makeathon",
				target_department: "Community",
				period_type: "year",
				period_key: "2026",
				amount: 1000,
				reason: "Move budget",
			});
			await result.current.reconciliationSection.onReviewBudgetTransfer({
				requestId: REQUEST_ID,
				review: { decision: "approved", review_note: "Confirmed" },
			});
			await result.current.reconciliationSection.onMatchPlanItem({
				plan_item_id: PLAN_ITEM_ID,
				posting_external_id: "BB-1",
				matched_amount: 1000,
				match_type: "manual",
			});
			await result.current.reconciliationSection.onDeleteMatch(MATCH_ID);
		});

		expect(methods).toEqual([
			"allocation",
			"allocation",
			"request",
			"review",
			"budget-transfer",
			"budget-transfer-review",
			"match",
			"delete-match",
		]);
	});

	it("exports the currently scoped report and prints it", async () => {
		server.use(
			http.get("/api/finance/reports/period-summary", () =>
				HttpResponse.json({
					period_type: "year",
					period_key: "2026",
					departments: [
						{
							department: "Makeathon",
							budget: 15000,
							plan: 5000,
							actual: 4800,
							remaining: 10200,
							forecast: 7200,
							tax_area_totals: [],
						},
					],
					totals: {
						budget: 15000,
						plan: 5000,
						actual: 4800,
						remaining: 10200,
						forecast: 7200,
					},
					tax_area_totals: [
						{
							tax_area: "wirtschaftlich",
							target_amount: -20000,
							plan: 5000,
							actual_income: 0,
							actual_expenses: 4800,
							actual_net: -4800,
							forecast_expenses: 7200,
						},
					],
					source: "mock",
					generated_at: "2026-07-21T12:00:00.000Z",
				}),
			),
		);
		const printSpy = vi
			.spyOn(window, "print")
			.mockImplementation(() => undefined);
		const { result } = renderHookWithClient(() =>
			useFinanceManagement({
				activeSection: "report",
				canManage: false,
				department: "Makeathon",
			}),
		);
		await waitFor(() =>
			expect(result.current.reportSection.report).toBeDefined(),
		);

		await act(async () => {
			await result.current.reportSection.onExport();
		});
		act(() => result.current.reportSection.onPrint());

		expect(writeXlsxFileMock).toHaveBeenCalledOnce();
		expect(toFileMock).toHaveBeenCalledWith(
			"finance-report-2026-makeathon.xlsx",
		);
		expect(printSpy).toHaveBeenCalledOnce();
		printSpy.mockRestore();
	});
});
