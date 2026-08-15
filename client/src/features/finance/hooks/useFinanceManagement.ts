import type {
	FinanceBudgetTransferRequest,
	FinanceBudgetTransferRequestCreate,
	FinanceBudgetTransferRequestsResponse,
	FinancePeriodReportResponse,
	FinancePlanTemplate,
	FinancePlanTemplateAssignmentResponse,
	FinancePlanTemplateCreate,
	FinancePlanTemplateItem,
	FinancePlanTemplateItemCreate,
	FinancePlanTemplatesResponse,
	FinancePostingAllocationInput,
	FinanceProjectsResponse,
	FinanceReallocationRequest,
	FinanceReallocationRequestCreate,
	FinanceReallocationRequestsResponse,
	FinanceReallocationReview,
} from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { SheetData } from "write-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";
import { useToast } from "@/contexts/ToastContext";
import type { FinancePeriodType } from "@/features/finance/financeTypes";
import {
	type FinancePeriod,
	formatBereichLabel,
	getDefaultFinancePeriod,
	switchFinancePeriodType,
} from "@/features/finance/financeUtils";
import { apiClient } from "@/lib/apiClient";

// The tabs this hook still serves after the consolidation (FR-O1). Allocation
// and matching moved to the T-view and bring their own hooks.
export type FinanceManagementSection = "approvals" | "settings" | "report";

export interface UseFinanceManagementOptions {
	activeSection: FinanceManagementSection | null;
	canManage: boolean;
	department: string | null;
}

export interface TemplateItemMutationInput {
	templateId: string;
	item: FinancePlanTemplateItemCreate;
}

export interface DeleteTemplateItemInput {
	templateId: string;
	itemId: string;
}

export interface TemplateAssignmentInput {
	projectId: string;
	templateId: string;
}

export interface PostingAllocationInput {
	postingExternalId: string;
	allocations: FinancePostingAllocationInput[];
}

export interface ProjectAllocationInput {
	postingExternalId: string;
	projectId: string;
}

export interface ReallocationReviewInput {
	requestId: string;
	review: FinanceReallocationReview;
}

export interface BudgetTransferReviewInput {
	requestId: string;
	review: FinanceReallocationReview;
}

export const FINANCE_MANAGEMENT_QUERY_KEYS = {
	projects: "finance-management-projects",
	templates: "finance-management-templates",
	reconciliation: "finance-management-reconciliation",
	reallocations: "finance-management-reallocations",
	budgetTransfers: "finance-management-budget-transfers",
	report: "finance-management-report",
} as const;

// Plan items are read by the T-view and written from several places, so the key
// lives with the other finance query keys rather than in one hook.
export const FINANCE_PLAN_ITEMS_QUERY_KEY = "finance-plan-items";

function buildPeriodParams(
	period: FinancePeriod,
	department: string | null,
): URLSearchParams {
	const params = new URLSearchParams({
		period_type: period.type,
		period_key: period.key,
	});
	if (department) {
		params.set("department", department);
	}
	return params;
}

function buildProjectsEndpoint(
	period: FinancePeriod,
	department: string | null,
): string {
	return `/api/finance/projects?${buildPeriodParams(period, department).toString()}`;
}

function buildReallocationsEndpoint(department: string | null): string {
	const params = new URLSearchParams();
	if (department) {
		params.set("department", department);
	}
	const query = params.toString();
	return `/api/finance/reallocation-requests${query ? `?${query}` : ""}`;
}

function buildBudgetTransfersEndpoint(department: string | null): string {
	const params = new URLSearchParams();
	if (department) {
		params.set("department", department);
	}
	const query = params.toString();
	return `/api/finance/budget-transfer-requests${query ? `?${query}` : ""}`;
}

function buildReportEndpoint(
	period: FinancePeriod,
	department: string | null,
): string {
	return `/api/finance/reports/period-summary?${buildPeriodParams(
		period,
		department,
	).toString()}`;
}

function titleRow(value: string): SheetData[number] {
	return [{ value, type: String, fontWeight: "bold" }];
}

function headerRow(values: string[]): SheetData[number] {
	return values.map((value) => ({
		value,
		type: String,
		fontWeight: "bold" as const,
		backgroundColor: "#F5EFFF",
	}));
}

function amountCell(value: number) {
	return { value, type: Number, format: "#,##0.00 [$EUR]" };
}

function buildReportSheet(report: FinancePeriodReportResponse): SheetData {
	const totals = [
		["Budget", report.totals.budget],
		["Plan expenses", report.totals.plan],
		["Plan income", report.totals.planned_income ?? 0],
		["Plan net", report.totals.planned_net ?? -report.totals.plan],
		["Actual", report.totals.actual],
		["Remaining", report.totals.remaining],
		["Forecast", report.totals.forecast],
	] as const;

	return [
		titleRow(`Finance report ${report.period_key}`),
		...totals.map(([label, value]) => [
			{ value: label, type: String },
			amountCell(value),
		]),
		[null],
		titleRow("Departments"),
		headerRow([
			"Department",
			"Budget",
			"Plan expenses",
			"Plan income",
			"Plan net",
			"Actual",
			"Remaining",
			"Forecast",
		]),
		...report.departments.map((row) => [
			{ value: row.department, type: String },
			amountCell(row.budget),
			amountCell(row.plan),
			amountCell(row.planned_income ?? 0),
			amountCell(row.planned_net ?? -row.plan),
			amountCell(row.actual),
			amountCell(row.remaining),
			amountCell(row.forecast),
		]),
		[null],
		titleRow("Tax areas"),
		headerRow([
			"Tax area",
			"Target",
			"Plan expenses",
			"Plan income",
			"Plan net",
			"Income",
			"Expenses",
			"Net",
			"Forecast expenses",
		]),
		...report.tax_area_totals.map((row) => [
			{ value: formatBereichLabel(row.tax_area), type: String },
			amountCell(row.target_amount),
			amountCell(row.plan),
			amountCell(row.planned_income ?? 0),
			amountCell(row.planned_net ?? -row.plan),
			amountCell(row.actual_income),
			amountCell(row.actual_expenses),
			amountCell(row.actual_net),
			amountCell(row.forecast_expenses),
		]),
	];
}

function exportScopeName(
	report: FinancePeriodReportResponse,
	department: string | null,
): string {
	const scope =
		department ??
		(report.departments.length === 1
			? report.departments[0].department
			: "all-departments");
	return scope
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "");
}

export function useFinanceManagement({
	activeSection,
	canManage,
	department,
}: UseFinanceManagementOptions) {
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const defaultPeriod = useMemo(() => getDefaultFinancePeriod(), []);
	const [period, setPeriod] = useState<FinancePeriod>(defaultPeriod);
	const accessReady = canManage || Boolean(department);
	// Settings needs the projects only to offer them as template targets;
	// approvals needs neither projects nor plan items.
	const settingsActive = activeSection === "settings";
	const approvalsActive = activeSection === "approvals";

	const projectsQuery = useQuery<FinanceProjectsResponse>({
		queryKey: [
			FINANCE_MANAGEMENT_QUERY_KEYS.projects,
			period.type,
			period.key,
			department,
		],
		queryFn: async () =>
			await apiClient(buildProjectsEndpoint(period, department)),
		enabled: accessReady && settingsActive,
	});

	const templatesQuery = useQuery<FinancePlanTemplatesResponse>({
		queryKey: [FINANCE_MANAGEMENT_QUERY_KEYS.templates],
		queryFn: async () => await apiClient("/api/finance/plan-templates"),
		enabled: accessReady && settingsActive,
	});

	const reallocationsQuery = useQuery<FinanceReallocationRequestsResponse>({
		queryKey: [
			FINANCE_MANAGEMENT_QUERY_KEYS.reallocations,
			department,
			canManage,
		],
		queryFn: async () =>
			await apiClient(buildReallocationsEndpoint(department)),
		enabled: accessReady && approvalsActive,
	});

	const budgetTransfersQuery = useQuery<FinanceBudgetTransferRequestsResponse>({
		queryKey: [
			FINANCE_MANAGEMENT_QUERY_KEYS.budgetTransfers,
			department,
			canManage,
		],
		queryFn: async () =>
			await apiClient(buildBudgetTransfersEndpoint(department)),
		enabled: accessReady && approvalsActive,
	});

	const reportQuery = useQuery<FinancePeriodReportResponse>({
		queryKey: [
			FINANCE_MANAGEMENT_QUERY_KEYS.report,
			period.type,
			period.key,
			department,
		],
		queryFn: async () =>
			await apiClient(buildReportEndpoint(period, department)),
		enabled: accessReady && activeSection === "report",
	});

	function invalidate(...queryKeys: string[]): void {
		for (const queryKey of queryKeys) {
			void queryClient.invalidateQueries({ queryKey: [queryKey] });
		}
	}

	function reportError(error: unknown, fallback: string): void {
		showToast(error instanceof Error ? error.message : fallback, "error");
	}

	const createTemplateMutation = useMutation<
		FinancePlanTemplate,
		Error,
		FinancePlanTemplateCreate
	>({
		mutationFn: async (input) =>
			await apiClient("/api/finance/plan-templates", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => {
			showToast("Plan template created.", "success");
			invalidate(FINANCE_MANAGEMENT_QUERY_KEYS.templates);
		},
		onError: (error) => reportError(error, "Could not create plan template."),
	});

	const createTemplateItemMutation = useMutation<
		FinancePlanTemplateItem,
		Error,
		TemplateItemMutationInput
	>({
		mutationFn: async ({ templateId, item }) =>
			await apiClient(
				`/api/finance/plan-templates/${encodeURIComponent(templateId)}/items`,
				{
					method: "POST",
					body: JSON.stringify(item),
				},
			),
		onSuccess: () => {
			showToast("Template item added.", "success");
			invalidate(FINANCE_MANAGEMENT_QUERY_KEYS.templates);
		},
		onError: (error) => reportError(error, "Could not add template item."),
	});

	const deleteTemplateItemMutation = useMutation<
		void,
		Error,
		DeleteTemplateItemInput
	>({
		mutationFn: async ({ templateId, itemId }) =>
			await apiClient(
				`/api/finance/plan-templates/${encodeURIComponent(
					templateId,
				)}/items/${encodeURIComponent(itemId)}`,
				{ method: "DELETE" },
			),
		onSuccess: () => {
			showToast("Template item deleted.", "success");
			invalidate(FINANCE_MANAGEMENT_QUERY_KEYS.templates);
		},
		onError: (error) => reportError(error, "Could not delete template item."),
	});

	const assignTemplateMutation = useMutation<
		FinancePlanTemplateAssignmentResponse,
		Error,
		TemplateAssignmentInput
	>({
		mutationFn: async ({ projectId, templateId }) =>
			await apiClient(
				`/api/finance/projects/${encodeURIComponent(
					projectId,
				)}/template-assignments`,
				{
					method: "POST",
					body: JSON.stringify({ template_id: templateId }),
				},
			),
		onSuccess: (result) => {
			showToast(
				`${result.created_plan_items.length} plan item(s) created.`,
				"success",
			);
			invalidate(
				FINANCE_PLAN_ITEMS_QUERY_KEY,
				FINANCE_MANAGEMENT_QUERY_KEYS.reconciliation,
				FINANCE_MANAGEMENT_QUERY_KEYS.report,
			);
		},
		onError: (error) =>
			reportError(error, "Could not apply the plan template."),
	});

	const createReallocationMutation = useMutation<
		FinanceReallocationRequest,
		Error,
		FinanceReallocationRequestCreate
	>({
		mutationFn: async (input) =>
			await apiClient("/api/finance/reallocation-requests", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => {
			showToast("Reallocation request submitted.", "success");
			invalidate(FINANCE_MANAGEMENT_QUERY_KEYS.reallocations);
		},
		onError: (error) =>
			reportError(error, "Could not submit the reallocation request."),
	});

	const reviewReallocationMutation = useMutation<
		FinanceReallocationRequest,
		Error,
		ReallocationReviewInput
	>({
		mutationFn: async ({ requestId, review }) =>
			await apiClient(
				`/api/finance/reallocation-requests/${encodeURIComponent(
					requestId,
				)}/review`,
				{
					method: "POST",
					body: JSON.stringify(review),
				},
			),
		onSuccess: (_, input) => {
			showToast(
				input.review.decision === "approved"
					? "Reallocation approved."
					: "Reallocation rejected.",
				"success",
			);
			invalidate(
				FINANCE_MANAGEMENT_QUERY_KEYS.reallocations,
				FINANCE_MANAGEMENT_QUERY_KEYS.reconciliation,
				FINANCE_MANAGEMENT_QUERY_KEYS.report,
			);
		},
		onError: (error) =>
			reportError(error, "Could not review the reallocation request."),
	});

	const createBudgetTransferMutation = useMutation<
		FinanceBudgetTransferRequest,
		Error,
		FinanceBudgetTransferRequestCreate
	>({
		mutationFn: async (input) =>
			await apiClient("/api/finance/budget-transfer-requests", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => {
			showToast("Budget transfer request submitted.", "success");
			invalidate(FINANCE_MANAGEMENT_QUERY_KEYS.budgetTransfers);
		},
		onError: (error) =>
			reportError(error, "Could not submit the budget transfer request."),
	});

	const reviewBudgetTransferMutation = useMutation<
		FinanceBudgetTransferRequest,
		Error,
		BudgetTransferReviewInput
	>({
		mutationFn: async ({ requestId, review }) =>
			await apiClient(
				`/api/finance/budget-transfer-requests/${encodeURIComponent(
					requestId,
				)}/review`,
				{
					method: "POST",
					body: JSON.stringify(review),
				},
			),
		onSuccess: (_, input) => {
			showToast(
				input.review.decision === "approved"
					? "Budget transfer approved."
					: "Budget transfer rejected.",
				"success",
			);
			invalidate(
				FINANCE_MANAGEMENT_QUERY_KEYS.budgetTransfers,
				FINANCE_MANAGEMENT_QUERY_KEYS.report,
			);
		},
		onError: (error) =>
			reportError(error, "Could not review the budget transfer request."),
	});

	function setPeriodType(type: FinancePeriodType): void {
		setPeriod((current) =>
			current.type === type
				? current
				: switchFinancePeriodType(type, current.key),
		);
	}

	function setPeriodKey(key: string): void {
		setPeriod((current) => ({ ...current, key }));
	}

	async function exportReport(): Promise<void> {
		const report = reportQuery.data;
		if (!report || report.departments.length === 0) {
			showToast("No finance report data to export.", "warning");
			return;
		}

		try {
			await writeXlsxFile(buildReportSheet(report)).toFile(
				`finance-report-${report.period_key}-${exportScopeName(
					report,
					department,
				)}.xlsx`,
			);
			showToast("Finance report exported.", "success");
		} catch {
			showToast("Could not generate the finance report export.", "error");
		}
	}

	function printReport(): void {
		window.print();
	}

	return {
		period,
		setPeriodType,
		setPeriodKey,
		// FR-O: the Projekte and Abgleich tabs are gone. Project CRUD, allocation
		// and matching moved into the T-view; what stayed behind is the template
		// setup and the approval inbox, so the prop bags follow the tabs.
		templateManager: {
			templates: templatesQuery.data?.templates ?? [],
			canManage,
			isCreatingTemplate: createTemplateMutation.isPending,
			pendingTemplateItemId: createTemplateItemMutation.isPending
				? (createTemplateItemMutation.variables?.templateId ?? null)
				: null,
			deletingTemplateItemId: deleteTemplateItemMutation.isPending
				? (deleteTemplateItemMutation.variables?.itemId ?? null)
				: null,
			onCreateTemplate: async (input: FinancePlanTemplateCreate) => {
				await createTemplateMutation.mutateAsync(input);
			},
			onCreateTemplateItem: async (input: TemplateItemMutationInput) => {
				await createTemplateItemMutation.mutateAsync(input);
			},
			onDeleteTemplateItem: async (input: DeleteTemplateItemInput) => {
				await deleteTemplateItemMutation.mutateAsync(input);
			},
		},
		templateAssignForm: {
			period,
			projects: projectsQuery.data?.projects ?? [],
			templates: templatesQuery.data?.templates ?? [],
			pendingProjectId: assignTemplateMutation.isPending
				? (assignTemplateMutation.variables?.projectId ?? null)
				: null,
			onAssign: async (projectId: string, templateId: string) => {
				await assignTemplateMutation.mutateAsync({ projectId, templateId });
			},
		},
		// The T-view raises these from an invoice row; the queue above reviews
		// them (FR-O).
		reallocationRequest: {
			isPending: createReallocationMutation.isPending,
			onSubmit: async (input: FinanceReallocationRequestCreate) => {
				await createReallocationMutation.mutateAsync(input);
			},
		},
		approvalsSection: {
			period,
			reallocationRequests: reallocationsQuery.data?.requests ?? [],
			budgetTransferRequests: budgetTransfersQuery.data?.requests ?? [],
			department,
			canManage,
			error:
				(reallocationsQuery.error as Error | null) ??
				(budgetTransfersQuery.error as Error | null),
			reviewingRequestId: reviewReallocationMutation.isPending
				? (reviewReallocationMutation.variables?.requestId ?? null)
				: null,
			pendingBudgetTransfer: createBudgetTransferMutation.isPending,
			reviewingBudgetTransferId: reviewBudgetTransferMutation.isPending
				? (reviewBudgetTransferMutation.variables?.requestId ?? null)
				: null,
			onPeriodTypeChange: setPeriodType,
			onPeriodKeyChange: setPeriodKey,
			onReviewReallocation: async (input: ReallocationReviewInput) => {
				await reviewReallocationMutation.mutateAsync(input);
			},
			onCreateBudgetTransfer: async (
				input: FinanceBudgetTransferRequestCreate,
			) => {
				await createBudgetTransferMutation.mutateAsync(input);
			},
			onReviewBudgetTransfer: async (input: BudgetTransferReviewInput) => {
				await reviewBudgetTransferMutation.mutateAsync(input);
			},
		},
		reportSection: {
			period,
			report: reportQuery.data,
			isLoading: reportQuery.isLoading,
			error: reportQuery.error as Error | null,
			isExporting: false,
			onPeriodTypeChange: setPeriodType,
			onPeriodKeyChange: setPeriodKey,
			onExport: exportReport,
			onPrint: printReport,
		},
	};
}
