import type {
	FinanceBudgetTransferRequest,
	FinanceBudgetTransferRequestCreate,
	FinanceBudgetTransferRequestsResponse,
	FinancePeriodReportResponse,
	FinancePlanItemPostingMatch,
	FinancePlanItemPostingMatchCreate,
	FinancePlanItemsResponse,
	FinancePlanTemplate,
	FinancePlanTemplateAssignmentResponse,
	FinancePlanTemplateCreate,
	FinancePlanTemplateItem,
	FinancePlanTemplateItemCreate,
	FinancePlanTemplatesResponse,
	FinancePostingAllocationInput,
	FinancePostingAllocationsResponse,
	FinanceProject,
	FinanceProjectCreate,
	FinanceProjectsResponse,
	FinanceReallocationRequest,
	FinanceReallocationRequestCreate,
	FinanceReallocationRequestsResponse,
	FinanceReallocationReview,
	FinanceReconciliationResponse,
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

export type FinanceManagementSection = "projects" | "reconciliation" | "report";

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

const PLAN_ITEMS_QUERY_KEY = "finance-plan-items";

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

function buildPlanItemsEndpoint(
	period: FinancePeriod,
	department: string | null,
): string {
	return `/api/finance/plan-items?${buildPeriodParams(period, department).toString()}`;
}

function buildReconciliationEndpoint(
	period: FinancePeriod,
	department: string | null,
	projectId: string | null,
): string {
	const params = buildPeriodParams(period, department);
	if (projectId) {
		params.set("project_id", projectId);
	}
	return `/api/finance/reconciliation?${params.toString()}`;
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
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
		null,
	);
	const accessReady = canManage || Boolean(department);
	const projectsActive =
		activeSection === "projects" || activeSection === "reconciliation";
	const reconciliationActive = activeSection === "reconciliation";

	const projectsQuery = useQuery<FinanceProjectsResponse>({
		queryKey: [
			FINANCE_MANAGEMENT_QUERY_KEYS.projects,
			period.type,
			period.key,
			department,
		],
		queryFn: async () =>
			await apiClient(buildProjectsEndpoint(period, department)),
		enabled: accessReady && projectsActive,
	});

	const templatesQuery = useQuery<FinancePlanTemplatesResponse>({
		queryKey: [FINANCE_MANAGEMENT_QUERY_KEYS.templates],
		queryFn: async () => await apiClient("/api/finance/plan-templates"),
		enabled: accessReady && activeSection === "projects",
	});

	const planItemsQuery = useQuery<FinancePlanItemsResponse>({
		queryKey: [PLAN_ITEMS_QUERY_KEY, period.type, period.key, department],
		queryFn: async () =>
			await apiClient(buildPlanItemsEndpoint(period, department)),
		enabled: accessReady && reconciliationActive,
	});

	const reconciliationQuery = useQuery<FinanceReconciliationResponse>({
		queryKey: [
			FINANCE_MANAGEMENT_QUERY_KEYS.reconciliation,
			period.type,
			period.key,
			department,
			selectedProjectId,
		],
		queryFn: async () =>
			await apiClient(
				buildReconciliationEndpoint(period, department, selectedProjectId),
			),
		enabled: accessReady && reconciliationActive,
	});

	const reallocationsQuery = useQuery<FinanceReallocationRequestsResponse>({
		queryKey: [
			FINANCE_MANAGEMENT_QUERY_KEYS.reallocations,
			department,
			canManage,
		],
		queryFn: async () =>
			await apiClient(buildReallocationsEndpoint(department)),
		enabled: accessReady && reconciliationActive,
	});

	const budgetTransfersQuery = useQuery<FinanceBudgetTransferRequestsResponse>({
		queryKey: [
			FINANCE_MANAGEMENT_QUERY_KEYS.budgetTransfers,
			department,
			canManage,
		],
		queryFn: async () =>
			await apiClient(buildBudgetTransfersEndpoint(department)),
		enabled: accessReady && reconciliationActive,
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

	const createProjectMutation = useMutation<
		FinanceProject,
		Error,
		FinanceProjectCreate
	>({
		mutationFn: async (input) =>
			await apiClient("/api/finance/projects", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => {
			showToast("Finance project created.", "success");
			invalidate(
				FINANCE_MANAGEMENT_QUERY_KEYS.projects,
				FINANCE_MANAGEMENT_QUERY_KEYS.report,
			);
		},
		onError: (error) => reportError(error, "Could not create finance project."),
	});

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
				PLAN_ITEMS_QUERY_KEY,
				FINANCE_MANAGEMENT_QUERY_KEYS.reconciliation,
				FINANCE_MANAGEMENT_QUERY_KEYS.report,
			);
		},
		onError: (error) =>
			reportError(error, "Could not apply the plan template."),
	});

	const replaceAllocationsMutation = useMutation<
		FinancePostingAllocationsResponse,
		Error,
		PostingAllocationInput
	>({
		mutationFn: async ({ postingExternalId, allocations }) =>
			await apiClient(
				`/api/finance/posting-allocations/${encodeURIComponent(
					postingExternalId,
				)}`,
				{
					method: "PUT",
					body: JSON.stringify({ allocations }),
				},
			),
		onSuccess: () => {
			showToast("Posting allocation saved.", "success");
			invalidate(
				FINANCE_MANAGEMENT_QUERY_KEYS.reconciliation,
				FINANCE_MANAGEMENT_QUERY_KEYS.reallocations,
				FINANCE_MANAGEMENT_QUERY_KEYS.report,
			);
		},
		onError: (error) =>
			reportError(error, "Could not save the posting allocation."),
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

	const createMatchMutation = useMutation<
		FinancePlanItemPostingMatch,
		Error,
		FinancePlanItemPostingMatchCreate
	>({
		mutationFn: async (input) =>
			await apiClient("/api/finance/plan-item-matches", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => {
			showToast("Posting matched to plan item.", "success");
			invalidate(FINANCE_MANAGEMENT_QUERY_KEYS.reconciliation);
		},
		onError: (error) =>
			reportError(error, "Could not match the posting to a plan item."),
	});

	const deleteMatchMutation = useMutation<void, Error, string>({
		mutationFn: async (matchId) =>
			await apiClient(
				`/api/finance/plan-item-matches/${encodeURIComponent(matchId)}`,
				{ method: "DELETE" },
			),
		onSuccess: () => {
			showToast("Plan item match removed.", "success");
			invalidate(FINANCE_MANAGEMENT_QUERY_KEYS.reconciliation);
		},
		onError: (error) =>
			reportError(error, "Could not remove the plan item match."),
	});

	function setPeriodType(type: FinancePeriodType): void {
		setSelectedProjectId(null);
		setPeriod((current) =>
			current.type === type
				? current
				: switchFinancePeriodType(type, current.key),
		);
	}

	function setPeriodKey(key: string): void {
		setSelectedProjectId(null);
		setPeriod((current) => ({ ...current, key }));
	}

	async function allocatePostingToProject({
		postingExternalId,
		projectId,
	}: ProjectAllocationInput): Promise<void> {
		await replaceAllocationsMutation.mutateAsync({
			postingExternalId,
			allocations: [{ project_id: projectId, percentage: 100 }],
		});
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
		projectSection: {
			period,
			projects: projectsQuery.data?.projects ?? [],
			templates: templatesQuery.data?.templates ?? [],
			department,
			canManage,
			isLoading: projectsQuery.isLoading || templatesQuery.isLoading,
			error:
				(projectsQuery.error as Error | null) ??
				(templatesQuery.error as Error | null),
			isCreatingProject: createProjectMutation.isPending,
			isCreatingTemplate: createTemplateMutation.isPending,
			pendingTemplateItemId: createTemplateItemMutation.isPending
				? (createTemplateItemMutation.variables?.templateId ?? null)
				: null,
			pendingAssignmentProjectId: assignTemplateMutation.isPending
				? (assignTemplateMutation.variables?.projectId ?? null)
				: null,
			deletingTemplateItemId: deleteTemplateItemMutation.isPending
				? (deleteTemplateItemMutation.variables?.itemId ?? null)
				: null,
			onPeriodTypeChange: setPeriodType,
			onPeriodKeyChange: setPeriodKey,
			onCreateProject: async (input: FinanceProjectCreate) => {
				await createProjectMutation.mutateAsync(input);
			},
			onCreateTemplate: async (input: FinancePlanTemplateCreate) => {
				await createTemplateMutation.mutateAsync(input);
			},
			onCreateTemplateItem: async (input: TemplateItemMutationInput) => {
				await createTemplateItemMutation.mutateAsync(input);
			},
			onDeleteTemplateItem: async (input: DeleteTemplateItemInput) => {
				await deleteTemplateItemMutation.mutateAsync(input);
			},
			onAssignTemplate: async (input: TemplateAssignmentInput) => {
				await assignTemplateMutation.mutateAsync(input);
			},
		},
		reconciliationSection: {
			period,
			projects: projectsQuery.data?.projects ?? [],
			planItems: planItemsQuery.data?.items ?? [],
			selectedProjectId,
			reconciliation: reconciliationQuery.data,
			reallocationRequests: reallocationsQuery.data?.requests ?? [],
			budgetTransferRequests: budgetTransfersQuery.data?.requests ?? [],
			department,
			canManage,
			isLoading:
				projectsQuery.isLoading ||
				planItemsQuery.isLoading ||
				reconciliationQuery.isLoading ||
				reallocationsQuery.isLoading ||
				budgetTransfersQuery.isLoading,
			error:
				(projectsQuery.error as Error | null) ??
				(planItemsQuery.error as Error | null) ??
				(reconciliationQuery.error as Error | null) ??
				(reallocationsQuery.error as Error | null) ??
				(budgetTransfersQuery.error as Error | null),
			pendingAllocationExternalId: replaceAllocationsMutation.isPending
				? (replaceAllocationsMutation.variables?.postingExternalId ?? null)
				: null,
			pendingReallocationExternalId: createReallocationMutation.isPending
				? (createReallocationMutation.variables?.posting_external_id ?? null)
				: null,
			pendingMatchExternalId: createMatchMutation.isPending
				? (createMatchMutation.variables?.posting_external_id ?? null)
				: null,
			deletingMatchId: deleteMatchMutation.isPending
				? (deleteMatchMutation.variables ?? null)
				: null,
			reviewingRequestId: reviewReallocationMutation.isPending
				? (reviewReallocationMutation.variables?.requestId ?? null)
				: null,
			pendingBudgetTransfer: createBudgetTransferMutation.isPending,
			reviewingBudgetTransferId: reviewBudgetTransferMutation.isPending
				? (reviewBudgetTransferMutation.variables?.requestId ?? null)
				: null,
			onPeriodTypeChange: setPeriodType,
			onPeriodKeyChange: setPeriodKey,
			onProjectChange: setSelectedProjectId,
			onAllocateToProject: allocatePostingToProject,
			onSplitAllocation: async (input: PostingAllocationInput) => {
				await replaceAllocationsMutation.mutateAsync(input);
			},
			onCreateReallocation: async (input: FinanceReallocationRequestCreate) => {
				await createReallocationMutation.mutateAsync(input);
			},
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
			onMatchPlanItem: async (input: FinancePlanItemPostingMatchCreate) => {
				await createMatchMutation.mutateAsync(input);
			},
			onDeleteMatch: async (matchId: string) => {
				await deleteMatchMutation.mutateAsync(matchId);
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
