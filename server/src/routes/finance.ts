import {
	BuchhaltungsButlerTransactionsQuerySchema,
	BuchhaltungsButlerTransactionsResponseSchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import {
	BuchhaltungsButlerApiError,
	BuchhaltungsButlerConfigError,
} from "../lib/buchhaltungsbutler.js";
import { getBuchhaltungsButlerTransactions } from "../lib/buchhaltungsbutlerPostings.js";
import { DatabaseError } from "../lib/errors.js";
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

				request.log.error(
					{ err: error },
					"Failed to load BuchhaltungsButler transactions",
				);
				throw new DatabaseError("Failed to load finance transactions");
			}
		},
	);
}
