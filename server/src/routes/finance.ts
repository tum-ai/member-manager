import {
	BuchhaltungsButlerTransactionsQuerySchema,
	BuchhaltungsButlerTransactionsResponseSchema,
	FinanceAnalyticsResponseSchema,
	FinanceDepartmentMappingsResponseSchema,
	FinanceDepartmentMappingUpsertSchema,
} from "@member-manager/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
	BuchhaltungsButlerApiError,
	BuchhaltungsButlerConfigError,
} from "../lib/buchhaltungsbutler.js";
import { getBuchhaltungsButlerTransactions } from "../lib/buchhaltungsbutlerPostings.js";
import { DatabaseError } from "../lib/errors.js";
import {
	aggregateByDepartment,
	buildMappingRows,
	loadDepartmentMappings,
	upsertDepartmentMapping,
} from "../lib/financeDepartments.js";
import {
	authenticate,
	requireReimbursementReviewer,
} from "../middleware/auth.js";

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
				const [{ transactions, source }, mappings] = await Promise.all([
					getBuchhaltungsButlerTransactions(parsed.data),
					loadDepartmentMappings(),
				]);
				return FinanceAnalyticsResponseSchema.parse({
					...aggregateByDepartment(transactions, mappings),
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
