import { randomUUID } from "node:crypto";
import {
	CONTRACT_DOCX_MIME_TYPE,
	CONTRACT_RENDER_ARTIFACT_BUCKET,
	CONTRACT_TEMPLATE_DOCUMENT_BUCKET,
	type ContractPdfAnchor,
	type ContractRenderOperation,
} from "@member-manager/shared";
import { waitUntil } from "@vercel/functions";
import { ValidationError } from "../errors.js";
import { downloadOpenSignPdf } from "../openSign.js";
import { getSupabase } from "../supabase.js";
import {
	decryptContractJson,
	encryptContractJson,
} from "./contractArtifactCrypto.js";
import {
	downloadContractArtifact,
	uploadContractArtifact,
} from "./contractArtifactStorage.js";
import {
	convertContractDocxToPdf,
	getContractConverterVersion,
} from "./contractConverter.js";
import { fillContractDocx, inspectFilledContractDocx } from "./contractDocx.js";
import { maybeAutoSendAfterBoardSign } from "./contractFinalization.js";
import {
	decodeContractSignatureDataUrl,
	findContractPdfSignatureAnchors,
	getContractPdfPageCount,
	stampContractPdfSignature,
} from "./contractPdfAnchors.js";
import {
	type ClaimedContractRenderJob,
	type ContractRenderJobHandler,
	processContractRenderJobs,
} from "./contractRenderJobs.js";
import { recordStatusEvent } from "./contractWorkflow.js";

type ContractSignatureAnchors = {
	partner: ContractPdfAnchor;
	board: ContractPdfAnchor;
};

export const CONTRACT_RENDER_JOBS_PER_INVOCATION = 2;

let localRetryTimer: ReturnType<typeof setTimeout> | null = null;

type RenderPayload =
	| {
			kind: "submission_render";
			sourceDocx?: {
				bucket: string;
				path: string;
				sha256: string;
			};
	  }
	| {
			kind: "partner_signature" | "board_signature";
			signatureData: string;
	  }
	| {
			kind: "opensign_ingest";
			fileUrl: string;
	  }
	| { kind: "template_preview" };

function asRecord(value: unknown): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new ValidationError("Contract render payload is malformed");
	}
	return value as Record<string, unknown>;
}

function parsePayload(job: ClaimedContractRenderJob): RenderPayload {
	if (!job.encrypted_payload) {
		throw new ValidationError("Contract render payload is missing");
	}
	const payload = asRecord(decryptContractJson<unknown>(job.encrypted_payload));
	if (payload.kind !== job.operation) {
		throw new ValidationError("Contract render payload does not match its job");
	}
	return payload as RenderPayload;
}

function parseAnchor(value: unknown): ContractPdfAnchor {
	const record = asRecord(value);
	const anchor = {
		page: Number(record.page),
		x: Number(record.x),
		y: Number(record.y),
		width: Number(record.width),
		height: Number(record.height),
	};
	if (
		!Number.isInteger(anchor.page) ||
		anchor.page < 1 ||
		![anchor.x, anchor.y, anchor.width, anchor.height].every(Number.isFinite) ||
		anchor.width <= 0 ||
		anchor.height <= 0
	) {
		throw new ValidationError("Stored contract signature anchor is invalid");
	}
	return anchor;
}

export function parseStoredContractSignatureAnchors(
	value: unknown,
): ContractSignatureAnchors {
	if (!Array.isArray(value)) {
		throw new ValidationError("Stored contract signature anchors are missing");
	}
	const byRole = new Map<string, ContractPdfAnchor>();
	for (const entry of value) {
		const record = asRecord(entry);
		if (record.role === "partner" || record.role === "board") {
			if (byRole.has(record.role)) {
				throw new ValidationError(
					"Stored contract signature anchor is duplicated",
				);
			}
			byRole.set(record.role, parseAnchor(record));
		}
	}
	const partner = byRole.get("partner");
	const board = byRole.get("board");
	if (!partner || !board) {
		throw new ValidationError(
			"Stored contract signature anchors are incomplete",
		);
	}
	return { partner, board };
}

function toStoredAnchors(anchors: ContractSignatureAnchors) {
	return (["partner", "board"] as const).map((role) => ({
		role,
		...anchors[role],
	}));
}

async function fetchSingle(
	table: string,
	id: string,
): Promise<Record<string, unknown>> {
	const { data, error } = await getSupabase()
		.from(table)
		.select("*")
		.eq("id", id)
		.single();
	if (error || !data) throw error ?? new Error(`${table} row is missing`);
	return data as Record<string, unknown>;
}

async function downloadArtifactFromRow(
	row: Record<string, unknown>,
	prefix: "source" | "docx" | "pdf" | "preview",
): Promise<Buffer> {
	const bucket = row[`${prefix}_bucket`];
	const path = row[`${prefix}_path`];
	const sha256 = row[`${prefix}_sha256`];
	if (typeof bucket !== "string" || typeof path !== "string") {
		throw new ValidationError(`Stored contract ${prefix} is not ready`);
	}
	return downloadContractArtifact({
		bucket,
		path,
		expectedSha256: typeof sha256 === "string" ? sha256 : null,
	});
}

async function renderTemplatePreview(job: ClaimedContractRenderJob) {
	parsePayload(job);
	if (!job.template_document_id) {
		throw new ValidationError("Template render job has no document");
	}
	const document = await fetchSingle(
		"contract_template_documents",
		job.template_document_id,
	);
	const template = await downloadArtifactFromRow(document, "source");
	const manifest = asRecord(document.placeholder_manifest);
	const variables = Array.isArray(manifest.variables)
		? manifest.variables.filter(
				(value): value is string => typeof value === "string",
			)
		: [];
	const formData = Object.fromEntries(variables.map((name) => [name, ""]));
	const filled = await fillContractDocx({ template, formData });
	await inspectFilledContractDocx(filled.docx);
	const pdf = await convertContractDocxToPdf(filled.docx);
	const signatureAnchors = await findContractPdfSignatureAnchors(pdf);
	const templateId = String(document.template_id);
	const preview = await uploadContractArtifact({
		bucket: CONTRACT_RENDER_ARTIFACT_BUCKET,
		path: `${templateId}/${job.template_document_id}/preview.pdf`,
		plaintext: pdf,
		contentType: "application/pdf",
	});
	return {
		converterVersion: getContractConverterVersion(),
		preview,
		pageCount: await getContractPdfPageCount(pdf),
		signatureAnchors,
		validationIssues: [],
	};
}

async function renderSubmission(job: ClaimedContractRenderJob) {
	const payload = parsePayload(job);
	if (payload.kind !== "submission_render" || !job.document_version_id) {
		throw new ValidationError("Submission render job is malformed");
	}
	const version = await fetchSingle(
		"contract_document_versions",
		job.document_version_id,
	);
	const submissionId = String(version.submission_id);
	let docx: Buffer;
	if (payload.sourceDocx) {
		docx = await downloadContractArtifact({
			bucket: payload.sourceDocx.bucket,
			path: payload.sourceDocx.path,
			expectedSha256: payload.sourceDocx.sha256,
		});
		await inspectFilledContractDocx(docx);
	} else {
		const templateDocumentId = version.template_document_id;
		if (typeof templateDocumentId !== "string") {
			throw new ValidationError("Submission has no pinned DOCX template");
		}
		const templateDocument = await fetchSingle(
			"contract_template_documents",
			templateDocumentId,
		);
		const template = await downloadArtifactFromRow(templateDocument, "source");
		if (typeof version.form_data_snapshot_encrypted !== "string") {
			throw new ValidationError("Submission form data snapshot is missing");
		}
		const formData = asRecord(
			decryptContractJson(version.form_data_snapshot_encrypted),
		);
		docx = (
			await fillContractDocx({
				template,
				formData,
			})
		).docx;
		await inspectFilledContractDocx(docx);
	}
	const pdf = await convertContractDocxToPdf(docx);
	const signatureAnchors = await findContractPdfSignatureAnchors(pdf);
	const basePath = `${submissionId}/${job.document_version_id}`;
	const [storedDocx, storedPdf] = await Promise.all([
		uploadContractArtifact({
			bucket: CONTRACT_RENDER_ARTIFACT_BUCKET,
			path: `${basePath}/document.docx`,
			plaintext: docx,
			contentType: CONTRACT_DOCX_MIME_TYPE,
		}),
		uploadContractArtifact({
			bucket: CONTRACT_RENDER_ARTIFACT_BUCKET,
			path: `${basePath}/document.pdf`,
			plaintext: pdf,
			contentType: "application/pdf",
		}),
	]);
	return {
		converterVersion: getContractConverterVersion(),
		docx: storedDocx,
		pdf: storedPdf,
		pageCount: await getContractPdfPageCount(pdf),
		signatureAnchors,
		validationIssues: [],
	};
}

async function renderSignature(
	job: ClaimedContractRenderJob,
	role: "partner" | "board",
) {
	const payload = parsePayload(job);
	if (payload.kind !== `${role}_signature` || !job.document_version_id) {
		throw new ValidationError("Signature render job is malformed");
	}
	if (!("signatureData" in payload)) {
		throw new ValidationError("Signature render payload is incomplete");
	}
	const version = await fetchSingle(
		"contract_document_versions",
		job.document_version_id,
	);
	if (typeof version.parent_document_version_id !== "string") {
		throw new ValidationError("Signature render job has no source version");
	}
	const parent = await fetchSingle(
		"contract_document_versions",
		version.parent_document_version_id,
	);
	const pdf = await downloadArtifactFromRow(parent, "pdf");
	const anchors = parseStoredContractSignatureAnchors(parent.signature_anchors);
	const stamped = await stampContractPdfSignature({
		pdf,
		signaturePng: decodeContractSignatureDataUrl(payload.signatureData),
		role,
		trustedAnchor: anchors[role],
	});
	const path = `${String(version.submission_id)}/${job.document_version_id}/document.pdf`;
	const storedPdf = await uploadContractArtifact({
		bucket: CONTRACT_RENDER_ARTIFACT_BUCKET,
		path,
		plaintext: stamped.pdf,
		contentType: "application/pdf",
	});
	return {
		converterVersion: "pdf-lib-signature-v1",
		pdf: storedPdf,
		pageCount: await getContractPdfPageCount(stamped.pdf),
		signatureAnchors: anchors,
		validationIssues: [],
	};
}

async function ingestOpenSignPdf(job: ClaimedContractRenderJob) {
	const payload = parsePayload(job);
	if (payload.kind !== "opensign_ingest" || !job.document_version_id) {
		throw new ValidationError("OpenSign render job is malformed");
	}
	const version = await fetchSingle(
		"contract_document_versions",
		job.document_version_id,
	);
	if (
		typeof payload.fileUrl !== "string" ||
		typeof version.parent_document_version_id !== "string"
	) {
		throw new ValidationError("OpenSign render payload is incomplete");
	}
	const parent = await fetchSingle(
		"contract_document_versions",
		version.parent_document_version_id,
	);
	const anchors = parseStoredContractSignatureAnchors(parent.signature_anchors);
	const pdf = await downloadOpenSignPdf(payload.fileUrl);
	const storedPdf = await uploadContractArtifact({
		bucket: CONTRACT_RENDER_ARTIFACT_BUCKET,
		path: `${String(version.submission_id)}/${job.document_version_id}/document.pdf`,
		plaintext: pdf,
		contentType: "application/pdf",
	});
	return {
		converterVersion: "opensign-ingest-v1",
		pdf: storedPdf,
		pageCount: await getContractPdfPageCount(pdf),
		signatureAnchors: anchors,
		validationIssues: [],
	};
}

export const contractRenderJobHandlers: Partial<
	Record<ContractRenderOperation, ContractRenderJobHandler>
> = {
	template_preview: renderTemplatePreview,
	submission_render: renderSubmission,
	partner_signature: (job) => renderSignature(job, "partner"),
	board_signature: (job) => renderSignature(job, "board"),
	opensign_ingest: ingestOpenSignPdf,
};

type ContractRenderRequestContext = {
	headers: Record<string, unknown>;
	log: {
		error: (value: unknown, message: string) => void;
		warn: (value: unknown, message: string) => void;
	};
};

export async function runContractRenderJobs(
	maxJobs = 3,
	request?: ContractRenderRequestContext,
) {
	return processContractRenderJobs({
		workerId: `contract-worker-${randomUUID()}`,
		handlers: contractRenderJobHandlers,
		maxJobs,
		onSucceeded: async (job) => {
			const transition =
				job.operation === "partner_signature" ||
				job.operation === "opensign_ingest"
					? { from: "sent_to_partner", to: "partner_signed" }
					: job.operation === "board_signature"
						? { from: "partner_signed", to: "board_signed" }
						: null;
			if (!transition || !job.document_version_id) return;
			const version = await fetchSingle(
				"contract_document_versions",
				job.document_version_id,
			);
			const submission = await fetchSingle(
				"contract_submissions",
				String(version.submission_id),
			);
			await recordStatusEvent({
				submissionId: String(version.submission_id),
				fromStatus: transition.from,
				toStatus: transition.to,
				changedBy: null,
				changedByName:
					job.operation === "board_signature"
						? String(submission.admin_signer_name ?? "Board")
						: String(submission.signer_name ?? "Partner"),
			});
			if (job.operation === "board_signature" && request) {
				await maybeAutoSendAfterBoardSign({
					request,
					submissionId: String(version.submission_id),
				});
			}
		},
	});
}

export function dispatchContractRenderJobs(
	request: ContractRenderRequestContext,
): void {
	const task = runContractRenderJobs(
		CONTRACT_RENDER_JOBS_PER_INVOCATION,
		request,
	)
		.then((result) => {
			if (process.env.VERCEL !== "1" && result.failed > 0) {
				scheduleLocalContractRenderRetry(request);
			}
		})
		.catch((error) => {
			request.log.error({ err: error }, "Background contract rendering failed");
		});
	if (process.env.VERCEL === "1") {
		waitUntil(task);
	}
}

function scheduleLocalContractRenderRetry(
	request: ContractRenderRequestContext,
): void {
	if (localRetryTimer) return;
	localRetryTimer = setTimeout(() => {
		localRetryTimer = null;
		dispatchContractRenderJobs(request);
	}, 6_000);
	localRetryTimer.unref?.();
}

export async function enqueueContractRenderJob(args: {
	operation: ContractRenderOperation;
	templateDocumentId?: string | null;
	submissionId?: string | null;
	documentVersionId?: string | null;
	payload: RenderPayload;
	idempotencyKey?: string;
}): Promise<Record<string, unknown>> {
	const { data, error } = await getSupabase()
		.from("contract_render_jobs")
		.insert({
			operation: args.operation,
			template_document_id: args.templateDocumentId ?? null,
			submission_id: args.submissionId ?? null,
			document_version_id: args.documentVersionId ?? null,
			encrypted_payload: encryptContractJson(args.payload),
			idempotency_key: args.idempotencyKey ?? randomUUID(),
		})
		.select("*")
		.single();
	if (error) throw error;
	return data as Record<string, unknown>;
}

export async function insertDocxDocumentVersion(args: {
	submissionId: string;
	source:
		| "draft"
		| "generated"
		| "legal_review"
		| "sent_to_partner"
		| "partner_signed"
		| "board_signed"
		| "final";
	formDataEncrypted: string;
	createdBy?: string | null;
	parentDocumentVersionId?: string | null;
	resetForLegalReview?: boolean;
	id?: string;
}): Promise<Record<string, unknown>> {
	const id = args.id ?? randomUUID();
	const { data, error } = await getSupabase().rpc(
		"insert_contract_document_version",
		{
			p_submission_id: args.submissionId,
			p_source: args.source,
			p_form_data_snapshot_encrypted: args.formDataEncrypted,
			p_created_by: args.createdBy ?? null,
			p_parent_document_version_id: args.parentDocumentVersionId ?? null,
			p_reset_for_legal_review: args.resetForLegalReview ?? false,
			p_id: id,
		},
	);
	if (error) throw error;
	return data as Record<string, unknown>;
}

export async function getDocxReadiness() {
	const supabase = getSupabase();
	const [settings, templates, documents, jobs, legacySubmissions] =
		await Promise.all([
			supabase
				.from("contract_pipeline_settings")
				.select("new_submission_engine")
				.eq("singleton", true)
				.single(),
			supabase
				.from("contract_templates")
				.select("id, is_active, renderer_engine, active_document_id")
				.eq("is_active", true),
			supabase.from("contract_template_documents").select("id, status"),
			supabase.from("contract_render_jobs").select("status"),
			supabase
				.from("contract_submissions")
				.select("id", { count: "exact", head: true })
				.eq("renderer_engine", "legacy_text"),
		]);
	for (const result of [
		settings,
		templates,
		documents,
		jobs,
		legacySubmissions,
	]) {
		if (result.error) throw result.error;
	}
	const templateRows = templates.data ?? [];
	const documentRows = documents.data ?? [];
	const documentById = new Map(documentRows.map((row) => [row.id, row]));
	const missing = templateRows.filter((template) => {
		if (typeof template.active_document_id !== "string") return true;
		return documentById.get(template.active_document_id)?.status !== "ready";
	});
	const reasons = missing.map(
		() => "An active template does not have a ready DOCX version.",
	);
	const jobRows = jobs.data ?? [];
	return {
		enabled: settings.data?.new_submission_engine === "docx",
		ready: missing.length === 0,
		active_docx_templates: templateRows.length - missing.length,
		legacy_templates: missing.length,
		pending_template_documents: documentRows.filter((row) =>
			["queued", "processing"].includes(row.status),
		).length,
		failed_template_documents: documentRows.filter(
			(row) => row.status === "failed",
		).length,
		pending_render_jobs: jobRows.filter((row) =>
			["queued", "processing"].includes(row.status),
		).length,
		failed_render_jobs: jobRows.filter((row) => row.status === "failed").length,
		legacy_submissions_without_pdf: legacySubmissions.count ?? 0,
		reasons: [...new Set(reasons)],
	};
}

export async function getDocumentStatus(
	versionId: unknown,
): Promise<string | null> {
	if (typeof versionId !== "string") return null;
	const { data, error } = await getSupabase()
		.from("contract_document_versions")
		.select("artifact_status")
		.eq("id", versionId)
		.maybeSingle();
	if (error) throw error;
	return typeof data?.artifact_status === "string"
		? data.artifact_status
		: null;
}

export async function hydrateDocxSubmission(
	row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	if (row.renderer_engine !== "docx") return row;
	const hydrated = { ...row };
	if (typeof hydrated.form_data_encrypted === "string") {
		hydrated.form_data = decryptContractJson(hydrated.form_data_encrypted);
	}
	delete hydrated.form_data_encrypted;
	hydrated.document_status = await getDocumentStatus(
		hydrated.active_document_version_id,
	);
	return hydrated;
}

export async function getReadyDocxVersion(
	versionId: unknown,
): Promise<Record<string, unknown>> {
	if (typeof versionId !== "string") {
		throw new ValidationError("Contract document is not ready");
	}
	const version = await fetchSingle("contract_document_versions", versionId);
	if (
		version.renderer_engine !== "docx" ||
		version.artifact_status !== "ready"
	) {
		throw new ValidationError("Contract document is not ready");
	}
	return version;
}

export async function downloadReadyVersionPdf(
	versionId: unknown,
): Promise<Buffer> {
	return downloadArtifactFromRow(await getReadyDocxVersion(versionId), "pdf");
}

export async function downloadReadyVersionDocx(
	versionId: unknown,
): Promise<Buffer> {
	return downloadArtifactFromRow(await getReadyDocxVersion(versionId), "docx");
}

export async function downloadTemplatePreviewPdf(
	templateDocumentId: string,
): Promise<Buffer> {
	const document = await fetchSingle(
		"contract_template_documents",
		templateDocumentId,
	);
	if (document.status !== "ready") {
		throw new ValidationError("Template preview is not ready");
	}
	return downloadArtifactFromRow(document, "preview");
}

export async function createTemplateDocumentRecord(args: {
	templateId: string;
	documentId: string;
	sourcePath: string;
	sourceSizeBytes: number;
	sourceSha256: string;
	originalFilename: string;
	placeholderManifest: Record<string, unknown>;
	uploadedByUserId: string;
}) {
	const { data, error } = await getSupabase().rpc(
		"create_contract_template_document_version",
		{
			p_template_id: args.templateId,
			p_source_path: args.sourcePath,
			p_source_size_bytes: args.sourceSizeBytes,
			p_source_sha256: args.sourceSha256,
			p_original_filename: args.originalFilename,
			p_placeholder_manifest: args.placeholderManifest,
			p_signature_anchors: ["partner", "board"],
			p_uploaded_by_user_id: args.uploadedByUserId,
			p_id: args.documentId,
		},
	);
	if (error) throw error;
	return data as Record<string, unknown>;
}

export async function storeTemplateSource(args: {
	templateId: string;
	documentId: string;
	docx: Buffer;
}) {
	return uploadContractArtifact({
		bucket: CONTRACT_TEMPLATE_DOCUMENT_BUCKET,
		path: `${args.templateId}/${args.documentId}/source.docx`,
		plaintext: args.docx,
		contentType: CONTRACT_DOCX_MIME_TYPE,
	});
}

export async function storeSubmissionDocxSource(args: {
	submissionId: string;
	versionId: string;
	docx: Buffer;
}) {
	return uploadContractArtifact({
		bucket: CONTRACT_RENDER_ARTIFACT_BUCKET,
		path: `${args.submissionId}/${args.versionId}/document.docx`,
		plaintext: args.docx,
		contentType: CONTRACT_DOCX_MIME_TYPE,
	});
}

export function encryptedContractFormData(value: Record<string, unknown>) {
	return encryptContractJson(value);
}

export function anchorsForOpenSign(
	anchors: ContractSignatureAnchors,
	pageHeight: number,
) {
	const anchor = anchors.partner;
	return [
		{
			type: "signature",
			page: anchor.page,
			x: anchor.x,
			y: pageHeight - anchor.y - anchor.height,
			w: anchor.width,
			h: anchor.height,
			options: { hint: "Provide signature" },
		},
	];
}

export const __testing = {
	parsePayload,
	toStoredAnchors,
};
