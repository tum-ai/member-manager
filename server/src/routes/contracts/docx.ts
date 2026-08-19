import { randomUUID } from "node:crypto";
import {
	CONTRACT_DERIVED_FORM_DATA_KEYS,
	ContractDocumentRetryBodySchema,
	ContractDocxCutoverBodySchema,
	ContractSubmissionParamsSchema,
	ContractTemplateDocumentParamsSchema,
	ContractTemplateParamsSchema,
} from "@member-manager/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { removeContractArtifact } from "../../lib/contracts/contractArtifactStorage.js";
import {
	assertContractDocxMimeType,
	inspectContractDocx,
	inspectFilledContractDocx,
} from "../../lib/contracts/contractDocx.js";
import {
	CONTRACT_RENDER_JOBS_PER_INVOCATION,
	createTemplateDocumentRecord,
	dispatchContractRenderJobs,
	downloadReadyVersionDocx,
	downloadReadyVersionPdf,
	downloadTemplatePreviewPdf,
	enqueueContractRenderJob,
	getDocxReadiness,
	hydrateDocxSubmission,
	insertDocxDocumentVersion,
	runContractRenderJobs,
	storeSubmissionDocxSource,
	storeTemplateSource,
} from "../../lib/contracts/contractDocxPipeline.js";
import { fetchTemplateWithChildren } from "../../lib/contracts/contractRepository.js";
import {
	ConflictError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "../../lib/errors.js";
import { revokeOpenSignDocument } from "../../lib/openSign.js";
import { getSupabase } from "../../lib/supabase.js";
import { authenticate, requireContractsAdmin } from "../../middleware/auth.js";
import type { AuthenticatedRequest } from "../../types/index.js";

const NON_EDITABLE_STATUSES = new Set([
	"partner_signed",
	"board_signed",
	"signed",
	"completed",
]);

function fileName(value: string): string {
	const normalized = value.replace(/\\/g, "/").split("/").at(-1)?.trim();
	if (
		!normalized ||
		normalized.length > 255 ||
		!normalized.toLowerCase().endsWith(".docx")
	) {
		throw new ValidationError("Upload must have a .docx filename");
	}
	return normalized;
}

async function receiveDocx(request: {
	file: () => Promise<
		| {
				filename: string;
				mimetype: string;
				toBuffer: () => Promise<Buffer>;
		  }
		| undefined
	>;
}): Promise<{ buffer: Buffer; filename: string }> {
	const part = await request.file();
	if (!part) throw new ValidationError("A DOCX file is required");
	assertContractDocxMimeType(part.mimetype);
	return {
		buffer: await part.toBuffer(),
		filename: fileName(part.filename),
	};
}

function sendDocx(reply: FastifyReply, docx: Buffer, filename: string) {
	return reply
		.header(
			"Content-Type",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		)
		.header("Content-Disposition", `attachment; filename="${filename}"`)
		.send(docx);
}

function sendPdf(reply: FastifyReply, pdf: Buffer, filename: string) {
	return reply
		.header("Content-Type", "application/pdf")
		.header("Content-Disposition", `inline; filename="${filename}"`)
		.send(pdf);
}

async function fetchSubmission(id: string): Promise<Record<string, unknown>> {
	const { data, error } = await getSupabase()
		.from("contract_submissions")
		.select("*")
		.eq("id", id)
		.maybeSingle();
	if (error) throw error;
	if (!data) throw new NotFoundError("Submission not found");
	return data as Record<string, unknown>;
}

function requireCronSecret(authorization: string | undefined): void {
	const secret = process.env.CRON_SECRET?.trim();
	if (!secret || authorization !== `Bearer ${secret}`) {
		throw new UnauthorizedError("Invalid cron authorization");
	}
}

export async function contractDocxRoutes(server: FastifyInstance) {
	server.post<{ Params: { id: string } }>(
		"/contracts/templates/:id/documents",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request) => {
			const { id } = ContractTemplateParamsSchema.parse(request.params);
			const upload = await receiveDocx(request);
			const { variables } = await fetchTemplateWithChildren(id);
			const variableNames = variables
				.map((variable) => variable.variable_name)
				.filter((value): value is string => typeof value === "string");
			const allowed = new Set([
				...variableNames,
				...CONTRACT_DERIVED_FORM_DATA_KEYS,
			]);
			const required = new Set(
				variables
					.filter((variable) => variable.is_required === true)
					.map((variable) => variable.variable_name)
					.filter((value): value is string => typeof value === "string"),
			);
			const manifest = await inspectContractDocx(
				upload.buffer,
				allowed,
				required,
			);
			const documentId = randomUUID();
			const stored = await storeTemplateSource({
				templateId: id,
				documentId,
				docx: upload.buffer,
			});
			let document: Record<string, unknown>;
			try {
				document = await createTemplateDocumentRecord({
					templateId: id,
					documentId,
					sourcePath: stored.path,
					sourceSizeBytes: stored.sizeBytes,
					sourceSha256: stored.sha256,
					originalFilename: upload.filename,
					placeholderManifest: { ...manifest },
					uploadedByUserId: (request as AuthenticatedRequest).user.id,
				});
			} catch (error) {
				await removeContractArtifact({
					bucket: stored.bucket,
					path: stored.path,
				}).catch(() => undefined);
				throw error;
			}
			await enqueueContractRenderJob({
				operation: "template_preview",
				templateDocumentId: documentId,
				payload: { kind: "template_preview" },
				idempotencyKey: `template-preview:${documentId}:1`,
			});
			dispatchContractRenderJobs(request);
			return document;
		},
	);

	server.post<{ Params: { id: string; documentId: string } }>(
		"/contracts/templates/:id/documents/:documentId/retry",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request) => {
			const params = ContractTemplateDocumentParamsSchema.parse(request.params);
			ContractDocumentRetryBodySchema.parse(request.body);
			const { data: document, error } = await getSupabase()
				.from("contract_template_documents")
				.select("*")
				.eq("id", params.documentId)
				.eq("template_id", params.id)
				.maybeSingle();
			if (error) throw error;
			if (!document) throw new NotFoundError("Template document not found");
			if (document.status === "ready") return document;
			if (document.status === "queued" || document.status === "processing") {
				return document;
			}
			const { error: updateError } = await getSupabase()
				.from("contract_template_documents")
				.update({
					status: "queued",
					error_code: null,
					error_message: null,
					updated_at: new Date().toISOString(),
				})
				.eq("id", params.documentId);
			if (updateError) throw updateError;
			await enqueueContractRenderJob({
				operation: "template_preview",
				templateDocumentId: params.documentId,
				payload: { kind: "template_preview" },
				idempotencyKey: `template-preview:${params.documentId}:${randomUUID()}`,
			});
			dispatchContractRenderJobs(request);
			return {
				...document,
				status: "queued",
				error_code: null,
				error_message: null,
			};
		},
	);

	server.get<{ Params: { id: string; documentId: string } }>(
		"/contracts/templates/:id/documents/:documentId/preview.pdf",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const params = ContractTemplateDocumentParamsSchema.parse(request.params);
			const { data, error } = await getSupabase()
				.from("contract_template_documents")
				.select("id")
				.eq("id", params.documentId)
				.eq("template_id", params.id)
				.maybeSingle();
			if (error) throw error;
			if (!data) throw new NotFoundError("Template document not found");
			return sendPdf(
				reply,
				await downloadTemplatePreviewPdf(params.documentId),
				`contract-template-${params.documentId}.pdf`,
			);
		},
	);

	server.post<{ Params: { id: string; documentId: string } }>(
		"/contracts/templates/:id/documents/:documentId/activate",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request) => {
			const params = ContractTemplateDocumentParamsSchema.parse(request.params);
			const { error } = await getSupabase().rpc(
				"activate_contract_template_document",
				{
					p_template_id: params.id,
					p_document_id: params.documentId,
				},
			);
			if (error) throw error;
			const { data: template, error: templateError } = await getSupabase()
				.from("contract_templates")
				.select("*")
				.eq("id", params.id)
				.single();
			if (templateError) throw templateError;
			return template;
		},
	);

	server.get(
		"/contracts/docx-readiness",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async () => getDocxReadiness(),
	);

	server.post(
		"/contracts/docx-cutover",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request) => {
			const body = ContractDocxCutoverBodySchema.parse(request.body);
			if (body.enabled) {
				const readiness = await getDocxReadiness();
				if (!readiness.ready) {
					throw new ConflictError(
						"Every active contract template needs a ready DOCX version",
					);
				}
			}
			const { error } = await getSupabase()
				.from("contract_pipeline_settings")
				.update({
					new_submission_engine: body.enabled ? "docx" : "legacy_text",
					updated_by_user_id: (request as AuthenticatedRequest).user.id,
					updated_at: new Date().toISOString(),
				})
				.eq("singleton", true);
			if (error) throw error;
			return { enabled: body.enabled };
		},
	);

	server.get<{ Params: { id: string } }>(
		"/contracts/submissions/:id/docx",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const { id } = ContractSubmissionParamsSchema.parse(request.params);
			const submission = await fetchSubmission(id);
			if (submission.renderer_engine !== "docx") {
				throw new ConflictError(
					"This submission uses the legacy document format",
				);
			}
			return sendDocx(
				reply,
				await downloadReadyVersionDocx(submission.active_document_version_id),
				`contract-${id}.docx`,
			);
		},
	);

	server.post<{ Params: { id: string } }>(
		"/contracts/submissions/:id/docx",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request) => {
			const { id } = ContractSubmissionParamsSchema.parse(request.params);
			const submission = await fetchSubmission(id);
			if (submission.renderer_engine !== "docx") {
				throw new ConflictError(
					"This submission uses the legacy document format",
				);
			}
			if (NON_EDITABLE_STATUSES.has(String(submission.status))) {
				throw new ConflictError("A signed contract cannot be replaced");
			}
			const upload = await receiveDocx(request);
			await inspectFilledContractDocx(upload.buffer);
			if (typeof submission.opensign_document_id === "string") {
				await revokeOpenSignDocument(submission.opensign_document_id);
			}
			const versionId = randomUUID();
			const stored = await storeSubmissionDocxSource({
				submissionId: id,
				versionId,
				docx: upload.buffer,
			});
			try {
				await insertDocxDocumentVersion({
					submissionId: id,
					source: "legal_review",
					formDataEncrypted: String(submission.form_data_encrypted),
					createdBy: (request as AuthenticatedRequest).user.id,
					parentDocumentVersionId:
						typeof submission.active_document_version_id === "string"
							? submission.active_document_version_id
							: null,
					resetForLegalReview: true,
					id: versionId,
				});
			} catch (error) {
				await removeContractArtifact({
					bucket: stored.bucket,
					path: stored.path,
				}).catch(() => undefined);
				throw error;
			}
			await enqueueContractRenderJob({
				operation: "submission_render",
				submissionId: id,
				documentVersionId: versionId,
				payload: {
					kind: "submission_render",
					sourceDocx: stored,
				},
				idempotencyKey: `submission-render:${versionId}`,
			});
			dispatchContractRenderJobs(request);
			return hydrateDocxSubmission(await fetchSubmission(id));
		},
	);

	server.get<{ Params: { token: string } }>(
		"/contracts/sign/:token/pdf",
		async (request, reply) => {
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, renderer_engine, sent_document_version_id, signature_token_expires_at",
				)
				.eq("signature_token", request.params.token)
				.maybeSingle();
			if (error) throw error;
			if (!data) throw new NotFoundError("Invalid signing link");
			if (data.renderer_engine !== "docx") {
				throw new NotFoundError("Stored contract PDF not found");
			}
			if (
				data.signature_token_expires_at &&
				new Date(data.signature_token_expires_at).getTime() < Date.now()
			) {
				throw new ConflictError("Signing link expired");
			}
			return sendPdf(
				reply,
				await downloadReadyVersionPdf(data.sent_document_version_id),
				`contract-${data.id}.pdf`,
			);
		},
	);

	server.get<{ Params: { token: string } }>(
		"/contracts/board-sign/:token/pdf",
		async (request, reply) => {
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, renderer_engine, active_document_version_id, board_signature_token_expires_at",
				)
				.eq("board_signature_token", request.params.token)
				.maybeSingle();
			if (error) throw error;
			if (!data) throw new NotFoundError("Invalid board signing link");
			if (data.renderer_engine !== "docx") {
				throw new NotFoundError("Stored contract PDF not found");
			}
			if (
				data.board_signature_token_expires_at &&
				new Date(data.board_signature_token_expires_at).getTime() < Date.now()
			) {
				throw new ConflictError("Board signing link expired");
			}
			return sendPdf(
				reply,
				await downloadReadyVersionPdf(data.active_document_version_id),
				`contract-${data.id}.pdf`,
			);
		},
	);

	server.get("/contracts/render-jobs", async (request) => {
		requireCronSecret(request.headers.authorization);
		return runContractRenderJobs(CONTRACT_RENDER_JOBS_PER_INVOCATION, request);
	});
}
