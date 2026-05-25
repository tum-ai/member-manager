import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createBugReportIssue } from "../lib/githubIssues.js";
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

			const bugReport = {
				reporterUserId: user.id,
				reporterEmail: user.email ?? "",
				message: parsed.message,
				stepsToReproduce: parsed.stepsToReproduce,
				pageUrl: parsed.pageUrl || parsed.path,
				userAgent,
			};

			let issue: Awaited<ReturnType<typeof createBugReportIssue>>;
			try {
				issue = await createBugReportIssue(bugReport);
			} catch (error) {
				request.log.error(
					{ err: error, userId: user.id },
					"Failed to create GitHub issue for bug report",
				);
				return reply.status(502).send({
					error:
						"Could not submit bug report right now. Please try again later.",
				});
			}

			if (issue.assignmentError) {
				request.log.error(
					{
						assignmentError: issue.assignmentError,
						issueNumber: issue.number,
						userId: user.id,
					},
					"Failed to assign GitHub issue for bug report",
				);
			}

			try {
				await notifyBugReport({
					issueNumber: issue.number,
					issueUrl: issue.url,
					issueTitle: issue.title,
					assigneeSlackId: issue.assignee?.slackId,
					assigneeGithubUsername: issue.assignee?.githubUsername,
				});
			} catch (error) {
				request.log.error(
					{ err: error, issueNumber: issue.number, userId: user.id },
					"Failed to send bug report Slack notification",
				);
			}

			return reply.status(202).send({ ok: true });
		},
	);
}
