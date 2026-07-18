import {
	BuchhaltungsButlerTransactionsQuerySchema,
	BuchhaltungsButlerTransactionsResponseSchema,
	FinanceAccountLabelsResponseSchema,
	FinanceAccountLabelUpsertSchema,
	FinanceAnalyticsResponseSchema,
	FinanceBudgetQuerySchema,
	FinanceBudgetUpsertSchema,
	FinanceBudgetVsActualResponseSchema,
	FinanceCategoryMappingsResponseSchema,
	FinanceCategoryMappingUpsertSchema,
	FinanceDepartmentMappingsResponseSchema,
	FinanceDepartmentMappingUpsertSchema,
	resolveFinancePeriodRange,
} from "@member-manager/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
	BuchhaltungsButlerApiError,
	BuchhaltungsButlerConfigError,
} from "../lib/buchhaltungsbutler.js";
import { getBuchhaltungsButlerTransactions } from "../lib/buchhaltungsbutlerPostings.js";
import { DatabaseError } from "../lib/errors.js";
import {
	aggregateByAccount,
	buildAccountLabelRows,
	loadAccountLabels,
	upsertAccountLabel,
} from "../lib/financeAccounts.js";
import {
	computeBudgetVsActual,
	loadBudgets,
	upsertBudget,
} from "../lib/financeBudgets.js";
import {
	aggregateByCategory,
	buildCategoryMappingRows,
	loadCategoryMappings,
	upsertCategoryMapping,
} from "../lib/financeCategories.js";
import {
	aggregateByDepartment,
	buildMappingRows,
	loadDepartmentMappings,
	upsertDepartmentMapping,
} from "../lib/financeDepartments.js";
import { aggregateByVatRate } from "../lib/financeVat.js";
import {
	authenticate,
	requireReimbursementReviewer,
} from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

export async function financeRoutes(server: FastifyInstance) {
	server.get(
		"/finance/buchhaltungsbutler/transactions",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const parsed = BuchhaltungsButlerTransactionsQuerySchema.safeParse(
				request.query,
			);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid query",
					details: parsed.error.flatten(),
				});
			}

			try {
				const result = await getBuchhaltungsButlerTransactions(parsed.data);
				return BuchhaltungsButlerTransactionsResponseSchema.parse({
					...result,
					generated_at: new Date().toISOString(),
				});
			} catch (error) {
				return handleFinanceError(request, reply, error);
			}
		},
	);

	// LnF analytics: per-department / per-month / per-Bereich expense rollup.
	server.get(
		"/finance/analytics",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const parsed = BuchhaltungsButlerTransactionsQuerySchema.safeParse(
				request.query,
			);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid query",
					details: parsed.error.flatten(),
				});
			}

			try {
				const [
					{ transactions, source },
					mappings,
					categoryMappings,
					accountLabels,
				] = await Promise.all([
					getBuchhaltungsButlerTransactions(parsed.data),
					loadDepartmentMappings(),
					loadCategoryMappings(),
					loadAccountLabels(),
				]);
				return FinanceAnalyticsResponseSchema.parse({
					...aggregateByDepartment(transactions, mappings),
					by_category: aggregateByCategory(transactions, categoryMappings),
					by_account: aggregateByAccount(transactions, accountLabels),
					by_vat_rate: aggregateByVatRate(transactions),
					source,
					generated_at: new Date().toISOString(),
				});
			} catch (error) {
				return handleFinanceError(request, reply, error);
			}
		},
	);

	// Mapping editor: cost locations (stored + discovered from postings) plus
	// their assignment and usage stats.
	server.get(
		"/finance/department-mappings",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const parsed = BuchhaltungsButlerTransactionsQuerySchema.safeParse(
				request.query,
			);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid query",
					details: parsed.error.flatten(),
				});
			}

			try {
				const [{ transactions }, mappings] = await Promise.all([
					getBuchhaltungsButlerTransactions(parsed.data),
					loadDepartmentMappings(),
				]);
				return FinanceDepartmentMappingsResponseSchema.parse({
					rows: buildMappingRows(transactions, mappings),
					generated_at: new Date().toISOString(),
				});
			} catch (error) {
				return handleFinanceError(request, reply, error);
			}
		},
	);

	server.put(
		"/finance/department-mappings/:costLocation",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const costLocation = (
				request.params as { costLocation?: string }
			).costLocation?.trim();
			if (!costLocation) {
				return reply.status(400).send({ error: "Missing cost location" });
			}

			const parsed = FinanceDepartmentMappingUpsertSchema.safeParse(
				request.body,
			);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid mapping",
					details: parsed.error.flatten(),
				});
			}

			try {
				const mapping = await upsertDepartmentMapping({
					costLocation,
					department: parsed.data.department,
					bereich: parsed.data.bereich,
					note: parsed.data.note ?? null,
				});
				return mapping;
			} catch (error) {
				request.log.error(
					{ err: error, costLocation },
					"Failed to upsert finance department mapping",
				);
				throw new DatabaseError("Failed to save department mapping");
			}
		},
	);

	// Category editor: second cost locations (stored + discovered from postings)
	// plus their label and usage stats.
	server.get(
		"/finance/category-mappings",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const parsed = BuchhaltungsButlerTransactionsQuerySchema.safeParse(
				request.query,
			);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid query",
					details: parsed.error.flatten(),
				});
			}

			try {
				const [{ transactions }, categoryMappings] = await Promise.all([
					getBuchhaltungsButlerTransactions(parsed.data),
					loadCategoryMappings(),
				]);
				return FinanceCategoryMappingsResponseSchema.parse({
					rows: buildCategoryMappingRows(transactions, categoryMappings),
					generated_at: new Date().toISOString(),
				});
			} catch (error) {
				return handleFinanceError(request, reply, error);
			}
		},
	);

	server.put(
		"/finance/category-mappings/:costLocationTwo",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const costLocationTwo = (
				request.params as { costLocationTwo?: string }
			).costLocationTwo?.trim();
			if (!costLocationTwo) {
				return reply.status(400).send({ error: "Missing cost location" });
			}

			const parsed = FinanceCategoryMappingUpsertSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid mapping",
					details: parsed.error.flatten(),
				});
			}

			try {
				const mapping = await upsertCategoryMapping({
					costLocationTwo,
					label: parsed.data.label,
					note: parsed.data.note ?? null,
				});
				return mapping;
			} catch (error) {
				request.log.error(
					{ err: error, costLocationTwo },
					"Failed to upsert finance category mapping",
				);
				throw new DatabaseError("Failed to save category mapping");
			}
		},
	);

	// Account editor: ledger accounts (stored + discovered from postings) plus
	// their label and usage stats.
	server.get(
		"/finance/account-labels",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const parsed = BuchhaltungsButlerTransactionsQuerySchema.safeParse(
				request.query,
			);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid query",
					details: parsed.error.flatten(),
				});
			}

			try {
				const [{ transactions }, accountLabels] = await Promise.all([
					getBuchhaltungsButlerTransactions(parsed.data),
					loadAccountLabels(),
				]);
				return FinanceAccountLabelsResponseSchema.parse({
					rows: buildAccountLabelRows(transactions, accountLabels),
					generated_at: new Date().toISOString(),
				});
			} catch (error) {
				return handleFinanceError(request, reply, error);
			}
		},
	);

	server.put(
		"/finance/account-labels/:account",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const account = (request.params as { account?: string }).account?.trim();
			if (!account) {
				return reply.status(400).send({ error: "Missing account" });
			}

			const parsed = FinanceAccountLabelUpsertSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid label",
					details: parsed.error.flatten(),
				});
			}

			try {
				const label = await upsertAccountLabel({
					account,
					label: parsed.data.label,
					note: parsed.data.note ?? null,
				});
				return label;
			} catch (error) {
				request.log.error(
					{ err: error, account },
					"Failed to upsert finance account label",
				);
				throw new DatabaseError("Failed to save account label");
			}
		},
	);

	// Budgets: per-department ceilings for a fiscal period, joined to the actual
	// (gross) expenses in that period so LnF sees budget vs. actual.
	server.get(
		"/finance/budgets",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const parsed = FinanceBudgetQuerySchema.safeParse(request.query);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid query",
					details: parsed.error.flatten(),
				});
			}

			const { period_type, period_key } = parsed.data;
			const range = resolveFinancePeriodRange(period_type, period_key);

			try {
				const [{ transactions, source }, mappings, budgets] = await Promise.all(
					[
						getBuchhaltungsButlerTransactions({
							date_from: range.dateFrom,
							date_to: range.dateTo,
						}),
						loadDepartmentMappings(),
						loadBudgets(period_type, period_key),
					],
				);
				const { by_department } = aggregateByDepartment(transactions, mappings);
				const { rows, totals } = computeBudgetVsActual(by_department, budgets);
				return FinanceBudgetVsActualResponseSchema.parse({
					period_type,
					period_key,
					rows,
					totals,
					source,
					generated_at: new Date().toISOString(),
				});
			} catch (error) {
				return handleFinanceError(request, reply, error);
			}
		},
	);

	server.put(
		"/finance/budgets",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const parsed = FinanceBudgetUpsertSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid budget",
					details: parsed.error.flatten(),
				});
			}

			const userId = (request as AuthenticatedRequest).user.id;

			try {
				const budget = await upsertBudget({
					department: parsed.data.department,
					periodType: parsed.data.period_type,
					periodKey: parsed.data.period_key,
					amountPlanned: parsed.data.amount_planned,
					note: parsed.data.note ?? null,
					setBy: userId,
				});
				return budget;
			} catch (error) {
				request.log.error(
					{ err: error, department: parsed.data.department },
					"Failed to upsert finance budget",
				);
				throw new DatabaseError("Failed to save budget");
			}
		},
	);
}

function handleFinanceError(
	request: FastifyRequest,
	reply: FastifyReply,
	error: unknown,
): unknown {
	if (error instanceof BuchhaltungsButlerConfigError) {
		return reply.status(503).send({ error: error.message });
	}

	if (error instanceof BuchhaltungsButlerApiError) {
		request.log.warn(
			{ err: error, statusCode: error.statusCode },
			"BuchhaltungsButler postings request failed",
		);
		return reply
			.status(502)
			.send({ error: "BuchhaltungsButler postings request failed" });
	}

	request.log.error({ err: error }, "Failed to load finance data");
	throw new DatabaseError("Failed to load finance data");
}
