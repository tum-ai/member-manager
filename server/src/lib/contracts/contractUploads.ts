import { MAX_CONTRACT_DOCX_BYTES } from "@member-manager/shared";
import { DatabaseError, ValidationError } from "../errors.js";
import { getSupabase } from "../supabase.js";
import { assertContractArtifactLocation } from "./contractArtifactStorage.js";
import { assertContractDocxMimeType } from "./contractDocx.js";

export interface ContractUploadTicket {
	bucket: string;
	path: string;
	token: string;
	signed_url: string;
}

const MAX_CONTRACT_DOCX_MB = Math.floor(
	MAX_CONTRACT_DOCX_BYTES / (1024 * 1024),
);

export function assertContractDocxSize(sizeBytes: unknown): void {
	if (
		typeof sizeBytes !== "number" ||
		!Number.isInteger(sizeBytes) ||
		sizeBytes <= 0 ||
		sizeBytes > MAX_CONTRACT_DOCX_BYTES
	) {
		throw new ValidationError(
			`The DOCX file must be ${MAX_CONTRACT_DOCX_MB} MB or smaller.`,
		);
	}
}

// A ticket is minted for one exact path. Checking the path back against the
// template or submission it belongs to is what stops a caller taking a ticket
// issued for one record and claiming the object against another.
export function assertUploadBelongsTo(prefix: string, path: string): void {
	if (!path.startsWith(`${prefix}/`)) {
		throw new ValidationError("Upload does not belong to this record.");
	}
}

/**
 * Mints a signed upload URL for the artifact's final location. The browser PUTs
 * straight there, so the bytes never enter a function request body, which is
 * capped at 4.5 MB per invocation.
 */
export async function createContractUploadUrl(args: {
	bucket: string;
	path: string;
	mimeType: string;
	sizeBytes: number;
}): Promise<ContractUploadTicket> {
	assertContractArtifactLocation(args.bucket, args.path);
	assertContractDocxMimeType(args.mimeType);
	assertContractDocxSize(args.sizeBytes);

	const { data, error } = await getSupabase()
		.storage.from(args.bucket)
		.createSignedUploadUrl(args.path);
	if (error || !data?.token || !data?.signedUrl) {
		throw new DatabaseError(
			`Failed to create contract upload URL: ${error?.message ?? "no url"}`,
		);
	}
	return {
		bucket: args.bucket,
		path: data.path ?? args.path,
		token: data.token,
		signed_url: data.signedUrl,
	};
}

/**
 * Reads back what the browser actually uploaded. The size declared when the
 * ticket was minted is advisory, since nothing stops the client PUTting
 * something else afterwards; the bucket's `file_size_limit` is the hard ceiling
 * and this covers everything under it.
 */
export async function downloadUploadedDocx(args: {
	bucket: string;
	path: string;
}): Promise<Buffer> {
	assertContractArtifactLocation(args.bucket, args.path);
	const { data, error } = await getSupabase()
		.storage.from(args.bucket)
		.download(args.path);
	if (error || !data) {
		throw new ValidationError(
			"Upload was not found. Please choose the file again.",
		);
	}
	const buffer = Buffer.from(await data.arrayBuffer());
	assertContractDocxSize(buffer.length);
	return buffer;
}

// A rejected upload leaves an object behind that no row references, so the
// route that rejects it is responsible for clearing it.
export async function removeUploadedDocx(args: {
	bucket: string;
	path: string;
}): Promise<void> {
	await getSupabase()
		.storage.from(args.bucket)
		.remove([args.path])
		.catch(() => undefined);
}
