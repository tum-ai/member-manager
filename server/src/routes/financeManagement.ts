import {
	FinanceBudgetTransferRequestCreateSchema,
	FinanceBudgetTransferRequestsQuerySchema,
	FinanceBudgetTransferRequestsResponseSchema,
	FinancePeriodReportQuerySchema,
	FinancePlanItemPostingMatchCreateSchema,
	FinancePlanTemplateAssignmentCreateSchema,
	FinancePlanTemplateAssignmentResponseSchema,
	FinancePlanTemplateCreateSchema,
	FinancePlanTemplateItemCreateSchema,
	FinancePlanTemplateItemSchema,
	FinancePlanTemplateItemUpdateSchema,
	FinancePlanTemplatesResponseSchema,
	FinancePlanTemplateUpdateSchema,
	FinancePostingAllocationReplaceSchema,
	FinancePostingAllocationsResponseSchema,
	type FinanceProjectCreate,
	FinanceProjectCreateSchema,
	FinanceProjectsQuerySchema,
	FinanceProjectsResponseSchema,
	FinanceProjectUpdateSchema,
	FinanceReallocationRequestCreateSchema,
	FinanceReallocationRequestsQuerySchema,
	FinanceReallocationRequestsResponseSchema,
	FinanceReallocationReviewSchema,
	FinanceReconciliationQuerySchema,
	isValidFinancePeriodKey,
	resolveFinancePeriodRange,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { type ZodType, z } from "zod";
import {
	BuchhaltungsButlerApiError,
	BuchhaltungsButlerConfigError,
} from "../lib/buchhaltungsbutler.js";
import { getBuchhaltungsButlerTransactions } from "../lib/buchhaltungsbutlerPostings.js";
import {
	BadGatewayError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ServiceUnavailableError,
	ValidationError,
} from "../lib/errors.js";
import {
	calculatePostingScopeCapacity,
	createFinanceReallocationRequest,
	createPlanItemPostingMatch,
	deletePlanItemPostingMatch,
	getFinanceReallocationPostingExternalId,
	getPlanItemPostingMatch,
	listFinanceReallocationRequests,
	loadPlanItemPostingMatches,
	loadPostingAllocations,
	normalizePostingAllocations,
	replacePostingAllocations,
	reviewFinanceReallocationRequest,
} from "../lib/financeAllocations.js";
import { loadBudgets } from "../lib/financeBudgets.js";
import {
	createFinanceBudgetTransferRequest,
	listFinanceBudgetTransferRequests,
	reviewFinanceBudgetTransferRequest,
} from "../lib/financeBudgetTransfers.js";
import { loadDepartmentMappings } from "../lib/financeDepartments.js";
import {
	assignFinancePlanTemplate,
	createFinancePlanTemplate,
	createFinancePlanTemplateItem,
	createFinanceProject,
	deleteFinancePlanTemplateItem,
	getFinancePlanTemplate,
	getFinanceProject,
	getManagedPlanItem,
	listFinancePlanTemplates,
	listFinanceProjects,
	loadManagedPlanItems,
	updateFinancePlanTemplate,
	updateFinancePlanTemplateItem,
	updateFinanceProject,
	wouldCreateFinanceProjectCycle,
} from "../lib/financeProjects.js";
import {
	buildFinancePeriodReport,
	buildFinanceReconciliation,
	canViewPostingInDepartment,
	derivePostingDefaults,
} from "../lib/financeReports.js";
import {
	assertCanWriteDepartment,
	resolveFinanceViewerScope,
} from "../lib/financeScope.js";
import {
	authenticate,
	requireFinanceViewer,
	requireReimbursementReviewer,
} from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const UuidParamsSchema = z.object({
	id: z.string().uuid(),
});
const ProjectParamsSchema = z.object({
	projectId: z.string().uuid(),
});
const TemplateParamsSchema = z.object({
	templateId: z.string().uuid(),
});
const TemplateItemParamsSchema = z.object({
	templateId: z.string().uuid(),
	itemId: z.string().uuid(),
});
const ReallocationParamsSchema = z.object({
	requestId: z.string().uuid(),
});
const ExternalIdParamsSchema = z.object({
	externalId: z.string().trim().min(1).max(200),
});

function parseInput<T>(schema: ZodType<T>, value: unknown, message: string): T {
	const parsed = schema.safeParse(value);
	if (!parsed.success) {
		throw new ValidationError(message, parsed.error.flatten());
	}
	return parsed.data;
}

function userId(request: AuthenticatedRequest): string {
	return request.user.id;
}

async function loadTransactions(query: {
	date_from?: string;
	date_to?: string;
}) {
	try {
		return await getBuchhaltungsButlerTransactions(query);
	} catch (error) {
		if (error instanceof BuchhaltungsButlerConfigError) {
			throw new ServiceUnavailableError(error.message);
		}
		if (error instanceof BuchhaltungsButlerApiError) {
			throw new BadGatewayError("BuchhaltungsButler postings request failed");
		}
		throw error;
	}
}

async function loadPosting(
	externalId: string,
	period?: {
		periodType: "year" | "semester";
		periodKey: string;
	},
) {
	const range = period
		? resolveFinancePeriodRange(period.periodType, period.periodKey)
		: null;
	const result = await loadTransactions({
		date_from: range?.dateFrom,
		date_to: range?.dateTo,
	});
	const posting = result.transactions.find(
		(transaction) => transaction.external_id === externalId,
	);
	if (!posting) {
		throw new NotFoundError("BuchhaltungsButler posting not found");
	}
	return { posting, source: result.source };
}

async function validateProjectParent(
	projectId: string | null,
	input: FinanceProjectCreate,
): Promise<void> {
	if (!input.parent_project_id) return;

	const parent = await getFinanceProject(input.parent_project_id);
	if (!parent) {
		throw new NotFoundError("Parent finance project not found");
	}
	if (
		parent.department !== input.department ||
		parent.period_type !== input.period_type ||
		parent.period_key !== input.period_key
	) {
		throw new ValidationError(
			"Parent project must use the same department and period",
		);
	}

	if (projectId) {
		const projects = await listFinanceProjects({}, null);
		if (
			wouldCreateFinanceProjectCycle(
				projectId,
				input.parent_project_id,
				projects,
			)
		) {
			throw new ConflictError("Project hierarchy cannot contain a cycle");
		}
	}
}

export async function financeManagementRoutes(server: FastifyInstance) {
	server.get(
		"/finance/projects",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request) => {
			const query = parseInput(
				FinanceProjectsQuerySchema,
				request.query,
				"Invalid finance project query",
			);
			const scope = await resolveFinanceViewerScope(
				userId(request as AuthenticatedRequest),
				query.department,
			);
			return FinanceProjectsResponseSchema.parse({
				projects: await listFinanceProjects(query, scope.department),
			});
		},
	);

	server.post(
		"/finance/projects",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request, reply) => {
			const body = parseInput(
				FinanceProjectCreateSchema,
				request.body,
				"Invalid finance project",
			);
			const actor = userId(request as AuthenticatedRequest);
			await assertCanWriteDepartment(actor, body.department);
			await validateProjectParent(null, body);
			const project = await createFinanceProject(body, actor);
			return reply.status(201).send(project);
		},
	);

	server.patch(
		"/finance/projects/:projectId",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request) => {
			const { projectId } = parseInput(
				ProjectParamsSchema,
				request.params,
				"Invalid finance project id",
			);
			const body = parseInput(
				FinanceProjectUpdateSchema,
				request.body,
				"Invalid finance project",
			);
			const existing = await getFinanceProject(projectId);
			if (!existing) {
				throw new NotFoundError("Finance project not found");
			}

			const merged = parseInput(
				FinanceProjectCreateSchema,
				{
					parent_project_id:
						body.parent_project_id === undefined
							? existing.parent_project_id
							: body.parent_project_id,
					name: body.name ?? existing.name,
					department: body.department ?? existing.department,
					period_type: body.period_type ?? existing.period_type,
					period_key: body.period_key ?? existing.period_key,
					tax_area:
						body.tax_area === undefined ? existing.tax_area : body.tax_area,
					target_amount: body.target_amount ?? existing.target_amount,
					status: body.status ?? existing.status,
					description:
						body.description === undefined
							? existing.description
							: body.description,
				},
				"Invalid finance project",
			);
			const actor = userId(request as AuthenticatedRequest);
			await assertCanWriteDepartment(actor, existing.department);
			await assertCanWriteDepartment(actor, merged.department);
			await validateProjectParent(projectId, merged);
			return await updateFinanceProject(projectId, merged);
		},
	);

	server.get(
		"/finance/plan-templates",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async () =>
			FinancePlanTemplatesResponseSchema.parse({
				templates: await listFinancePlanTemplates(),
			}),
	);

	server.post(
		"/finance/plan-templates",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const body = parseInput(
				FinancePlanTemplateCreateSchema,
				request.body,
				"Invalid finance plan template",
			);
			const template = await createFinancePlanTemplate(
				body,
				userId(request as AuthenticatedRequest),
			);
			return reply.status(201).send(template);
		},
	);

	server.patch(
		"/finance/plan-templates/:templateId",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request) => {
			const { templateId } = parseInput(
				TemplateParamsSchema,
				request.params,
				"Invalid finance plan template id",
			);
			const body = parseInput(
				FinancePlanTemplateUpdateSchema,
				request.body,
				"Invalid finance plan template",
			);
			if (!(await getFinancePlanTemplate(templateId))) {
				throw new NotFoundError("Finance plan template not found");
			}
			return await updateFinancePlanTemplate(templateId, body);
		},
	);

	server.post(
		"/finance/plan-templates/:templateId/items",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const { templateId } = parseInput(
				TemplateParamsSchema,
				request.params,
				"Invalid finance plan template id",
			);
			const body = parseInput(
				FinancePlanTemplateItemCreateSchema,
				request.body,
				"Invalid finance plan template item",
			);
			if (!(await getFinancePlanTemplate(templateId))) {
				throw new NotFoundError("Finance plan template not found");
			}
			const item = await createFinancePlanTemplateItem(templateId, body);
			return reply.status(201).send(FinancePlanTemplateItemSchema.parse(item));
		},
	);

	server.patch(
		"/finance/plan-templates/:templateId/items/:itemId",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request) => {
			const { templateId, itemId } = parseInput(
				TemplateItemParamsSchema,
				request.params,
				"Invalid finance plan template item id",
			);
			const body = parseInput(
				FinancePlanTemplateItemUpdateSchema,
				request.body,
				"Invalid finance plan template item",
			);
			const template = await getFinancePlanTemplate(templateId);
			if (!template?.items.some((item) => item.id === itemId)) {
				throw new NotFoundError("Finance plan template item not found");
			}
			return await updateFinancePlanTemplateItem(itemId, body);
		},
	);

	server.delete(
		"/finance/plan-templates/:templateId/items/:itemId",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const { templateId, itemId } = parseInput(
				TemplateItemParamsSchema,
				request.params,
				"Invalid finance plan template item id",
			);
			const template = await getFinancePlanTemplate(templateId);
			if (!template?.items.some((item) => item.id === itemId)) {
				throw new NotFoundError("Finance plan template item not found");
			}
			await deleteFinancePlanTemplateItem(itemId);
			return reply.status(204).send();
		},
	);

	server.post(
		"/finance/projects/:projectId/template-assignments",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request, reply) => {
			const { projectId } = parseInput(
				ProjectParamsSchema,
				request.params,
				"Invalid finance project id",
			);
			const body = parseInput(
				FinancePlanTemplateAssignmentCreateSchema,
				request.body,
				"Invalid finance plan template assignment",
			);
			const project = await getFinanceProject(projectId);
			if (!project) {
				throw new NotFoundError("Finance project not found");
			}
			if (!(await getFinancePlanTemplate(body.template_id))) {
				throw new NotFoundError("Finance plan template not found");
			}
			const actor = userId(request as AuthenticatedRequest);
			await assertCanWriteDepartment(actor, project.department);
			const result = await assignFinancePlanTemplate(
				projectId,
				body.template_id,
				actor,
			);
			return reply
				.status(201)
				.send(FinancePlanTemplateAssignmentResponseSchema.parse(result));
		},
	);

	server.get(
		"/finance/posting-allocations/:externalId",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request) => {
			const { externalId } = parseInput(
				ExternalIdParamsSchema,
				request.params,
				"Invalid posting external id",
			);
			const actor = userId(request as AuthenticatedRequest);
			const [{ posting }, mappings, allocations] = await Promise.all([
				loadPosting(externalId),
				loadDepartmentMappings(),
				loadPostingAllocations([externalId]),
			]);
			const scope = await resolveFinanceViewerScope(actor);
			if (
				scope.department &&
				!canViewPostingInDepartment(
					posting,
					scope.department,
					mappings,
					allocations,
				)
			) {
				throw new ForbiddenError("Cannot access another department's posting");
			}
			return FinancePostingAllocationsResponseSchema.parse({
				posting,
				allocations:
					scope.department === null
						? allocations
						: allocations.filter(
								(allocation) => allocation.department === scope.department,
							),
			});
		},
	);

	server.put(
		"/finance/posting-allocations/:externalId",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request) => {
			const { externalId } = parseInput(
				ExternalIdParamsSchema,
				request.params,
				"Invalid posting external id",
			);
			const body = parseInput(
				FinancePostingAllocationReplaceSchema,
				request.body,
				"Invalid posting allocations",
			);
			const [{ posting }, mappings] = await Promise.all([
				loadPosting(externalId),
				loadDepartmentMappings(),
			]);
			const allocations = await normalizePostingAllocations(
				posting,
				body.allocations,
				derivePostingDefaults(posting, mappings),
			);
			const saved = await replacePostingAllocations(
				externalId,
				allocations,
				userId(request as AuthenticatedRequest),
				posting.transaction_amount,
			);
			return FinancePostingAllocationsResponseSchema.parse({
				posting,
				allocations: saved,
			});
		},
	);

	server.get(
		"/finance/reallocation-requests",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request) => {
			const query = parseInput(
				FinanceReallocationRequestsQuerySchema,
				request.query,
				"Invalid reallocation request query",
			);
			const scope = await resolveFinanceViewerScope(
				userId(request as AuthenticatedRequest),
				query.department,
			);
			return FinanceReallocationRequestsResponseSchema.parse({
				requests: await listFinanceReallocationRequests({
					department: scope.department,
					status: query.status,
				}),
			});
		},
	);

	server.post(
		"/finance/reallocation-requests",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request, reply) => {
			const body = parseInput(
				FinanceReallocationRequestCreateSchema,
				request.body,
				"Invalid reallocation request",
			);
			const actor = userId(request as AuthenticatedRequest);
			const scope = await resolveFinanceViewerScope(
				actor,
				body.requesting_department,
			);
			const [{ posting }, mappings, currentAllocations] = await Promise.all([
				loadPosting(body.posting_external_id),
				loadDepartmentMappings(),
				loadPostingAllocations([body.posting_external_id]),
			]);
			if (
				scope.department &&
				!canViewPostingInDepartment(
					posting,
					scope.department,
					mappings,
					currentAllocations,
				)
			) {
				throw new ForbiddenError(
					"Cannot request changes for another department's posting",
				);
			}

			const defaults = derivePostingDefaults(posting, mappings);
			const allocations = await normalizePostingAllocations(
				posting,
				body.allocations,
				defaults,
			);
			const requestingDepartment =
				scope.department ??
				body.requesting_department ??
				currentAllocations.find((allocation) => allocation.department)
					?.department ??
				defaults.department ??
				allocations.find((allocation) => allocation.department)?.department;
			if (!requestingDepartment) {
				throw new ValidationError("Requesting department is required");
			}

			const created = await createFinanceReallocationRequest({
				postingExternalId: body.posting_external_id,
				requestingDepartment,
				reason: body.reason,
				allocations,
				actor,
				postingAmount: posting.transaction_amount,
			});
			return reply.status(201).send(created);
		},
	);

	server.post(
		"/finance/reallocation-requests/:requestId/review",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request) => {
			const { requestId } = parseInput(
				ReallocationParamsSchema,
				request.params,
				"Invalid reallocation request id",
			);
			const body = parseInput(
				FinanceReallocationReviewSchema,
				request.body,
				"Invalid reallocation review",
			);
			let postingAmount: number | null = null;
			if (body.decision === "approved") {
				const postingExternalId =
					await getFinanceReallocationPostingExternalId(requestId);
				if (!postingExternalId) {
					throw new NotFoundError("Reallocation request not found");
				}
				const { posting } = await loadPosting(postingExternalId);
				postingAmount = posting.transaction_amount;
			}
			return await reviewFinanceReallocationRequest({
				requestId,
				decision: body.decision,
				reviewer: userId(request as AuthenticatedRequest),
				reviewNote: body.review_note ?? null,
				postingAmount,
			});
		},
	);

	server.get(
		"/finance/budget-transfer-requests",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request) => {
			const query = parseInput(
				FinanceBudgetTransferRequestsQuerySchema,
				request.query,
				"Invalid budget transfer request query",
			);
			const scope = await resolveFinanceViewerScope(
				userId(request as AuthenticatedRequest),
				query.department,
			);
			return FinanceBudgetTransferRequestsResponseSchema.parse({
				requests: await listFinanceBudgetTransferRequests({
					department: scope.department,
					status: query.status,
				}),
			});
		},
	);

	server.post(
		"/finance/budget-transfer-requests",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request, reply) => {
			const body = parseInput(
				FinanceBudgetTransferRequestCreateSchema,
				request.body,
				"Invalid budget transfer request",
			);
			const actor = userId(request as AuthenticatedRequest);
			const scope = await resolveFinanceViewerScope(
				actor,
				body.source_department,
			);
			const sourceDepartment = scope.department ?? body.source_department;
			if (!sourceDepartment) {
				throw new ValidationError("Source department is required");
			}
			if (sourceDepartment === body.target_department) {
				throw new ValidationError("Source and target departments must differ");
			}

			const created = await createFinanceBudgetTransferRequest({
				sourceDepartment,
				targetDepartment: body.target_department,
				periodType: body.period_type,
				periodKey: body.period_key,
				amount: body.amount,
				reason: body.reason,
				actor,
			});
			return reply.status(201).send(created);
		},
	);

	server.post(
		"/finance/budget-transfer-requests/:requestId/review",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request) => {
			const { requestId } = parseInput(
				ReallocationParamsSchema,
				request.params,
				"Invalid budget transfer request id",
			);
			const body = parseInput(
				FinanceReallocationReviewSchema,
				request.body,
				"Invalid budget transfer review",
			);
			return await reviewFinanceBudgetTransferRequest({
				requestId,
				decision: body.decision,
				reviewer: userId(request as AuthenticatedRequest),
				reviewNote: body.review_note ?? null,
			});
		},
	);

	server.post(
		"/finance/plan-item-matches",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request, reply) => {
			const body = parseInput(
				FinancePlanItemPostingMatchCreateSchema,
				request.body,
				"Invalid plan item posting match",
			);
			const item = await getManagedPlanItem(body.plan_item_id);
			if (!item) {
				throw new NotFoundError("Finance plan item not found");
			}
			const actor = userId(request as AuthenticatedRequest);
			await assertCanWriteDepartment(actor, item.department);
			const [{ posting }, mappings, allocations] = await Promise.all([
				loadPosting(body.posting_external_id, {
					periodType: item.period_type,
					periodKey: item.period_key,
				}),
				loadDepartmentMappings(),
				loadPostingAllocations([body.posting_external_id]),
			]);
			if (
				!canViewPostingInDepartment(
					posting,
					item.department,
					mappings,
					allocations,
				)
			) {
				throw new ValidationError(
					"Posting does not belong to the plan item's department",
				);
			}
			const postingDirection =
				posting.transaction_amount < 0 ? "expense" : "income";
			if ((item.direction ?? "expense") !== postingDirection) {
				throw new ValidationError(
					"Posting direction does not match the plan item direction",
				);
			}

			const projectId = item.project_id ?? null;
			if (projectId && allocations.length === 0) {
				throw new ValidationError(
					"Posting must be allocated to the plan item's project before matching",
				);
			}
			const postingCapacity = calculatePostingScopeCapacity(
				posting.transaction_amount,
				allocations,
				{
					department: item.department,
					projectId,
				},
			);

			if (postingCapacity <= 0) {
				throw new ValidationError(
					"Posting has no allocation in the plan item's department and project",
				);
			}

			const match = await createPlanItemPostingMatch(body, actor, {
				postingAmount: posting.transaction_amount,
				postingDirection,
			});
			return reply.status(201).send(match);
		},
	);

	server.delete(
		"/finance/plan-item-matches/:id",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request, reply) => {
			const { id } = parseInput(
				UuidParamsSchema,
				request.params,
				"Invalid plan item posting match id",
			);
			const match = await getPlanItemPostingMatch(id);
			if (!match) {
				throw new NotFoundError("Plan item posting match not found");
			}
			const item = await getManagedPlanItem(match.plan_item_id);
			if (!item) {
				throw new NotFoundError("Finance plan item not found");
			}
			await assertCanWriteDepartment(
				userId(request as AuthenticatedRequest),
				item.department,
			);
			await deletePlanItemPostingMatch(id);
			return reply.status(204).send();
		},
	);

	server.get(
		"/finance/reconciliation",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request) => {
			const query = parseInput(
				FinanceReconciliationQuerySchema,
				request.query,
				"Invalid finance reconciliation query",
			);
			const actor = userId(request as AuthenticatedRequest);
			const scope = await resolveFinanceViewerScope(actor, query.department);
			if (query.project_id) {
				const project = await getFinanceProject(query.project_id);
				if (!project) {
					throw new NotFoundError("Finance project not found");
				}
				await assertCanWriteDepartment(actor, project.department);
				if (
					project.period_type !== query.period_type ||
					project.period_key !== query.period_key
				) {
					throw new ValidationError(
						"Project does not belong to the requested period",
					);
				}
			}
			const range = resolveFinancePeriodRange(
				query.period_type,
				query.period_key,
			);
			const [{ transactions, source }, mappings, planItems] = await Promise.all(
				[
					loadTransactions({
						date_from: range.dateFrom,
						date_to: range.dateTo,
					}),
					loadDepartmentMappings(),
					loadManagedPlanItems(
						query.period_type,
						query.period_key,
						scope.department,
						query.project_id,
					),
				],
			);
			const [allocations, matches] = await Promise.all([
				loadPostingAllocations(
					transactions.map((transaction) => transaction.external_id),
				),
				loadPlanItemPostingMatches({
					planItemIds: planItems.map((item) => item.id),
				}),
			]);
			return buildFinanceReconciliation({
				periodType: query.period_type,
				periodKey: query.period_key,
				transactions,
				mappings,
				allocations,
				matches,
				planItems,
				department: scope.department,
				projectId: query.project_id,
				source,
			});
		},
	);

	server.get(
		"/finance/reports/period-summary",
		{ preHandler: [authenticate, requireFinanceViewer] },
		async (request) => {
			const query = parseInput(
				FinancePeriodReportQuerySchema,
				request.query,
				"Invalid finance report query",
			);
			if (!isValidFinancePeriodKey(query.period_type, query.period_key)) {
				throw new ValidationError("Invalid finance report period");
			}
			const scope = await resolveFinanceViewerScope(
				userId(request as AuthenticatedRequest),
				query.department,
			);
			const range = resolveFinancePeriodRange(
				query.period_type,
				query.period_key,
			);
			const [{ transactions, source }, mappings, budgets, planItems, projects] =
				await Promise.all([
					loadTransactions({
						date_from: range.dateFrom,
						date_to: range.dateTo,
					}),
					loadDepartmentMappings(),
					loadBudgets(query.period_type, query.period_key),
					loadManagedPlanItems(
						query.period_type,
						query.period_key,
						scope.department,
					),
					listFinanceProjects(
						{
							period_type: query.period_type,
							period_key: query.period_key,
						},
						scope.department,
					),
				]);
			const allocations = await loadPostingAllocations(
				transactions.map((transaction) => transaction.external_id),
			);
			return buildFinancePeriodReport({
				periodType: query.period_type,
				periodKey: query.period_key,
				transactions,
				mappings,
				allocations,
				budgets:
					scope.department === null
						? budgets
						: budgets.filter(
								(budget) => budget.department === scope.department,
							),
				planItems,
				projects,
				department: scope.department,
				source,
			});
		},
	);
}
