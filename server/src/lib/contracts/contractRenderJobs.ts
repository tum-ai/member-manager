import {
	CONTRACT_RENDER_OPERATIONS,
	type ContractPdfAnchor,
	type ContractRenderOperation,
} from "@member-manager/shared";
import {
	BadGatewayError,
	DatabaseError,
	ServiceUnavailableError,
	ValidationError,
} from "../errors.js";
import { getSupabase } from "../supabase.js";

export interface ClaimedContractRenderJob {
	id: string;
	operation: ContractRenderOperation;
	status: "processing";
	attempt_count: number;
	max_attempts: number;
	document_version_id: string | null;
	template_document_id: string | null;
	encrypted_payload: string | null;
	leased_by: string;
	lease_token: string;
	lease_expires_at: string;
}

export interface ContractRenderArtifactOutput {
	path: string;
	sizeBytes: number;
	sha256: string;
}

export interface ContractRenderJobOutput {
	converterVersion: string;
	docx?: ContractRenderArtifactOutput | null;
	pdf?: ContractRenderArtifactOutput | null;
	preview?: ContractRenderArtifactOutput | null;
	pageCount?: number | null;
	signatureAnchors?: {
		partner: ContractPdfAnchor;
		board: ContractPdfAnchor;
	} | null;
	validationIssues?: unknown[] | null;
}

export type ContractRenderJobHandler = (
	job: ClaimedContractRenderJob,
) => Promise<ContractRenderJobOutput>;

export interface ContractRenderJobStore {
	claim(
		workerId: string,
		leaseSeconds: number,
	): Promise<ClaimedContractRenderJob | null>;
	finalize(args: {
		job: ClaimedContractRenderJob;
		succeeded: boolean;
		output?: ContractRenderJobOutput;
		errorCode?: string | null;
		errorMessage?: string | null;
	}): Promise<void>;
}

export interface ContractRenderJobProcessResult {
	claimed: number;
	succeeded: number;
	failed: number;
}

function isRenderOperation(value: unknown): value is ContractRenderOperation {
	return (
		typeof value === "string" &&
		(CONTRACT_RENDER_OPERATIONS as readonly string[]).includes(value)
	);
}

function asClaimedJob(value: unknown): ClaimedContractRenderJob {
	if (typeof value !== "object" || value === null) {
		throw new DatabaseError("Claimed contract render job is malformed");
	}
	const job = value as Record<string, unknown>;
	if (
		typeof job.id !== "string" ||
		!isRenderOperation(job.operation) ||
		job.status !== "processing" ||
		typeof job.attempt_count !== "number" ||
		typeof job.max_attempts !== "number" ||
		typeof job.leased_by !== "string" ||
		typeof job.lease_token !== "string" ||
		typeof job.lease_expires_at !== "string"
	) {
		throw new DatabaseError("Claimed contract render job is malformed");
	}
	return {
		id: job.id,
		operation: job.operation,
		status: "processing",
		attempt_count: job.attempt_count,
		max_attempts: job.max_attempts,
		document_version_id:
			typeof job.document_version_id === "string"
				? job.document_version_id
				: null,
		template_document_id:
			typeof job.template_document_id === "string"
				? job.template_document_id
				: null,
		encrypted_payload:
			typeof job.encrypted_payload === "string" ? job.encrypted_payload : null,
		leased_by: job.leased_by,
		lease_token: job.lease_token,
		lease_expires_at: job.lease_expires_at,
	};
}

export const supabaseContractRenderJobStore: ContractRenderJobStore = {
	async claim(workerId, leaseSeconds) {
		const { data, error } = await getSupabase().rpc(
			"claim_contract_render_job",
			{
				p_worker_id: workerId,
				p_lease_seconds: leaseSeconds,
			},
		);
		if (error) {
			throw new DatabaseError(
				`Failed to claim contract render job: ${error.message}`,
			);
		}
		const row = Array.isArray(data) ? data[0] : data;
		return row ? asClaimedJob(row) : null;
	},

	async finalize(args) {
		const output = args.output;
		const { error } = await getSupabase().rpc("finalize_contract_render_job", {
			p_job_id: args.job.id,
			p_lease_token: args.job.lease_token,
			p_succeeded: args.succeeded,
			p_converter_version: output?.converterVersion ?? null,
			p_docx_path: output?.docx?.path ?? null,
			p_docx_size_bytes: output?.docx?.sizeBytes ?? null,
			p_docx_sha256: output?.docx?.sha256 ?? null,
			p_pdf_path: output?.pdf?.path ?? null,
			p_pdf_size_bytes: output?.pdf?.sizeBytes ?? null,
			p_pdf_sha256: output?.pdf?.sha256 ?? null,
			p_page_count: output?.pageCount ?? null,
			p_signature_anchors: output?.signatureAnchors
				? (["partner", "board"] as const).map((role) => ({
						role,
						...output.signatureAnchors?.[role],
					}))
				: null,
			p_preview_path: output?.preview?.path ?? null,
			p_preview_size_bytes: output?.preview?.sizeBytes ?? null,
			p_preview_sha256: output?.preview?.sha256 ?? null,
			p_validation_issues: output?.validationIssues ?? [],
			p_error_code: args.errorCode ?? null,
			p_error_message: args.errorMessage ?? null,
		});
		if (error) {
			throw new DatabaseError(
				`Failed to finalize contract render job: ${error.message}`,
			);
		}
	},
};

function safeJobFailure(error: unknown): { code: string; message: string } {
	if (error instanceof ValidationError) {
		const details = error.details;
		const code =
			typeof details === "object" &&
			details !== null &&
			"code" in details &&
			typeof details.code === "string"
				? details.code
				: "CONTRACT_VALIDATION_FAILED";
		return { code, message: error.message.slice(0, 500) };
	}
	if (error instanceof ServiceUnavailableError) {
		return { code: "CONTRACT_CONVERTER_UNAVAILABLE", message: error.message };
	}
	if (error instanceof BadGatewayError) {
		return { code: "CONTRACT_CONVERSION_FAILED", message: error.message };
	}
	if (error instanceof DatabaseError) {
		return { code: "CONTRACT_STORAGE_FAILED", message: error.message };
	}
	if (error instanceof Error && error.message.trim()) {
		return {
			code: "CONTRACT_RENDER_FAILED",
			message: error.message.slice(0, 500),
		};
	}
	return {
		code: "CONTRACT_RENDER_FAILED",
		message: "Contract render job failed",
	};
}

export async function processContractRenderJobs(args: {
	workerId: string;
	handlers: Partial<Record<ContractRenderOperation, ContractRenderJobHandler>>;
	onSucceeded?: (
		job: ClaimedContractRenderJob,
		output: ContractRenderJobOutput,
	) => Promise<void>;
	maxJobs?: number;
	leaseSeconds?: number;
	store?: ContractRenderJobStore;
}): Promise<ContractRenderJobProcessResult> {
	const maxJobs = Math.max(1, Math.min(args.maxJobs ?? 3, 10));
	const leaseSeconds = Math.max(30, Math.min(args.leaseSeconds ?? 300, 900));
	const store = args.store ?? supabaseContractRenderJobStore;
	const result: ContractRenderJobProcessResult = {
		claimed: 0,
		succeeded: 0,
		failed: 0,
	};
	for (let index = 0; index < maxJobs; index++) {
		const job = await store.claim(args.workerId, leaseSeconds);
		if (!job) break;
		result.claimed++;
		const handler = args.handlers[job.operation];
		if (!handler) {
			await store.finalize({
				job,
				succeeded: false,
				errorCode: "CONTRACT_RENDER_HANDLER_MISSING",
				errorMessage: "No handler is configured for this render operation",
			});
			result.failed++;
			continue;
		}
		try {
			const output = await handler(job);
			await store.finalize({
				job,
				succeeded: true,
				output,
			});
			await args.onSucceeded?.(job, output).catch(() => undefined);
			result.succeeded++;
		} catch (error) {
			const failure = safeJobFailure(error);
			await store.finalize({
				job,
				succeeded: false,
				errorCode: failure.code,
				errorMessage: failure.message,
			});
			result.failed++;
		}
	}
	return result;
}
