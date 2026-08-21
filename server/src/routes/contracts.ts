import type { ContractWorkflowStatus } from "@member-manager/shared";
import {
	CommentBodySchema,
	DraftSubmissionPatchSchema,
	enrichContractFormData,
	SubmissionBodySchema,
	SubmissionPatchSchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { PDFDocument } from "pdf-lib";
import { checkAdminRole, checkContractsAdmin } from "../lib/auth.js";
import {
	isContractEmailConfigured,
	sendContractPartnerEmail,
} from "../lib/contractEmails.js";
import {
	anchorsForOpenSign,
	dispatchContractRenderJobs,
	downloadReadyVersionPdf,
	encryptedContractFormData,
	enqueueContractRenderJob,
	getReadyDocxVersion,
	hydrateDocxSubmission,
	insertDocxDocumentVersion,
	parseStoredContractSignatureAnchors,
} from "../lib/contracts/contractDocxPipeline.js";
import { sendPdf } from "../lib/contracts/contractPdf.js";
import {
	getPartnerCompanyNameFromSubmission,
	getPartnerEmailFromSubmission,
	toCreatorSubmissionDetail,
	toCreatorSubmissionSummary,
} from "../lib/contracts/contractRecords.js";
import {
	createContractDatabaseError,
	createSubmissionComment,
	fetchSubmissionComments,
	fetchTemplateWithChildren,
} from "../lib/contracts/contractRepository.js";
import {
	generateSignatureToken,
	getAppBaseUrl,
} from "../lib/contracts/contractSecurity.js";
import { findInvalidContractEmailFields } from "../lib/contracts/contractValidation.js";
import {
	getMemberDisplayName,
	notifyContractStatusChange,
	notifySubmitterOfClarification,
	recordStatusEvent,
} from "../lib/contracts/contractWorkflow.js";
import { isOpenSignConfigured, sendOpenSignDocument } from "../lib/openSign.js";
import { getSupabase } from "../lib/supabase.js";
import {
	authenticate,
	requireContractsAdmin,
	requireContractsCreate,
} from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";
import { contractDocxRoutes } from "./contracts/docx.js";
import { contractSigningRoutes } from "./contracts/signing.js";
import { contractTemplateRoutes } from "./contracts/templates.js";

// =========================================================================
// Helpers
// =========================================================================

async function canEditDraftSubmission(
	userId: string,
	submission: Record<string, unknown>,
): Promise<boolean> {
	if (submission.submitter_user_id === userId) return true;
	return checkAdminRole(userId);
}

const MANUAL_STATUSES: ReadonlySet<string> = new Set([
	"submitted",
	"legal_review",
	"in_review",
	"inquiry",
	"approved",
]);

// =========================================================================
// Route plugin
// =========================================================================

export async function contractRoutes(server: FastifyInstance) {
	await contractDocxRoutes(server);
	await contractTemplateRoutes(server);

	// ---------------------------------------------------------------------
	// Submissions: internal contract workflow is contracts.admin only.
	// ---------------------------------------------------------------------

	server.get(
		"/contracts/submissions",
		{ preHandler: [authenticate, requireContractsCreate] },
		async (request, _reply) => {
			const user = (request as AuthenticatedRequest).user;
			const isAdmin =
				(await checkAdminRole(user.id)) || (await checkContractsAdmin(user.id));
			let query = getSupabase()
				.from("contract_submissions")
				.select(
					"id, template_id, template_document_id, renderer_engine, active_document_version_id, submitter_user_id, status, submitted_at, signed_at, admin_signed_at, final_pdf_token, final_pdf_sent_at, partner_email_sent_at, partner_email_recipient, partner_email_error, clarification_email_sent_at, clarification_email_recipient, clarification_email_error, signature_provider, opensign_document_id, opensign_status, opensign_sent_at, opensign_completed_at, opensign_file_url, opensign_certificate_url, opensign_error, created_at, updated_at, signature_token, signature_token_expires_at",
				)
				.order("created_at", { ascending: false });
			if (!isAdmin) {
				query = query.eq("submitter_user_id", user.id);
			}
			const { data, error } = await query;
			if (error) {
				request.log.error(
					{ err: error, userId: user.id },
					"Failed to list submissions",
				);
				throw createContractDatabaseError(error);
			}
			const rows = await Promise.all(
				(data ?? []).map((row) =>
					hydrateDocxSubmission(row as Record<string, unknown>),
				),
			);
			if (isAdmin) {
				return rows;
			}
			return rows.map((row) =>
				toCreatorSubmissionSummary(row as Record<string, unknown>),
			);
		},
	);

	server.get<{ Params: { id: string } }>(
		"/contracts/submissions/:id",
		{ preHandler: [authenticate, requireContractsCreate] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select("*")
				.eq("id", request.params.id)
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Submission not found" });
				}
				request.log.error({ err: error }, "Failed to fetch submission");
				throw createContractDatabaseError(error);
			}
			const isAdmin =
				(await checkAdminRole(user.id)) || (await checkContractsAdmin(user.id));
			if (!isAdmin && data.submitter_user_id !== user.id) {
				return reply.status(403).send({ error: "Forbidden" });
			}
			const hydrated = await hydrateDocxSubmission(
				data as Record<string, unknown>,
			);
			if (!isAdmin) {
				return toCreatorSubmissionDetail(hydrated);
			}
			return hydrated;
		},
	);

	server.get<{ Params: { id: string } }>(
		"/contracts/submissions/:id/comments",
		{ preHandler: [authenticate, requireContractsCreate] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const { data: submission, error: fetchError } = await getSupabase()
				.from("contract_submissions")
				.select("submitter_user_id")
				.eq("id", request.params.id)
				.single();
			if (fetchError) {
				if ((fetchError as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Submission not found" });
				}
				throw createContractDatabaseError(fetchError);
			}
			const isAdmin =
				(await checkAdminRole(user.id)) || (await checkContractsAdmin(user.id));
			if (!isAdmin && submission.submitter_user_id !== user.id) {
				return reply.status(403).send({ error: "Forbidden" });
			}
			try {
				return await fetchSubmissionComments(request.params.id);
			} catch (error) {
				request.log.error({ err: error }, "Failed to fetch contract comments");
				throw createContractDatabaseError(error);
			}
		},
	);

	// Nr.3: status-transition history for the contract view.
	server.get<{ Params: { id: string } }>(
		"/contracts/submissions/:id/status-events",
		{ preHandler: [authenticate, requireContractsCreate] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const { data: submission, error: fetchError } = await getSupabase()
				.from("contract_submissions")
				.select("submitter_user_id")
				.eq("id", request.params.id)
				.single();
			if (fetchError) {
				if ((fetchError as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Submission not found" });
				}
				throw createContractDatabaseError(fetchError);
			}
			const isAdmin =
				(await checkAdminRole(user.id)) || (await checkContractsAdmin(user.id));
			if (!isAdmin && submission.submitter_user_id !== user.id) {
				return reply.status(403).send({ error: "Forbidden" });
			}
			const { data, error } = await getSupabase()
				.from("contract_status_events")
				.select("*")
				.eq("submission_id", request.params.id)
				.order("created_at", { ascending: true });
			if (error) {
				request.log.error({ err: error }, "Failed to fetch status events");
				throw createContractDatabaseError(error);
			}
			return data ?? [];
		},
	);

	server.get<{ Params: { id: string } }>(
		"/contracts/submissions/:id/pdf",
		{ preHandler: [authenticate, requireContractsCreate] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select("*")
				.eq("id", request.params.id)
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Submission not found" });
				}
				request.log.error({ err: error }, "Failed to fetch submission PDF");
				throw createContractDatabaseError(error);
			}
			const isAdmin =
				(await checkAdminRole(user.id)) || (await checkContractsAdmin(user.id));
			if (!isAdmin && data.submitter_user_id !== user.id) {
				return reply.status(403).send({ error: "Forbidden" });
			}
			if (data.renderer_engine !== "docx") {
				return reply.status(410).send({
					error: "This historical contract uses a retired document engine",
				});
			}
			return sendPdf(
				reply,
				await downloadReadyVersionPdf(
					data.status === "completed"
						? data.final_document_version_id
						: (data.active_document_version_id ??
								data.sent_document_version_id),
				),
				`contract-${request.params.id}.pdf`,
				"attachment",
			);
		},
	);

	server.post<{ Params: { id: string } }>(
		"/contracts/submissions/:id/comments",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = CommentBodySchema.parse(request.body);
			const { data: submission, error: fetchError } = await getSupabase()
				.from("contract_submissions")
				.select("id, active_document_version_id")
				.eq("id", request.params.id)
				.maybeSingle();
			if (fetchError) {
				request.log.error({ err: fetchError }, "Failed to load submission");
				throw createContractDatabaseError(fetchError);
			}
			if (!submission) {
				return reply.status(404).send({ error: "Submission not found" });
			}

			try {
				// Nr.4: show a human name in the comment history, not the raw email.
				const authorName =
					(await getMemberDisplayName(user.id)) ?? user.email ?? null;
				return await createSubmissionComment({
					submissionId: request.params.id,
					authorType: "internal",
					authorName,
					authorEmail: user.email ?? null,
					comment: body.comment,
					documentVersionId:
						typeof submission.active_document_version_id === "string"
							? submission.active_document_version_id
							: null,
					createdBy: user.id,
				});
			} catch (error) {
				request.log.error({ err: error }, "Failed to create internal comment");
				throw createContractDatabaseError(error);
			}
		},
	);

	server.post(
		"/contracts/submissions",
		{ preHandler: [authenticate, requireContractsCreate] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = SubmissionBodySchema.parse(request.body);
			const formData = enrichContractFormData(body.form_data);

			let template: Record<string, unknown> | null = null;
			try {
				const templateDetail = await fetchTemplateWithChildren(
					body.template_id,
				);
				if (!templateDetail.template) {
					return reply.status(404).send({ error: "Template not found" });
				}
				template = templateDetail.template as Record<string, unknown>;
				const invalidEmails = findInvalidContractEmailFields(
					templateDetail.variables as Array<Record<string, unknown>>,
					formData,
				);
				if (invalidEmails.length > 0) {
					return reply.status(400).send({
						error: `Invalid email address in: ${invalidEmails.join(", ")}`,
					});
				}
			} catch (error) {
				request.log.error({ err: error }, "Failed to load contract template");
				throw createContractDatabaseError(error);
			}

			const now = new Date().toISOString();
			let templateDocumentId: string | null = null;
			if (!template) {
				return reply.status(404).send({ error: "Template not found" });
			}
			if (template.renderer_engine !== "docx") {
				return reply.status(409).send({
					error: "This template uses a retired document engine",
				});
			}
			templateDocumentId =
				typeof template.active_document_id === "string"
					? template.active_document_id
					: null;
			if (!templateDocumentId) {
				return reply.status(409).send({
					error: "Template does not have an active DOCX version",
				});
			}
			const { data: activeDocument, error: activeDocumentError } =
				await getSupabase()
					.from("contract_template_documents")
					.select("status")
					.eq("id", templateDocumentId)
					.eq("template_id", body.template_id)
					.maybeSingle();
			if (activeDocumentError) throw activeDocumentError;
			if (activeDocument?.status !== "ready") {
				return reply.status(409).send({
					error: "Template DOCX is not ready",
				});
			}
			const encryptedFormData = encryptedContractFormData(formData);
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.insert({
					template_id: body.template_id,
					template_document_id: templateDocumentId,
					renderer_engine: "docx",
					submitter_user_id: user.id,
					form_data: {},
					form_data_encrypted: encryptedFormData,
					status: body.status === "draft" ? "draft" : "legal_review",
					submitted_at: now,
				})
				.select("*")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to create submission");
				throw createContractDatabaseError(error);
			}

			try {
				let updated: Record<string, unknown>;
				const version = await insertDocxDocumentVersion({
					submissionId: String(data.id),
					source: body.status === "draft" ? "draft" : "generated",
					formDataEncrypted: encryptedFormData,
					createdBy: user.id,
				});
				await enqueueContractRenderJob({
					operation: "submission_render",
					submissionId: String(data.id),
					documentVersionId: String(version.id),
					payload: { kind: "submission_render" },
					idempotencyKey: `submission-render:${String(version.id)}`,
				});
				dispatchContractRenderJobs(request);
				updated = await hydrateDocxSubmission({
					...data,
					active_document_version_id: version.id,
				});
				try {
					await recordStatusEvent({
						submissionId: String(data.id),
						fromStatus: null,
						toStatus: String(updated.status),
						changedBy: user.id,
						changedByName: await getMemberDisplayName(user.id),
					});
				} catch (eventError) {
					request.log.warn(
						{ err: eventError, submissionId: String(data.id) },
						"Failed to record initial contract status event",
					);
				}
				return updated;
			} catch (error) {
				await getSupabase()
					.from("contract_submissions")
					.delete()
					.eq("id", data.id);
				request.log.error(
					{ err: error },
					"Failed to create initial contract document version",
				);
				throw createContractDatabaseError(error);
			}
		},
	);

	server.patch<{ Params: { id: string } }>(
		"/contracts/submissions/:id/draft",
		{ preHandler: [authenticate, requireContractsCreate] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = DraftSubmissionPatchSchema.parse(request.body);
			const { data: current, error: currentError } = await getSupabase()
				.from("contract_submissions")
				.select("*")
				.eq("id", request.params.id)
				.single();

			if (currentError || !current) {
				return reply.status(404).send({ error: "Submission not found" });
			}
			if (current.status !== "draft") {
				return reply
					.status(409)
					.send({ error: "Only draft submissions can be edited here" });
			}
			if (!(await canEditDraftSubmission(user.id, current))) {
				return reply
					.status(403)
					.send({ error: "Only the draft creator can edit this draft" });
			}
			if (current.renderer_engine !== "docx") {
				return reply.status(410).send({
					error: "This historical contract uses a retired document engine",
				});
			}

			const formData = enrichContractFormData(body.form_data);
			try {
				const { template, variables } = await fetchTemplateWithChildren(
					String(current.template_id),
				);
				if (!template) {
					return reply.status(404).send({ error: "Template not found" });
				}
				const invalidEmails = findInvalidContractEmailFields(
					variables as Array<Record<string, unknown>>,
					formData,
				);
				if (invalidEmails.length > 0) {
					return reply.status(400).send({
						error: `Invalid email address in: ${invalidEmails.join(", ")}`,
					});
				}
			} catch (error) {
				request.log.error({ err: error }, "Failed to load draft template");
				throw createContractDatabaseError(error);
			}

			const nowIso = new Date().toISOString();
			const nextStatus = body.status === "submitted" ? "legal_review" : "draft";
			const encryptedFormData = encryptedContractFormData(formData);
			const version = await insertDocxDocumentVersion({
				submissionId: request.params.id,
				source: nextStatus === "draft" ? "draft" : "generated",
				formDataEncrypted: encryptedFormData,
				createdBy: user.id,
				parentDocumentVersionId:
					typeof current.active_document_version_id === "string"
						? current.active_document_version_id
						: null,
			});
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update({
					form_data: {},
					form_data_encrypted: encryptedFormData,
					status: nextStatus,
					active_document_version_id: version.id,
					submitted_at:
						nextStatus === "legal_review" ? nowIso : current.submitted_at,
					updated_at: nowIso,
				})
				.eq("id", request.params.id)
				.eq("status", "draft")
				.select("*")
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply
						.status(409)
						.send({ error: "Draft was already submitted or changed" });
				}
				request.log.error({ err: error }, "Failed to update draft submission");
				throw createContractDatabaseError(error);
			}
			if (encryptedFormData) {
				await enqueueContractRenderJob({
					operation: "submission_render",
					submissionId: request.params.id,
					documentVersionId: String(version.id),
					payload: { kind: "submission_render" },
					idempotencyKey: `submission-render:${String(version.id)}`,
				});
				dispatchContractRenderJobs(request);
			}

			if (nextStatus !== "draft") {
				try {
					await recordStatusEvent({
						submissionId: request.params.id,
						fromStatus: "draft",
						toStatus: nextStatus,
						changedBy: user.id,
						changedByName: await getMemberDisplayName(user.id),
					});
				} catch (eventError) {
					request.log.warn(
						{ err: eventError, submissionId: request.params.id },
						"Failed to record draft submit status event",
					);
				}
			}

			return hydrateDocxSubmission(data as Record<string, unknown>);
		},
	);

	server.patch<{ Params: { id: string } }>(
		"/contracts/submissions/:id",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = SubmissionPatchSchema.parse(request.body);
			const shouldSendToPartner =
				body.send_to_partner === true ||
				body.send_partner_email === true ||
				body.send_opensign === true;
			const usesExternalDelivery =
				body.send_partner_email === true || body.send_opensign === true;
			const needsCurrent = true;
			let current: Record<string, unknown> | null = null;
			let sentToPartnerUpdate: Record<string, unknown> | null = null;

			if (needsCurrent) {
				const { data, error } = await getSupabase()
					.from("contract_submissions")
					.select("*")
					.eq("id", request.params.id)
					.single();
				if (error || !data) {
					return reply.status(404).send({ error: "Submission not found" });
				}
				current = data as Record<string, unknown>;
			}

			const fromStatus =
				current && typeof current.status === "string" ? current.status : null;
			if (current?.renderer_engine !== "docx") {
				return reply.status(409).send({
					error: "This historical contract uses a retired document engine",
				});
			}
			if (body.status === "approved") {
				await getReadyDocxVersion(current?.active_document_version_id);
			}
			const submissionUrl = `${getAppBaseUrl(request)}/contracts/submissions/${request.params.id}`;
			// Record the status event + notify legal/creator once the final row is
			// known. Best-effort; a notification failure never fails the request.
			const finalizeStatusChange = async (
				row: Record<string, unknown>,
			): Promise<Record<string, unknown>> => {
				const toStatus =
					typeof row.status === "string" ? row.status : (fromStatus ?? "");
				if (!current || toStatus === fromStatus) return row;
				const note =
					body.status === "rejected"
						? (body.rejection_reason ?? null)
						: body.status === "inquiry"
							? (body.feedback_message ?? body.notes ?? null)
							: body.manual_status_change === true
								? "Manual override"
								: null;
				try {
					await recordStatusEvent({
						submissionId: request.params.id,
						fromStatus,
						toStatus,
						changedBy: user.id,
						changedByName: await getMemberDisplayName(user.id),
						note,
					});
				} catch (eventError) {
					request.log.warn(
						{ err: eventError, submissionId: request.params.id },
						"Failed to record contract status event",
					);
				}
				await notifyContractStatusChange({
					submission: row,
					fromStatus,
					toStatus,
					submissionUrl,
					note,
					// The inquiry branch emails the creator via the clarification path.
					skipCreator: body.status === "inquiry",
					log: request.log,
				});
				return row;
			};

			const update: Record<string, unknown> = {
				updated_at: new Date().toISOString(),
				reviewed_by: user.id,
				reviewed_at: new Date().toISOString(),
			};
			if (body.status !== undefined)
				update.status = body.status satisfies ContractWorkflowStatus;
			if (body.notes !== undefined) update.notes = body.notes;
			if (body.feedback_message !== undefined)
				update.feedback_message = body.feedback_message;
			if (body.rejection_reason !== undefined)
				update.rejection_reason = body.rejection_reason;
			if (body.auto_send_after_board_signed !== undefined)
				update.auto_send_after_board_signed = body.auto_send_after_board_signed;
			if (
				body.manual_status_change === true &&
				(body.status === undefined ||
					!MANUAL_STATUSES.has(body.status) ||
					!MANUAL_STATUSES.has(String(current?.status)))
			) {
				return reply.status(400).send({
					error:
						"Manual status changes are only allowed between review statuses",
				});
			}
			// Nr.7: clarification is only for pre-approval questions. Once a contract
			// is approved (or further along), the Request-clarification path is closed.
			if (
				body.status === "inquiry" &&
				[
					"approved",
					"sent_to_partner",
					"partner_signed",
					"board_signed",
					"signed",
					"completed",
				].includes(String(current?.status))
			) {
				return reply.status(400).send({
					error:
						"Clarification cannot be requested once the contract has been approved",
				});
			}
			if (body.generate_signature_token === true || shouldSendToPartner) {
				// Nr.1: sending to the partner requires an explicit Approve first
				// (partner_comments is kept so a contract can be re-sent after the
				// partner leaves comments).
				if (
					!["approved", "partner_comments", "sent_to_partner"].includes(
						String(current?.status),
					)
				) {
					return reply.status(400).send({
						error: "Submission must be approved before sending to the partner",
					});
				}
				if (body.send_partner_email === true) {
					const partnerEmail = getPartnerEmailFromSubmission(current ?? {});
					if (!partnerEmail) {
						return reply.status(400).send({
							error:
								"Partner contact email is required before sending an email",
						});
					}
					if (!isContractEmailConfigured()) {
						return reply.status(503).send({
							error:
								"Contract email sending is not configured. Set RESEND_API_KEY and CONTRACT_EMAIL_FROM.",
						});
					}
				}
				if (body.send_opensign === true) {
					const partnerEmail = getPartnerEmailFromSubmission(current ?? {});
					if (!partnerEmail) {
						return reply.status(400).send({
							error:
								"Partner contact email is required before sending with OpenSign",
						});
					}
					if (!isOpenSignConfigured()) {
						return reply.status(503).send({
							error:
								"OpenSign sending is not configured. Set OPENSIGN_API_TOKEN.",
						});
					}
				}
				const ttlHours = body.signature_token_ttl_hours ?? 24 * 30;
				update.signature_token = generateSignatureToken();
				update.signature_token_expires_at = new Date(
					Date.now() + ttlHours * 60 * 60 * 1000,
				).toISOString();
				sentToPartnerUpdate = {
					status: "sent_to_partner",
					sent_to_partner_at: new Date().toISOString(),
				};
				if (!usesExternalDelivery) {
					Object.assign(update, sentToPartnerUpdate);
				}
				if (body.send_partner_email === true) {
					update.partner_email_error = null;
				}
				if (body.send_opensign === true) {
					update.signature_provider = "opensign";
					update.opensign_error = null;
				}
			}

			// Nr.5: generate a public board-signing link once the partner has signed.
			if (body.generate_board_signature_token === true) {
				if (String(current?.status) !== "partner_signed") {
					return reply.status(400).send({
						error:
							"A board signing link can only be generated after the partner has signed",
					});
				}
				const ttlHours = body.signature_token_ttl_hours ?? 24 * 30;
				update.board_signature_token = generateSignatureToken();
				update.board_signature_token_expires_at = new Date(
					Date.now() + ttlHours * 60 * 60 * 1000,
				).toISOString();
			}

			if (current && shouldSendToPartner) {
				const readyVersion = await getReadyDocxVersion(
					current.active_document_version_id,
				);
				update.sent_document_version_id = readyVersion.id;
			}

			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update(update)
				.eq("id", request.params.id)
				.select("*")
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Submission not found" });
				}
				request.log.error({ err: error }, "Failed to update submission");
				throw createContractDatabaseError(error);
			}
			if (body.send_partner_email === true) {
				const submission = data as Record<string, unknown>;
				const recipient = getPartnerEmailFromSubmission(submission);
				const signingToken =
					typeof submission.signature_token === "string"
						? submission.signature_token
						: "";
				try {
					await sendContractPartnerEmail({
						to: recipient,
						partnerCompanyName:
							getPartnerCompanyNameFromSubmission(submission) || "Partner",
						signingUrl: `${getAppBaseUrl(request)}/contracts/sign/${signingToken}`,
						subject: body.partner_email_subject,
						customMessage: body.partner_email_message,
					});
					const { data: emailed, error: emailUpdateError } = await getSupabase()
						.from("contract_submissions")
						.update({
							...(sentToPartnerUpdate ?? {}),
							partner_email_sent_at: new Date().toISOString(),
							partner_email_recipient: recipient,
							partner_email_error: null,
							updated_at: new Date().toISOString(),
						})
						.eq("id", request.params.id)
						.select("*")
						.single();
					if (emailUpdateError) throw emailUpdateError;
					return hydrateDocxSubmission(
						await finalizeStatusChange(emailed as Record<string, unknown>),
					);
				} catch (emailError) {
					const message =
						emailError instanceof Error
							? emailError.message
							: "Failed to send partner email";
					await getSupabase()
						.from("contract_submissions")
						.update({
							partner_email_recipient: recipient,
							partner_email_error: message,
							updated_at: new Date().toISOString(),
						})
						.eq("id", request.params.id);
					request.log.error(
						{ err: emailError },
						"Failed to send partner contract email",
					);
					return reply.status(502).send({ error: message });
				}
			}
			if (body.send_opensign === true) {
				const submission = data as Record<string, unknown>;
				const recipient = getPartnerEmailFromSubmission(submission);
				const partnerCompany =
					getPartnerCompanyNameFromSubmission(submission) || "Partner";
				try {
					const sentVersion = await getReadyDocxVersion(
						submission.sent_document_version_id,
					);
					const pdf = await downloadReadyVersionPdf(sentVersion.id);
					const anchors = parseStoredContractSignatureAnchors(
						sentVersion.signature_anchors,
					);
					const document = await PDFDocument.load(pdf);
					const page = document.getPage(anchors.partner.page - 1);
					if (!page) {
						return reply.status(409).send({
							error: "Stored partner signature anchor is invalid",
						});
					}
					const widgets = anchorsForOpenSign(anchors, page.getHeight());
					const openSignDocument = await sendOpenSignDocument({
						name: `TUM.ai Contract - ${partnerCompany}`,
						pdf,
						widgets,
						signer: {
							name: partnerCompany,
							email: recipient,
						},
						note: "Please review and sign this TUM.ai contract in OpenSign.",
						redirectUrl: `${getAppBaseUrl(request)}/contracts`,
					});
					const { data: openSigned, error: openSignUpdateError } =
						await getSupabase()
							.from("contract_submissions")
							.update({
								...(sentToPartnerUpdate ?? {}),
								opensign_document_id: openSignDocument.documentId,
								opensign_status: openSignDocument.status ?? "sent",
								opensign_sent_at: new Date().toISOString(),
								opensign_file_url: null,
								opensign_error: null,
								updated_at: new Date().toISOString(),
							})
							.eq("id", request.params.id)
							.select("*")
							.single();
					if (openSignUpdateError) throw openSignUpdateError;
					return hydrateDocxSubmission(
						await finalizeStatusChange(openSigned as Record<string, unknown>),
					);
				} catch (openSignError) {
					const message =
						openSignError instanceof Error
							? openSignError.message
							: "Failed to send contract with OpenSign";
					await getSupabase()
						.from("contract_submissions")
						.update({
							opensign_error: message,
							updated_at: new Date().toISOString(),
						})
						.eq("id", request.params.id);
					request.log.error(
						{ err: openSignError },
						"Failed to send OpenSign contract",
					);
					return reply.status(502).send({ error: message });
				}
			}
			if (body.status === "inquiry") {
				let clarificationEmailUpdate: Record<string, unknown>;
				try {
					const result = await notifySubmitterOfClarification({
						submission: data as Record<string, unknown>,
						message: body.feedback_message ?? body.notes ?? null,
						submissionUrl: `${getAppBaseUrl(request)}/contracts/submissions/${request.params.id}`,
					});
					clarificationEmailUpdate = {
						clarification_email_recipient: result.recipient,
						clarification_email_sent_at: result.error
							? null
							: new Date().toISOString(),
						clarification_email_error: result.error,
					};
				} catch (notificationError) {
					const message =
						notificationError instanceof Error
							? notificationError.message
							: "Failed to send clarification notification";
					request.log.error(
						{ err: notificationError, submissionId: request.params.id },
						"Failed to notify contract submitter about clarification request",
					);
					clarificationEmailUpdate = {
						clarification_email_recipient: null,
						clarification_email_sent_at: null,
						clarification_email_error: message,
					};
				}
				const { data: notified, error: notificationUpdateError } =
					await getSupabase()
						.from("contract_submissions")
						.update({
							...clarificationEmailUpdate,
							updated_at: new Date().toISOString(),
						})
						.eq("id", request.params.id)
						.select("*")
						.single();
				if (notificationUpdateError) {
					request.log.error(
						{ err: notificationUpdateError, submissionId: request.params.id },
						"Failed to store contract clarification notification status",
					);
					throw createContractDatabaseError(notificationUpdateError);
				}
				return hydrateDocxSubmission(
					await finalizeStatusChange(notified as Record<string, unknown>),
				);
			}
			return hydrateDocxSubmission(
				await finalizeStatusChange(data as Record<string, unknown>),
			);
		},
	);

	await contractSigningRoutes(server);
}
