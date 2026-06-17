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
import { isUrlAllowed } from "../lib/ssrfGuard.js";
import { getSupabase } from "../lib/supabase.js";
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
	trigger_id?: string;
	view?: {
		callback_id?: string;
		private_metadata?: string;
		state?: {
			values?: Record<string, Record<string, { value?: string }>>;
		};
	};
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
		request.log.warn("SLACK_SIGNING_SECRET is not set or empty");
		return false;
	}

	const timestamp = getHeaderValue(
		request.headers["x-slack-request-timestamp"],
	);
	const signature = getHeaderValue(request.headers["x-slack-signature"]);
	const timestampSeconds = Number.parseInt(timestamp, 10);

	if (!timestampSeconds || !signature) {
		request.log.warn(
			{ timestamp, signature },
			"Slack signature verification failed: missing timestamp or signature headers",
		);
		return false;
	}
	const timeDiff = Math.abs(Date.now() / 1000 - timestampSeconds);
	if (timeDiff > SLACK_MAX_REQUEST_AGE_SECONDS) {
		request.log.warn(
			{ timeDiff, timestampSeconds, now: Date.now() / 1000 },
			"Slack signature verification failed: timestamp is too old",
		);
		return false;
	}

	const baseString = `${SLACK_SIGNATURE_VERSION}:${timestamp}:${rawBody}`;
	const expected = `${SLACK_SIGNATURE_VERSION}=${createHmac(
		"sha256",
		signingSecret,
	)
		.update(baseString)
		.digest("hex")}`;

	const matches = safeCompare(expected, signature);
	if (!matches) {
		request.log.warn(
			{
				expectedSignature: expected,
				receivedSignature: signature,
				baseStringLength: baseString.length,
				secretLength: signingSecret.length,
			},
			"Slack signature verification failed: signature mismatch",
		);
	}
	return matches;
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

// `response_url` arrives inside the (signature-verified) Slack payload, but the
// value itself is still attacker-influenced, so treat it as tainted and pin the
// host to Slack before fetching — closes the SSRF vector.
const ALLOWED_SLACK_RESPONSE_HOSTS = ["hooks.slack.com"];
const ALLOWED_SLACK_RESPONSE_HOST_SUFFIXES = [".slack.com"];

async function postSlackDelayedResponse(
	responseUrl: string | undefined,
	text: string,
): Promise<void> {
	if (!responseUrl) {
		return;
	}

	if (
		!isUrlAllowed(responseUrl, {
			allowedHosts: ALLOWED_SLACK_RESPONSE_HOSTS,
			allowedHostSuffixes: ALLOWED_SLACK_RESPONSE_HOST_SUFFIXES,
		})
	) {
		throw new Error("Slack response_url host is not allowed");
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

async function resolveUserFromSlackId(slackUserId: string): Promise<string> {
	const email = await getSlackUserEmailById(slackUserId);
	const userId = email ? await getAuthUserIdByEmail(email) : null;

	if (!userId) {
		throw new Error("Slack user is not linked to Member Manager");
	}
	return userId;
}

async function slackApiPost(
	path: string,
	payload: Record<string, unknown>,
): Promise<void> {
	const token = process.env.SLACK_BOT_TOKEN;
	if (!token) {
		throw new Error("SLACK_BOT_TOKEN is not configured");
	}

	const response = await fetchWithTimeout(`https://slack.com/api${path}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"content-type": "application/json; charset=utf-8",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`Slack API ${path} failed with ${response.status}`);
	}

	const json = (await response.json()) as { ok?: boolean; error?: string };
	if (!json.ok) {
		throw new Error(`Slack API error for ${path}: ${json.error}`);
	}
}

export async function slackInteractionRoutes(server: FastifyInstance) {
	server.addContentTypeParser(
		"application/x-www-form-urlencoded",
		{ parseAs: "string" },
		(_request, body, done) => done(null, body),
	);

	server.post(
		"/slack/interactions",
		{ config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
		async (request, reply) => {
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

			const slackUserId = payload.user?.id ?? "";

			// Handle View Submissions (Modals)
			if (payload.type === "view_submission") {
				const callbackId = payload.view?.callback_id ?? "";
				if (callbackId === "tumai_day_rsvp_reason_modal") {
					const rawMetadata = payload.view?.private_metadata;
					const privateMetadata = rawMetadata
						? (JSON.parse(rawMetadata) as {
								tumai_day_id: string;
								response_url: string;
							})
						: null;

					if (!privateMetadata || !slackUserId) {
						return reply.status(400).send({ error: "Missing metadata" });
					}

					// Look up entered reason
					const reason =
						payload.view?.state?.values?.reason_block?.reason_input?.value ??
						null;

					try {
						const userId = await resolveUserFromSlackId(slackUserId);
						const { error } = await getSupabase()
							.from("tumai_day_responses")
							.upsert(
								{
									tumai_day_id: privateMetadata.tumai_day_id,
									user_id: userId,
									status: "no",
									reason: reason || null,
									updated_at: new Date().toISOString(),
								},
								{ onConflict: "tumai_day_id,user_id" },
							);
						if (error) throw error;

						const confirmationText = reason
							? `Thank you! You RSVP'd: *No* (Reason: ${reason}).`
							: "Thank you! You RSVP'd: *No*.";

						await postSlackDelayedResponse(
							privateMetadata.response_url,
							confirmationText,
						);
					} catch (error) {
						request.log.error(
							{ err: error, tumaiDayId: privateMetadata.tumai_day_id },
							"Failed to save TUM.ai Day No response from modal",
						);
						try {
							await postSlackDelayedResponse(
								privateMetadata.response_url,
								`RSVP failed: ${error instanceof Error ? error.message : "unknown error"}`,
							);
						} catch (err) {
							request.log.error(
								{ err },
								"Failed to send error notification back to Slack",
							);
						}
					}

					return reply.status(200).send({});
				}
			}

			// Handle Interactive Components (Buttons)
			const action = payload.actions?.[0];
			const actionId = action?.action_id ?? "";
			const requestId = action?.value ?? "";

			if (actionId === "tumai_day_rsvp_yes") {
				if (!requestId || !slackUserId) {
					return sendSlackMessage(
						reply,
						"Slack action payload is missing data.",
					);
				}

				// Handled inline (not after the reply): on serverless the function can
				// be frozen once the response is sent, so the write must finish first.
				try {
					const userId = await resolveUserFromSlackId(slackUserId);
					const { error } = await getSupabase()
						.from("tumai_day_responses")
						.upsert(
							{
								tumai_day_id: requestId,
								user_id: userId,
								status: "yes",
								reason: null,
								updated_at: new Date().toISOString(),
							},
							{ onConflict: "tumai_day_id,user_id" },
						);
					if (error) throw error;

					await postSlackDelayedResponse(
						payload.response_url,
						"Thank you! You RSVP'd: *Yes*.",
					);
				} catch (error) {
					request.log.error(
						{ err: error, tumaiDayId: requestId },
						"Failed to save TUM.ai Day Yes response",
					);
					try {
						await postSlackDelayedResponse(
							payload.response_url,
							`RSVP failed: ${error instanceof Error ? error.message : "unknown error"}`,
						);
					} catch (err) {
						request.log.error(
							{ err },
							"Failed to send error notification back to Slack",
						);
					}
				}

				return reply.status(200).send();
			}

			if (actionId === "tumai_day_rsvp_no") {
				if (!requestId || !slackUserId) {
					return sendSlackMessage(
						reply,
						"Slack action payload is missing data.",
					);
				}

				// Opened inline: the trigger_id expires 3 seconds after the click, and
				// on serverless the function can be frozen once the response is sent.
				try {
					await slackApiPost("/views.open", {
						trigger_id: payload.trigger_id,
						view: {
							type: "modal",
							callback_id: "tumai_day_rsvp_reason_modal",
							private_metadata: JSON.stringify({
								tumai_day_id: requestId,
								response_url: payload.response_url,
							}),
							title: {
								type: "plain_text",
								text: "RSVP: No",
							},
							submit: {
								type: "plain_text",
								text: "Submit",
							},
							close: {
								type: "plain_text",
								text: "Cancel",
							},
							blocks: [
								{
									type: "section",
									text: {
										type: "mrkdwn",
										text: "Please let us know why you won't be able to make it (optional):",
									},
								},
								{
									type: "input",
									block_id: "reason_block",
									optional: true,
									element: {
										type: "plain_text_input",
										action_id: "reason_input",
										placeholder: {
											type: "plain_text",
											text: "e.g., prior engagement, exams, out of town...",
										},
									},
									label: {
										type: "plain_text",
										text: "Reason",
									},
								},
							],
						},
					});
				} catch (error) {
					request.log.error(
						{ err: error, tumaiDayId: requestId },
						"Failed to open Slack modal",
					);
					try {
						await postSlackDelayedResponse(
							payload.response_url,
							`Failed to open RSVP modal: ${error instanceof Error ? error.message : "unknown error"}`,
						);
					} catch (err) {
						request.log.error(
							{ err },
							"Failed to send error notification back to Slack",
						);
					}
				}

				return reply.status(200).send();
			}

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
		},
	);
}
