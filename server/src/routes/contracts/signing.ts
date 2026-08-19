import {
	CommentBodySchema,
	OpenSignWebhookSchema,
	PdfDownloadQuerySchema,
	SignBodySchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { renderDocumentPages } from "../../lib/contracts/contractDocument.js";
import {
	dispatchContractRenderJobs,
	downloadReadyVersionPdf,
	enqueueContractRenderJob,
	getReadyDocxVersion,
	hydrateDocxSubmission,
	insertDocxDocumentVersion,
} from "../../lib/contracts/contractDocxPipeline.js";
import {
	completeSubmission,
	maybeAutoSendAfterBoardSign,
	prepareFinalDocument,
} from "../../lib/contracts/contractFinalization.js";
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
	createContractDatabaseError,
	createSubmissionComment,
	fetchDocumentVersion,
	fetchSubmissionComments,
} from "../../lib/contracts/contractRepository.js";
import {
	generateSignatureToken,
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

async function hasPendingContractRenderJob(
	submissionId: string,
	operation: "partner_signature" | "board_signature",
): Promise<boolean> {
	const { data, error } = await getSupabase()
		.from("contract_render_jobs")
		.select("id")
		.eq("submission_id", submissionId)
		.eq("operation", operation)
		.in("status", ["queued", "processing"])
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	return Boolean(data);
}

export async function contractSigningRoutes(server: FastifyInstance) {
	server.post(
		"/webhooks/opensign",
		{
			config: {
				rateLimit: {
					max: 60,
					timeWindow: "1 minute",
				},
			},
		},
		async (request, reply) => {
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
				return reply
					.status(400)
					.send({ error: "Missing OpenSign document id" });
			}

			const event = body.event ?? "unknown";
			const nowIso = new Date().toISOString();
			const { data: current, error: currentError } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, status, renderer_engine, sent_document_version_id, form_data_encrypted",
				)
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
			if (body.file && current.renderer_engine !== "docx") {
				update.opensign_file_url = body.file;
			}
			const certificateUrl = body.certificateUrl ?? body.certificate;
			if (certificateUrl) update.opensign_certificate_url = certificateUrl;

			const canApplyOpenSignStatus = current.status === "sent_to_partner";
			if (canApplyOpenSignStatus && isOpenSignCompletedEvent(event)) {
				if (current.renderer_engine === "docx") {
					if (!body.file || typeof current.form_data_encrypted !== "string") {
						return reply.status(400).send({
							error: "OpenSign completion did not include the signed PDF",
						});
					}
					const idempotencyKey = `opensign-ingest:${body.objectId}:${event}`;
					const { data: existingJob, error: existingJobError } =
						await getSupabase()
							.from("contract_render_jobs")
							.select("id")
							.eq("idempotency_key", idempotencyKey)
							.maybeSingle();
					if (existingJobError) throw existingJobError;
					if (!existingJob) {
						const version = await insertDocxDocumentVersion({
							submissionId: String(current.id),
							source: "partner_signed",
							formDataEncrypted: current.form_data_encrypted,
							parentDocumentVersionId:
								typeof current.sent_document_version_id === "string"
									? current.sent_document_version_id
									: null,
						});
						await enqueueContractRenderJob({
							operation: "opensign_ingest",
							submissionId: String(current.id),
							documentVersionId: String(version.id),
							payload: { kind: "opensign_ingest", fileUrl: body.file },
							idempotencyKey,
						});
						dispatchContractRenderJobs(request);
					}
					update.signer_name = "OpenSign";
					update.opensign_error = null;
				} else {
					update.status = "partner_signed";
					update.signed_at = nowIso;
					update.signer_name = "OpenSign";
					update.opensign_completed_at = nowIso;
					update.opensign_error = null;
				}
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

			if (
				typeof update.status === "string" &&
				update.status !== current.status
			) {
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
		},
	);

	// ---------------------------------------------------------------------
	// Public signing endpoints (no auth). Verified by signature_token only.
	// ---------------------------------------------------------------------

	server.get<{ Params: { token: string } }>(
		"/contracts/sign/:token",
		async (request, reply) => {
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, status, renderer_engine, admin_edited_text, generated_contract_text, sent_document_version_id, signature_token_expires_at, signed_at, partner_comment, partner_commented_at, form_data, form_data_encrypted, submitted_at, updated_at",
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
			const hydrated = await hydrateDocxSubmission(
				data as Record<string, unknown>,
			);
			const comments = await fetchSubmissionComments(String(data.id));
			const publicComments = buildPublicCommentHistory(hydrated, comments);
			if (data.renderer_engine === "docx") {
				return {
					pdf_url: `/api/contracts/sign/${encodeURIComponent(request.params.token)}/pdf`,
					document_status:
						typeof sentVersion?.artifact_status === "string"
							? sentVersion.artifact_status
							: "queued",
					status: data.status,
					comments: publicComments,
				};
			}
			const contractText =
				typeof sentVersion?.rendered_text === "string"
					? sentVersion.rendered_text
					: textFromSubmission(data as Record<string, unknown>);
			const pages = renderDocumentPages(contractText);
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
					"id, status, renderer_engine, admin_edited_text, generated_contract_text, active_document_version_id, sent_document_version_id, board_signature_token_expires_at, signer_name, signature_data, signed_at, admin_signed_at, form_data, submitted_at, updated_at",
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
			if (data.renderer_engine === "docx") {
				return {
					pdf_url: `/api/contracts/board-sign/${encodeURIComponent(request.params.token)}/pdf`,
					document_status:
						typeof version?.artifact_status === "string"
							? version.artifact_status
							: "queued",
					status: data.status,
					partner_signer_name: data.signer_name ?? null,
					partner_signature_data: null,
					partner_signed_at: data.signed_at ?? null,
				};
			}
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
				.select(
					"id, status, renderer_engine, board_signature_token_expires_at, admin_signed_at, active_document_version_id, form_data_encrypted",
				)
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
			if (submission.renderer_engine === "docx") {
				if (
					await hasPendingContractRenderJob(
						String(submission.id),
						"board_signature",
					)
				) {
					return {
						id: submission.id,
						status: submission.status,
						document_status: "queued",
					};
				}
				if (typeof submission.form_data_encrypted !== "string") {
					return reply.status(409).send({ error: "Contract data is missing" });
				}
				const parent = await getReadyDocxVersion(
					submission.active_document_version_id,
				);
				const { error: signerError } = await getSupabase()
					.from("contract_submissions")
					.update({
						admin_signer_name: body.signer_name,
						updated_at: new Date().toISOString(),
					})
					.eq("id", submission.id);
				if (signerError) throw signerError;
				const version = await insertDocxDocumentVersion({
					submissionId: String(submission.id),
					source: "board_signed",
					formDataEncrypted: submission.form_data_encrypted,
					parentDocumentVersionId: String(parent.id),
				});
				await enqueueContractRenderJob({
					operation: "board_signature",
					submissionId: String(submission.id),
					documentVersionId: String(version.id),
					payload: {
						kind: "board_signature",
						signatureData: body.signature_data,
					},
					idempotencyKey:
						body.idempotency_key ?? `board-signature:${String(version.id)}`,
				});
				dispatchContractRenderJobs(request);
				return {
					id: submission.id,
					status: submission.status,
					document_status: "queued",
				};
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
					"id, status, renderer_engine, signature_token_expires_at, signed_at, sent_document_version_id, form_data, form_data_encrypted, active_document_version_id",
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

			const hydratedSubmission = await hydrateDocxSubmission(
				submission as Record<string, unknown>,
			);
			const nowIso = new Date().toISOString();
			try {
				await createSubmissionComment({
					submissionId: String(submission.id),
					authorType: "partner",
					authorName:
						getPartnerCompanyNameFromSubmission(hydratedSubmission) ||
						"Partner",
					authorEmail: getPartnerEmailFromSubmission(hydratedSubmission),
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
					getPartnerCompanyNameFromSubmission(hydratedSubmission) || "Partner",
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
				.select(
					"id, status, renderer_engine, signature_token_expires_at, signed_at, sent_document_version_id, form_data_encrypted",
				)
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
			if (submission.renderer_engine === "docx") {
				if (
					await hasPendingContractRenderJob(
						String(submission.id),
						"partner_signature",
					)
				) {
					return {
						id: submission.id,
						status: submission.status,
						document_status: "queued",
					};
				}
				if (typeof submission.form_data_encrypted !== "string") {
					return reply.status(409).send({ error: "Contract data is missing" });
				}
				const parent = await getReadyDocxVersion(
					submission.sent_document_version_id,
				);
				const { error: signerError } = await getSupabase()
					.from("contract_submissions")
					.update({
						signer_name: body.signer_name,
						updated_at: new Date().toISOString(),
					})
					.eq("id", submission.id);
				if (signerError) throw signerError;
				const version = await insertDocxDocumentVersion({
					submissionId: String(submission.id),
					source: "partner_signed",
					formDataEncrypted: submission.form_data_encrypted,
					parentDocumentVersionId: String(parent.id),
				});
				await enqueueContractRenderJob({
					operation: "partner_signature",
					submissionId: String(submission.id),
					documentVersionId: String(version.id),
					payload: {
						kind: "partner_signature",
						signatureData: body.signature_data,
					},
					idempotencyKey:
						body.idempotency_key ?? `partner-signature:${String(version.id)}`,
				});
				dispatchContractRenderJobs(request);
				return {
					id: submission.id,
					status: submission.status,
					document_status: "queued",
				};
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
				.select(
					"id, status, signed_at, renderer_engine, active_document_version_id, form_data_encrypted",
				)
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
			if (current.renderer_engine === "docx") {
				if (
					await hasPendingContractRenderJob(
						String(current.id),
						"board_signature",
					)
				) {
					return hydrateDocxSubmission(current as Record<string, unknown>);
				}
				if (typeof current.form_data_encrypted !== "string") {
					return reply.status(409).send({ error: "Contract data is missing" });
				}
				const parent = await getReadyDocxVersion(
					current.active_document_version_id,
				);
				const { error: signerError } = await getSupabase()
					.from("contract_submissions")
					.update({
						admin_signer_name: body.signer_name,
						reviewed_by: user.id,
						reviewed_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					})
					.eq("id", current.id);
				if (signerError) throw signerError;
				const version = await insertDocxDocumentVersion({
					submissionId: request.params.id,
					source: "board_signed",
					formDataEncrypted: current.form_data_encrypted,
					createdBy: user.id,
					parentDocumentVersionId: String(parent.id),
				});
				await enqueueContractRenderJob({
					operation: "board_signature",
					submissionId: request.params.id,
					documentVersionId: String(version.id),
					payload: {
						kind: "board_signature",
						signatureData: body.signature_data,
					},
					idempotencyKey:
						body.idempotency_key ?? `board-signature:${String(version.id)}`,
				});
				dispatchContractRenderJobs(request);
				return hydrateDocxSubmission({
					...current,
					active_document_version_id: version.id,
					document_status: "queued",
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
				if (current.renderer_engine === "docx") {
					const version = await getReadyDocxVersion(
						current.active_document_version_id,
					);
					const { error: finalVersionError } = await getSupabase()
						.from("contract_submissions")
						.update({
							final_pdf_token:
								current.final_pdf_token ?? generateSignatureToken(),
							final_document_version_id: version.id,
							active_document_version_id: version.id,
							updated_at: new Date().toISOString(),
						})
						.eq("id", request.params.id);
					if (finalVersionError) throw finalVersionError;
				} else {
					await prepareFinalDocument(
						request.params.id,
						current as Record<string, unknown>,
					);
				}
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
					"id, status, renderer_engine, final_document_version_id, admin_edited_text, generated_contract_text, signer_name, signed_at, signature_data, admin_signer_name, admin_signed_at, admin_signature_data",
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
			if (data.renderer_engine === "docx") {
				return sendPdf(
					reply,
					await downloadReadyVersionPdf(data.final_document_version_id),
					`contract-${data.id}.pdf`,
					query.download === "1" ? "attachment" : "inline",
				);
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
