import type { FastifyInstance } from "fastify";
import { renderDocumentPages } from "../../lib/contracts/contractDocument.js";
import {
	buildSignatureImages,
	sendPdf,
} from "../../lib/contracts/contractPdf.js";
import {
	buildFinalPdfText,
	buildPublicCommentHistory,
	getPartnerCompanyNameFromSubmission,
	getPartnerEmailFromSubmission,
	textFromSubmission,
} from "../../lib/contracts/contractRecords.js";
import {
	completeSubmission,
	maybeAutoSendAfterBoardSign,
	prepareFinalDocument,
} from "../../lib/contracts/contractFinalization.js";
import {
	createContractDatabaseError,
	createSubmissionComment,
	fetchDocumentVersion,
	fetchSubmissionComments,
} from "../../lib/contracts/contractRepository.js";
import {
	CommentBodySchema,
	OpenSignWebhookSchema,
	PdfDownloadQuerySchema,
	SignBodySchema,
} from "../../lib/contracts/contractSchemas.js";
import {
	isOpenSignCompletedEvent,
	isOpenSignFailureEvent,
	verifyOpenSignWebhookSignature,
} from "../../lib/contracts/contractSecurity.js";
import {
	getMemberDisplayName,
	recordAndNotifyTransition,
} from "../../lib/contracts/contractWorkflow.js";
import { createTextPdf } from "../../lib/simplePdf.js";
import { getSupabase } from "../../lib/supabase.js";
import {
	authenticate,
	requireBoardMember,
	requireContractsAdmin,
} from "../../middleware/auth.js";
import type { AuthenticatedRequest } from "../../types/index.js";

export async function contractSigningRoutes(server: FastifyInstance) {
	server.post("/webhooks/opensign", async (request, reply) => {
		if (
			!verifyOpenSignWebhookSignature(
				request.body,
				request.headers["x-webhook-signature"],
			)
		) {
			return reply.status(401).send({ error: "Invalid webhook signature" });
		}

		const body = OpenSignWebhookSchema.parse(request.body);
		if (!body.objectId) {
			return reply.status(400).send({ error: "Missing OpenSign document id" });
		}

		const event = body.event ?? "unknown";
		const nowIso = new Date().toISOString();
		const { data: current, error: currentError } = await getSupabase()
			.from("contract_submissions")
			.select("id, status")
			.eq("opensign_document_id", body.objectId)
			.maybeSingle();
		if (currentError) {
			request.log.error(
				{ err: currentError },
				"Failed to fetch OpenSign webhook submission",
			);
			throw createContractDatabaseError(currentError);
		}
		if (!current) {
			request.log.warn(
				{ openSignDocumentId: body.objectId, event },
				"OpenSign webhook did not match a contract submission",
			);
			return { ok: true };
		}

		const update: Record<string, unknown> = {
			opensign_status: event,
			opensign_webhook_last_event: event,
			opensign_webhook_received_at: nowIso,
			updated_at: nowIso,
		};
		if (body.file) update.opensign_file_url = body.file;
		const certificateUrl = body.certificateUrl ?? body.certificate;
		if (certificateUrl) update.opensign_certificate_url = certificateUrl;

		const canApplyOpenSignStatus = current.status === "sent_to_partner";
		if (canApplyOpenSignStatus && isOpenSignCompletedEvent(event)) {
			update.status = "partner_signed";
			update.signed_at = nowIso;
			update.signer_name = "OpenSign";
			update.opensign_completed_at = nowIso;
			update.opensign_error = null;
		} else if (canApplyOpenSignStatus && isOpenSignFailureEvent(event)) {
			update.status = "partner_comments";
			update.opensign_error = `OpenSign document ${event}`;
		}

		const { error } = await getSupabase()
			.from("contract_submissions")
			.update(update)
			.eq("id", current.id)
			.select("id, status, opensign_status")
			.maybeSingle();
		if (error) {
			request.log.error({ err: error }, "Failed to process OpenSign webhook");
			throw createContractDatabaseError(error);
		}

		if (typeof update.status === "string" && update.status !== current.status) {
			await recordAndNotifyTransition({
				request,
				submissionId: String(current.id),
				fromStatus: current.status,
				toStatus: update.status,
				changedBy: null,
				changedByName: "OpenSign",
			});
		}

		return { ok: true };
	});

	// ---------------------------------------------------------------------
	// Public signing endpoints (no auth). Verified by signature_token only.
	// ---------------------------------------------------------------------

	server.get<{ Params: { token: string } }>(
		"/contracts/sign/:token",
		async (request, reply) => {
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, status, admin_edited_text, generated_contract_text, sent_document_version_id, signature_token_expires_at, signed_at, partner_comment, partner_commented_at, form_data, submitted_at, updated_at",
				)
				.eq("signature_token", request.params.token)
				.maybeSingle();

			if (error) {
				request.log.error({ err: error }, "Failed to fetch signing payload");
				throw createContractDatabaseError(error);
			}
			if (!data) {
				return reply.status(404).send({ error: "Invalid signing link" });
			}
			if (
				data.signature_token_expires_at &&
				new Date(data.signature_token_expires_at).getTime() < Date.now()
			) {
				return reply.status(410).send({ error: "Signing link expired" });
			}
			if (data.signed_at) {
				return reply.status(409).send({ error: "Contract already signed" });
			}

			const sentVersion = await fetchDocumentVersion(
				(data as Record<string, unknown>).sent_document_version_id,
			);
			const contractText =
				typeof sentVersion?.rendered_text === "string"
					? sentVersion.rendered_text
					: textFromSubmission(data as Record<string, unknown>);
			const pages = renderDocumentPages(contractText);
			const comments = await fetchSubmissionComments(String(data.id));
			const publicComments = buildPublicCommentHistory(
				data as Record<string, unknown>,
				comments,
			);

			return {
				contract_text: contractText,
				html:
					typeof sentVersion?.rendered_html === "string"
						? sentVersion.rendered_html
						: pages.map((page) => `<section>${page}</section>`).join(""),
				pages,
				status: data.status,
				comments: publicComments,
			};
		},
	);

	// ---------------------------------------------------------------------
	// Nr.5: Public board-signing endpoints (no auth). Verified by
	// board_signature_token only — the tokenized link is the authorization
	// boundary, mirroring the partner signing flow.
	// ---------------------------------------------------------------------

	server.get<{ Params: { token: string } }>(
		"/contracts/board-sign/:token",
		async (request, reply) => {
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, status, admin_edited_text, generated_contract_text, active_document_version_id, sent_document_version_id, board_signature_token_expires_at, signer_name, signature_data, signed_at, admin_signed_at, form_data, submitted_at, updated_at",
				)
				.eq("board_signature_token", request.params.token)
				.maybeSingle();

			if (error) {
				request.log.error({ err: error }, "Failed to fetch board sign payload");
				throw createContractDatabaseError(error);
			}
			if (!data) {
				return reply.status(404).send({ error: "Invalid board signing link" });
			}
			if (
				data.board_signature_token_expires_at &&
				new Date(data.board_signature_token_expires_at).getTime() < Date.now()
			) {
				return reply.status(410).send({ error: "Board signing link expired" });
			}
			if (data.admin_signed_at || data.status !== "partner_signed") {
				return reply
					.status(409)
					.send({ error: "Contract is not awaiting a board signature" });
			}

			const record = data as Record<string, unknown>;
			const version = await fetchDocumentVersion(
				record.active_document_version_id ?? record.sent_document_version_id,
			);
			const contractText =
				typeof version?.rendered_text === "string"
					? version.rendered_text
					: textFromSubmission(record);
			const pages = renderDocumentPages(contractText);

			return {
				contract_text: contractText,
				html:
					typeof version?.rendered_html === "string"
						? version.rendered_html
						: pages.map((page) => `<section>${page}</section>`).join(""),
				pages,
				status: data.status,
				partner_signer_name: data.signer_name ?? null,
				partner_signature_data: data.signature_data ?? null,
				partner_signed_at: data.signed_at ?? null,
			};
		},
	);

	server.post<{ Params: { token: string } }>(
		"/contracts/board-sign/:token",
		async (request, reply) => {
			const body = SignBodySchema.parse(request.body);

			const { data: submission, error: fetchError } = await getSupabase()
				.from("contract_submissions")
				.select("id, status, board_signature_token_expires_at, admin_signed_at")
				.eq("board_signature_token", request.params.token)
				.maybeSingle();

			if (fetchError) {
				request.log.error(
					{ err: fetchError },
					"Failed to load submission for board sign",
				);
				throw createContractDatabaseError(fetchError);
			}
			if (!submission) {
				return reply.status(404).send({ error: "Invalid board signing link" });
			}
			if (
				submission.board_signature_token_expires_at &&
				new Date(submission.board_signature_token_expires_at).getTime() <
					Date.now()
			) {
				return reply.status(410).send({ error: "Board signing link expired" });
			}
			if (
				submission.admin_signed_at ||
				submission.status !== "partner_signed"
			) {
				return reply
					.status(409)
					.send({ error: "Contract is not awaiting a board signature" });
			}

			const nowIso = new Date().toISOString();
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update({
					admin_signature_data: body.signature_data,
					admin_signer_name: body.signer_name,
					admin_signed_at: nowIso,
					status: "board_signed",
					board_signature_token: null,
					board_signature_token_expires_at: null,
					updated_at: nowIso,
				})
				.eq("id", submission.id)
				.select("id, status, admin_signed_at")
				.single();
			if (error) {
				request.log.error(
					{ err: error },
					"Failed to record board signature via link",
				);
				throw createContractDatabaseError(error);
			}

			await recordAndNotifyTransition({
				request,
				submissionId: String(submission.id),
				fromStatus: "partner_signed",
				toStatus: "board_signed",
				changedBy: null,
				changedByName: body.signer_name,
			});
			await maybeAutoSendAfterBoardSign({
				request,
				submissionId: String(submission.id),
			});
			return data;
		},
	);

	server.post<{ Params: { token: string } }>(
		"/contracts/sign/:token/comment",
		async (request, reply) => {
			const body = CommentBodySchema.parse(request.body);

			const { data: submission, error: fetchError } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, status, signature_token_expires_at, signed_at, sent_document_version_id, form_data",
				)
				.eq("signature_token", request.params.token)
				.maybeSingle();

			if (fetchError) {
				request.log.error(
					{ err: fetchError },
					"Failed to load submission for comment",
				);
				throw createContractDatabaseError(fetchError);
			}
			if (!submission) {
				return reply.status(404).send({ error: "Invalid signing link" });
			}
			if (
				submission.signature_token_expires_at &&
				new Date(submission.signature_token_expires_at).getTime() < Date.now()
			) {
				return reply.status(410).send({ error: "Signing link expired" });
			}
			if (submission.signed_at || submission.status !== "sent_to_partner") {
				return reply
					.status(409)
					.send({ error: "Contract is not awaiting partner comments" });
			}

			const nowIso = new Date().toISOString();
			try {
				await createSubmissionComment({
					submissionId: String(submission.id),
					authorType: "partner",
					authorName:
						getPartnerCompanyNameFromSubmission(
							submission as Record<string, unknown>,
						) || "Partner",
					authorEmail: getPartnerEmailFromSubmission(
						submission as Record<string, unknown>,
					),
					comment: body.comment,
					documentVersionId:
						typeof submission.sent_document_version_id === "string"
							? submission.sent_document_version_id
							: null,
				});
			} catch (error) {
				request.log.error({ err: error }, "Failed to create partner comment");
				throw createContractDatabaseError(error);
			}
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update({
					partner_comment: body.comment,
					partner_commented_at: nowIso,
					status: "partner_comments",
					signature_token: null,
					signature_token_expires_at: null,
					updated_at: nowIso,
				})
				.eq("id", submission.id)
				.select("id, status, partner_comment, partner_commented_at")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to record partner comment");
				throw createContractDatabaseError(error);
			}

			await recordAndNotifyTransition({
				request,
				submissionId: String(submission.id),
				fromStatus: "sent_to_partner",
				toStatus: "partner_comments",
				changedBy: null,
				changedByName:
					getPartnerCompanyNameFromSubmission(
						submission as Record<string, unknown>,
					) || "Partner",
				note: body.comment,
			});
			return data;
		},
	);

	// State machine for signing: approved → (generate token) → sent_to_partner → (partner signs) → partner_signed
	server.post<{ Params: { token: string } }>(
		"/contracts/sign/:token",
		async (request, reply) => {
			const body = SignBodySchema.parse(request.body);

			const { data: submission, error: fetchError } = await getSupabase()
				.from("contract_submissions")
				.select("id, status, signature_token_expires_at, signed_at")
				.eq("signature_token", request.params.token)
				.maybeSingle();

			if (fetchError) {
				request.log.error(
					{ err: fetchError },
					"Failed to load submission for sign",
				);
				throw createContractDatabaseError(fetchError);
			}
			if (!submission) {
				return reply.status(404).send({ error: "Invalid signing link" });
			}
			if (
				submission.signature_token_expires_at &&
				new Date(submission.signature_token_expires_at).getTime() < Date.now()
			) {
				return reply.status(410).send({ error: "Signing link expired" });
			}
			if (submission.status !== "sent_to_partner") {
				return reply
					.status(409)
					.send({ error: "Contract is not in a signable state" });
			}

			const nowIso = new Date().toISOString();
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update({
					signature_data: body.signature_data,
					signer_name: body.signer_name,
					signed_at: nowIso,
					status: "partner_signed",
					signature_token: null,
					signature_token_expires_at: null,
					updated_at: nowIso,
				})
				.eq("id", submission.id)
				.select("id, status, signed_at")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to record signature");
				throw createContractDatabaseError(error);
			}

			await recordAndNotifyTransition({
				request,
				submissionId: String(submission.id),
				fromStatus: "sent_to_partner",
				toStatus: "partner_signed",
				changedBy: null,
				changedByName: body.signer_name,
			});
			return data;
		},
	);

	server.post<{ Params: { id: string } }>(
		"/contracts/submissions/:id/board-signature",
		{ preHandler: [authenticate, requireContractsAdmin, requireBoardMember] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = SignBodySchema.parse(request.body);

			const { data: current, error: currentError } = await getSupabase()
				.from("contract_submissions")
				.select("id, status, signed_at")
				.eq("id", request.params.id)
				.single();
			if (currentError || !current) {
				return reply.status(404).send({ error: "Submission not found" });
			}
			if (current.status !== "partner_signed" || !current.signed_at) {
				return reply.status(409).send({
					error: "Contract must be signed by the partner before board signing",
				});
			}

			const nowIso = new Date().toISOString();
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update({
					admin_signature_data: body.signature_data,
					admin_signer_name: body.signer_name,
					admin_signed_at: nowIso,
					reviewed_by: user.id,
					reviewed_at: nowIso,
					status: "board_signed",
					updated_at: nowIso,
				})
				.eq("id", request.params.id)
				.select("*")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to record board signature");
				throw createContractDatabaseError(error);
			}

			await recordAndNotifyTransition({
				request,
				submissionId: request.params.id,
				fromStatus: "partner_signed",
				toStatus: "board_signed",
				changedBy: user.id,
				changedByName: body.signer_name,
			});
			await maybeAutoSendAfterBoardSign({
				request,
				submissionId: request.params.id,
			});
			return data;
		},
	);

	server.post<{ Params: { id: string } }>(
		"/contracts/submissions/:id/finalize",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const { data: current, error: currentError } = await getSupabase()
				.from("contract_submissions")
				.select("*")
				.eq("id", request.params.id)
				.single();
			if (currentError || !current) {
				return reply.status(404).send({ error: "Submission not found" });
			}
			if (current.status !== "board_signed" && current.status !== "completed") {
				return reply.status(409).send({
					error: "Contract must be board-signed before finalization",
				});
			}

			let data: Record<string, unknown>;
			try {
				await prepareFinalDocument(
					request.params.id,
					current as Record<string, unknown>,
				);
				data = await completeSubmission(request.params.id);
			} catch (error) {
				request.log.error({ err: error }, "Failed to finalize contract");
				throw createContractDatabaseError(error);
			}

			const finalizeUser = (request as AuthenticatedRequest).user;
			await recordAndNotifyTransition({
				request,
				submissionId: request.params.id,
				fromStatus: typeof current.status === "string" ? current.status : null,
				toStatus: "completed",
				changedBy: finalizeUser.id,
				changedByName: await getMemberDisplayName(finalizeUser.id),
			});
			return data;
		},
	);

	server.get<{ Params: { token: string }; Querystring: { download?: string } }>(
		"/contracts/final/:token/pdf",
		async (request, reply) => {
			const query = PdfDownloadQuerySchema.parse(request.query);
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, status, final_document_version_id, admin_edited_text, generated_contract_text, signer_name, signed_at, signature_data, admin_signer_name, admin_signed_at, admin_signature_data",
				)
				.eq("final_pdf_token", request.params.token)
				.maybeSingle();

			if (error) {
				request.log.error({ err: error }, "Failed to fetch final PDF");
				throw createContractDatabaseError(error);
			}
			if (data?.status !== "completed") {
				return reply.status(404).send({ error: "Final PDF not found" });
			}

			const finalVersion = await fetchDocumentVersion(
				(data as Record<string, unknown>).final_document_version_id,
			);
			const finalText =
				typeof finalVersion?.rendered_text === "string"
					? finalVersion.rendered_text
					: buildFinalPdfText(data);
			const pdf = createTextPdf(
				finalText,
				buildSignatureImages(data as Record<string, unknown>),
			);
			return sendPdf(
				reply,
				pdf,
				`contract-${data.id}.pdf`,
				query.download === "1" ? "attachment" : "inline",
			);
		},
	);
}
