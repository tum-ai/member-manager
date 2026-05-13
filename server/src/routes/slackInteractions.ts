import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { checkReimbursementReviewer } from "../lib/auth.js";
import { getAuthUserIdByEmail } from "../lib/authEmails.js";
import {
	BuchhaltungsButlerApiError,
	BuchhaltungsButlerConfigError,
} from "../lib/buchhaltungsbutler.js";
import { fetchWithTimeout } from "../lib/fetchWithTimeout.js";
import { getSlackUserEmailById } from "../lib/slackNotifier.js";
import {
	approveReimbursementRequest,
	ReimbursementWorkflowError,
	syncApprovedReimbursementToBuchhaltungsButler,
} from "./reimbursements.js";

const SLACK_SIGNATURE_VERSION = "v0";
const SLACK_MAX_REQUEST_AGE_SECONDS = 60 * 5;

interface SlackInteractionPayload {
	type?: string;
	user?: { id?: string };
	response_url?: string;
	actions?: Array<{ action_id?: string; value?: string }>;
}

function getHeaderValue(value: string | string[] | undefined): string {
	return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function safeCompare(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left, "utf8");
	const rightBuffer = Buffer.from(right, "utf8");
	return (
		leftBuffer.length === rightBuffer.length &&
		timingSafeEqual(leftBuffer, rightBuffer)
	);
}

function verifySlackSignature(
	request: FastifyRequest,
	rawBody: string,
): boolean {
	const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();
	if (!signingSecret) {
		return false;
	}

	const timestamp = getHeaderValue(
		request.headers["x-slack-request-timestamp"],
	);
	const signature = getHeaderValue(request.headers["x-slack-signature"]);
	const timestampSeconds = Number.parseInt(timestamp, 10);

	if (!timestampSeconds || !signature) {
		return false;
	}
	if (
		Math.abs(Date.now() / 1000 - timestampSeconds) >
		SLACK_MAX_REQUEST_AGE_SECONDS
	) {
		return false;
	}

	const baseString = `${SLACK_SIGNATURE_VERSION}:${timestamp}:${rawBody}`;
	const expected = `${SLACK_SIGNATURE_VERSION}=${createHmac(
		"sha256",
		signingSecret,
	)
		.update(baseString)
		.digest("hex")}`;

	return safeCompare(expected, signature);
}

function parseSlackPayload(rawBody: string): SlackInteractionPayload {
	const encodedPayload = new URLSearchParams(rawBody).get("payload");
	if (!encodedPayload) {
		throw new Error("Missing Slack payload");
	}
	return JSON.parse(encodedPayload) as SlackInteractionPayload;
}

async function resolveReviewerUserId(slackUserId: string): Promise<string> {
	const email = await getSlackUserEmailById(slackUserId);
	const userId = email ? await getAuthUserIdByEmail(email) : null;

	if (!userId) {
		throw new ReimbursementWorkflowError(
			"Slack user is not linked to Member Manager",
			403,
		);
	}

	const canReview = await checkReimbursementReviewer(userId);
	if (!canReview) {
		throw new ReimbursementWorkflowError("Finance review access required", 403);
	}

	return userId;
}

function sendSlackMessage(reply: FastifyReply, text: string, statusCode = 200) {
	return reply.status(statusCode).send({
		response_type: "ephemeral",
		replace_original: false,
		text,
	});
}

function actionLabel(actionId: string): string {
	if (actionId === "reimbursement_approve_sync_bb") {
		return "approved and synced to BuchhaltungsButler";
	}
	return "approved";
}

async function handleReimbursementAction({
	actionId,
	requestId,
	reviewerUserId,
	request,
}: {
	actionId: string;
	requestId: string;
	reviewerUserId: string;
	request: FastifyRequest;
}): Promise<string> {
	await approveReimbursementRequest({ requestId, log: request.log });

	if (actionId === "reimbursement_approve_sync_bb") {
		await syncApprovedReimbursementToBuchhaltungsButler({
			requestId,
			reviewerUserId,
			log: request.log,
		});
	}

	return `Request ${requestId} ${actionLabel(actionId)}.`;
}

function slackActionErrorMessage(error: unknown): string {
	if (error instanceof ReimbursementWorkflowError) {
		return error.message;
	}
	if (error instanceof BuchhaltungsButlerConfigError) {
		return `Approved, but sync failed: ${error.message}`;
	}
	if (error instanceof BuchhaltungsButlerApiError) {
		return `Approved, but sync failed: ${error.message}`;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return "Slack action failed";
}

async function postSlackDelayedResponse(
	responseUrl: string | undefined,
	text: string,
): Promise<void> {
	if (!responseUrl) {
		return;
	}

	const response = await fetchWithTimeout(responseUrl, {
		method: "POST",
		headers: { "content-type": "application/json; charset=utf-8" },
		body: JSON.stringify({
			response_type: "ephemeral",
			replace_original: false,
			text,
		}),
	});

	if (!response.ok) {
		throw new Error(`Slack delayed response failed with ${response.status}`);
	}
}

function queueSlackReimbursementAction({
	actionId,
	requestId,
	slackUserId,
	responseUrl,
	request,
}: {
	actionId: string;
	requestId: string;
	slackUserId: string;
	responseUrl?: string;
	request: FastifyRequest;
}): void {
	setImmediate(() => {
		void (async () => {
			try {
				const reviewerUserId = await resolveReviewerUserId(slackUserId);
				const message = await handleReimbursementAction({
					actionId,
					requestId,
					reviewerUserId,
					request,
				});
				await postSlackDelayedResponse(responseUrl, message);
			} catch (error) {
				request.log.warn(
					{ err: error, actionId, requestId },
					"Slack action failed",
				);
				try {
					await postSlackDelayedResponse(
						responseUrl,
						slackActionErrorMessage(error),
					);
				} catch (postError) {
					request.log.warn(
						{ err: postError, actionId, requestId },
						"Slack delayed response failed",
					);
				}
			}
		})();
	});
}

export async function slackInteractionRoutes(server: FastifyInstance) {
	server.addContentTypeParser(
		"application/x-www-form-urlencoded",
		{ parseAs: "string" },
		(_request, body, done) => done(null, body),
	);

	server.post("/slack/interactions", async (request, reply) => {
		const rawBody = typeof request.body === "string" ? request.body : "";
		if (!verifySlackSignature(request, rawBody)) {
			return reply.status(401).send({ error: "Invalid Slack signature" });
		}

		let payload: SlackInteractionPayload;
		try {
			payload = parseSlackPayload(rawBody);
		} catch {
			return reply.status(400).send({ error: "Invalid Slack payload" });
		}

		const action = payload.actions?.[0];
		const actionId = action?.action_id ?? "";
		const requestId = action?.value ?? "";
		const slackUserId = payload.user?.id ?? "";

		if (
			actionId !== "reimbursement_approve" &&
			actionId !== "reimbursement_approve_sync_bb"
		) {
			return sendSlackMessage(reply, "Action acknowledged.");
		}
		if (!requestId || !slackUserId) {
			return sendSlackMessage(reply, "Slack action payload is missing data.");
		}

		queueSlackReimbursementAction({
			actionId,
			requestId,
			slackUserId,
			responseUrl: payload.response_url,
			request,
		});

		return sendSlackMessage(
			reply,
			"Processing reimbursement action. Slack will post the result shortly.",
		);
	});
}
