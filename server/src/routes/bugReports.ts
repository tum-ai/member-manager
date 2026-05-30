import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
	decodeBugReportImage,
	deleteBugReportImage,
	MAX_BUG_REPORT_IMAGE_BASE64_CHARS,
	type UploadedBugReportImage,
	uploadBugReportImage,
} from "../lib/bugReportImages.js";
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
	image: z
		.object({
			dataBase64: z.string().min(1).max(MAX_BUG_REPORT_IMAGE_BASE64_CHARS),
		})
		.optional(),
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

			// Decode/validate up front so a malformed image fails the request (400
			// via decodeBugReportImage's ValidationError). The upload itself is
			// best-effort: if storage is unavailable we still file the report
			// rather than losing the user's message.
			let uploadedImage: UploadedBugReportImage | undefined;
			if (parsed.image) {
				const image = decodeBugReportImage(parsed.image.dataBase64);
				try {
					uploadedImage = await uploadBugReportImage(image);
				} catch (error) {
					request.log.error(
						{ err: error, userId: user.id },
						"Failed to upload bug report image; submitting without it",
					);
				}
			}

			const bugReport = {
				reporterUserId: user.id,
				reporterEmail: user.email ?? "",
				message: parsed.message,
				stepsToReproduce: parsed.stepsToReproduce,
				pageUrl: parsed.pageUrl || parsed.path,
				userAgent,
				imageUrl: uploadedImage?.url,
			};

			let issue: Awaited<ReturnType<typeof createBugReportIssue>>;
			try {
				issue = await createBugReportIssue(bugReport);
			} catch (error) {
				request.log.error(
					{ err: error, userId: user.id },
					"Failed to create GitHub issue for bug report",
				);
				// The screenshot we just uploaded is now orphaned (public, UUID-only,
				// referenced by no issue). Best-effort remove it so failed/retried
				// submissions don't leave accessible objects behind.
				if (uploadedImage) {
					try {
						await deleteBugReportImage(uploadedImage.path);
					} catch (deleteError) {
						request.log.error(
							{ err: deleteError, userId: user.id },
							"Failed to remove orphaned bug report image after issue creation failed",
						);
					}
				}
				return reply.status(502).send({
					error:
						"Could not submit bug report right now. Please try again later.",
				});
			}

			try {
				await notifyBugReport({
					issueNumber: issue.number,
					issueUrl: issue.url,
					issueTitle: issue.title,
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
