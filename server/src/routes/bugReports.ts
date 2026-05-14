import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { notifyBugReport } from "../lib/slackNotifier.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const BugReportSchema = z.object({
	message: z.string().trim().min(5).max(2000),
	stepsToReproduce: z.string().trim().max(2000).optional(),
	pageUrl: z.string().trim().max(2048).optional(),
	path: z.string().trim().max(512).optional(),
	userAgent: z.string().trim().max(512).optional(),
});

function firstHeaderValue(value: string | string[] | undefined): string {
	return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function bugReportRoutes(server: FastifyInstance) {
	server.post(
		"/bug-reports",
		{ preHandler: authenticate },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const parsed = BugReportSchema.parse(request.body);
			const userAgent =
				parsed.userAgent || firstHeaderValue(request.headers["user-agent"]);

			try {
				await notifyBugReport({
					reporterUserId: user.id,
					reporterEmail: user.email ?? "",
					message: parsed.message,
					stepsToReproduce: parsed.stepsToReproduce,
					pageUrl: parsed.pageUrl || parsed.path,
					userAgent,
				});
			} catch (error) {
				request.log.error(
					{ err: error, userId: user.id },
					"Failed to send bug report to Slack",
				);
				return reply.status(502).send({
					error:
						"Could not submit bug report right now. Please try again later.",
				});
			}

			return reply.status(202).send({ ok: true });
		},
	);
}
