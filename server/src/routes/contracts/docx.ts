import { randomUUID } from "node:crypto";
import {
	CONTRACT_DERIVED_FORM_DATA_KEYS,
	CONTRACT_RENDER_ARTIFACT_BUCKET,
	CONTRACT_TEMPLATE_DOCUMENT_BUCKET,
	ContractDocumentRetryBodySchema,
	ContractDocxUploadBodySchema,
	ContractSubmissionParamsSchema,
	ContractTemplateDocumentParamsSchema,
	ContractTemplateParamsSchema,
	ContractUploadUrlBodySchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { contractArtifactSha256 } from "../../lib/contracts/contractArtifactStorage.js";
import {
	inspectContractDocx,
	inspectFilledContractDocx,
} from "../../lib/contracts/contractDocx.js";
import {
	CONTRACT_RENDER_JOBS_PER_INVOCATION,
	contractSubmissionDocxPath,
	contractTemplateSourcePath,
	createTemplateDocumentRecord,
	dispatchContractRenderJobs,
	enqueueContractRenderJob,
	getDocxReadiness,
	hydrateDocxSubmission,
	insertDocxDocumentVersion,
	readyVersionDocxUrl,
	readyVersionPdfUrl,
	runContractRenderJobs,
	templatePreviewPdfUrl,
} from "../../lib/contracts/contractDocxPipeline.js";
import { fetchTemplateWithChildren } from "../../lib/contracts/contractRepository.js";
import {
	assertUploadBelongsTo,
	createContractUploadUrl,
	downloadUploadedDocx,
	removeUploadedDocx,
} from "../../lib/contracts/contractUploads.js";
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

/**
 * Both upload paths are `{recordId}/{documentId}/{name}.docx`, minted server-side
 * when the ticket was issued. Reading the id back out keeps the row and the
 * object in agreement without trusting anything the client sent.
 */
function contractDocumentIdFromPath(path: string): string {
	const id = path.split("/")[1];
	if (!id || !UUID.test(id)) {
		throw new ValidationError("Upload path is not recognised");
	}
	return id;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function contractDocxRoutes(server: FastifyInstance) {
	server.post<{ Params: { id: string } }>(
		"/contracts/templates/:id/documents/upload-url",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request) => {
			const { id } = ContractTemplateParamsSchema.parse(request.params);
			const body = ContractUploadUrlBodySchema.parse(request.body);
			return createContractUploadUrl({
				bucket: CONTRACT_TEMPLATE_DOCUMENT_BUCKET,
				path: contractTemplateSourcePath(id, randomUUID()),
				mimeType: body.mime_type,
				sizeBytes: body.size_bytes,
			});
		},
	);

	server.post<{ Params: { id: string } }>(
		"/contracts/submissions/:id/docx/upload-url",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request) => {
			const { id } = ContractSubmissionParamsSchema.parse(request.params);
			const body = ContractUploadUrlBodySchema.parse(request.body);
			return createContractUploadUrl({
				bucket: CONTRACT_RENDER_ARTIFACT_BUCKET,
				path: contractSubmissionDocxPath(id, randomUUID()),
				mimeType: body.mime_type,
				sizeBytes: body.size_bytes,
			});
		},
	);

	server.post<{ Params: { id: string } }>(
		"/contracts/templates/:id/documents",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request) => {
			const { id } = ContractTemplateParamsSchema.parse(request.params);
			const body = ContractDocxUploadBodySchema.parse(request.body);
			// The ticket was minted for this template, so the object has to sit
			// under its prefix; that is what stops one template's upload being
			// claimed against another.
			assertUploadBelongsTo(id, body.storage_path);
			const source = {
				bucket: CONTRACT_TEMPLATE_DOCUMENT_BUCKET,
				path: body.storage_path,
			};
			const upload = {
				buffer: await downloadUploadedDocx(source),
				filename: fileName(body.filename),
			};
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
			let manifest: Awaited<ReturnType<typeof inspectContractDocx>>;
			try {
				manifest = await inspectContractDocx(upload.buffer, allowed, required);
			} catch (error) {
				// Nothing references the object yet, so a rejected upload has to be
				// cleared here or it lingers unreferenced.
				await removeUploadedDocx(source);
				throw error;
			}
			// The id is embedded in the path the ticket was minted for, so the row
			// and the object cannot disagree about where the source lives.
			const documentId = contractDocumentIdFromPath(body.storage_path);
			let document: Record<string, unknown>;
			try {
				document = await createTemplateDocumentRecord({
					templateId: id,
					documentId,
					sourcePath: source.path,
					sourceSizeBytes: upload.buffer.length,
					sourceSha256: contractArtifactSha256(upload.buffer),
					originalFilename: upload.filename,
					placeholderManifest: { ...manifest },
					uploadedByUserId: (request as AuthenticatedRequest).user.id,
				});
			} catch (error) {
				await removeUploadedDocx(source);
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
			return reply.redirect(await templatePreviewPdfUrl(params.documentId));
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
				.select(
					"id, name, description, renderer_engine, active_document_id, is_active, created_at, updated_at",
				)
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

	server.get<{ Params: { id: string } }>(
		"/contracts/submissions/:id/docx",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const { id } = ContractSubmissionParamsSchema.parse(request.params);
			const submission = await fetchSubmission(id);
			if (submission.renderer_engine !== "docx") {
				throw new ConflictError(
					"This submission uses a retired document format",
				);
			}
			return reply.redirect(
				await readyVersionDocxUrl(
					submission.active_document_version_id,
					`contract-${id}.docx`,
				),
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
					"This submission uses a retired document format",
				);
			}
			if (NON_EDITABLE_STATUSES.has(String(submission.status))) {
				throw new ConflictError("A signed contract cannot be replaced");
			}
			const body = ContractDocxUploadBodySchema.parse(request.body);
			assertUploadBelongsTo(id, body.storage_path);
			const source = {
				bucket: CONTRACT_RENDER_ARTIFACT_BUCKET,
				path: body.storage_path,
			};
			const upload = {
				buffer: await downloadUploadedDocx(source),
				filename: fileName(body.filename),
			};
			try {
				await inspectFilledContractDocx(upload.buffer);
			} catch (error) {
				await removeUploadedDocx(source);
				throw error;
			}
			if (typeof submission.opensign_document_id === "string") {
				await revokeOpenSignDocument(submission.opensign_document_id);
			}
			const versionId = contractDocumentIdFromPath(body.storage_path);
			const stored = {
				...source,
				sha256: contractArtifactSha256(upload.buffer),
				sizeBytes: upload.buffer.length,
			};
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
				await removeUploadedDocx(source);
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
			return reply.redirect(
				await readyVersionPdfUrl(data.sent_document_version_id),
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
			return reply.redirect(
				await readyVersionPdfUrl(data.active_document_version_id),
			);
		},
	);

	server.get("/contracts/render-jobs", async (request) => {
		requireCronSecret(request.headers.authorization);
		return runContractRenderJobs(CONTRACT_RENDER_JOBS_PER_INVOCATION, request);
	});
}
