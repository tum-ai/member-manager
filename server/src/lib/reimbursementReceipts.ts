import { randomUUID } from "node:crypto";
import { DatabaseError, ValidationError } from "./errors.js";
import { getSupabase } from "./supabase.js";

export const REIMBURSEMENT_RECEIPT_BUCKET = "reimbursement-receipts";
export const MAX_REIMBURSEMENT_RECEIPT_BYTES = 10 * 1024 * 1024;
export const MAX_REIMBURSEMENT_RECEIPT_MB = 10;

export const ALLOWED_REIMBURSEMENT_RECEIPT_MIME_TYPES = new Set([
	"application/pdf",
	"image/jpeg",
	"image/jpg",
	"image/png",
]);

const PDF_MAGIC = Buffer.from("%PDF-");
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface ReceiptUploadUrl {
	bucket: string;
	path: string;
	token: string;
	signed_url: string;
}

export function stripReceiptDataUrlPrefix(value: string): string {
	const match = /^data:[^;,]*;base64,/.exec(value);
	return match ? value.slice(match[0].length) : value;
}

export function estimateBase64Bytes(value: string): number {
	return (value.length * 3) / 4;
}

export function detectReceiptMimeType(buffer: Buffer): string | null {
	if (buffer.length >= PDF_MAGIC.length) {
		const head = buffer.subarray(0, PDF_MAGIC.length);
		if (head.equals(PDF_MAGIC)) return "application/pdf";
	}
	if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
		return "image/png";
	}
	if (
		buffer.length >= 3 &&
		buffer[0] === 0xff &&
		buffer[1] === 0xd8 &&
		buffer[2] === 0xff
	) {
		return "image/jpeg";
	}
	return null;
}

export function assertValidReceiptBuffer(
	buffer: Buffer,
	expectedMimeType?: string | null,
): void {
	if (buffer.length === 0) {
		throw new ValidationError("Receipt file is empty");
	}
	if (buffer.length > MAX_REIMBURSEMENT_RECEIPT_BYTES) {
		throw new ValidationError(
			`Receipt file is too large (max ${MAX_REIMBURSEMENT_RECEIPT_MB} MB)`,
		);
	}

	const detectedMimeType = detectReceiptMimeType(buffer);
	if (!detectedMimeType) {
		throw new ValidationError("Upload a PDF, JPG, or PNG receipt.");
	}

	if (
		expectedMimeType &&
		expectedMimeType !== "image/jpg" &&
		detectedMimeType !== expectedMimeType
	) {
		throw new ValidationError("Receipt file type does not match the upload.");
	}
}

export function decodeReceiptBase64(
	base64: string,
	expectedMimeType?: string | null,
): Buffer {
	const buffer = Buffer.from(stripReceiptDataUrlPrefix(base64), "base64");
	assertValidReceiptBuffer(buffer, expectedMimeType);
	return buffer;
}

export function sanitizeReceiptStorageFilename(value: string): string {
	const cleaned = value
		.trim()
		.replace(/[/\\?%*:|"<>]/g, "")
		.replace(/[^\w.\- ]+/g, "")
		.replace(/\s+/g, "_")
		.slice(0, 180);

	return cleaned || "receipt";
}

function extensionForMimeType(mimeType: string): string {
	if (mimeType === "application/pdf") return "pdf";
	if (mimeType === "image/png") return "png";
	return "jpg";
}

export function receiptStoragePath({
	userId,
	filename,
	mimeType,
}: {
	userId: string;
	filename: string;
	mimeType: string;
}): string {
	const safeFilename = sanitizeReceiptStorageFilename(filename);
	const extension = extensionForMimeType(mimeType);
	const filenameWithExtension = safeFilename
		.toLowerCase()
		.endsWith(`.${extension}`)
		? safeFilename
		: `${safeFilename}.${extension}`;

	return `${userId}/${randomUUID()}-${filenameWithExtension}`;
}

export function assertOwnedReceiptStoragePath(
	userId: string,
	path: string,
): void {
	if (!path.startsWith(`${userId}/`)) {
		throw new ValidationError("Receipt upload does not belong to this user.");
	}
}

export async function createReceiptUploadUrl({
	userId,
	filename,
	mimeType,
	sizeBytes,
}: {
	userId: string;
	filename: string;
	mimeType: string;
	sizeBytes: number;
}): Promise<ReceiptUploadUrl> {
	if (!ALLOWED_REIMBURSEMENT_RECEIPT_MIME_TYPES.has(mimeType)) {
		throw new ValidationError("Upload a PDF, JPG, or PNG receipt.");
	}
	if (
		!Number.isInteger(sizeBytes) ||
		sizeBytes <= 0 ||
		sizeBytes > MAX_REIMBURSEMENT_RECEIPT_BYTES
	) {
		throw new ValidationError(
			`Receipt file is too large (max ${MAX_REIMBURSEMENT_RECEIPT_MB} MB)`,
		);
	}

	const path = receiptStoragePath({ userId, filename, mimeType });
	const { data, error } = await getSupabase()
		.storage.from(REIMBURSEMENT_RECEIPT_BUCKET)
		.createSignedUploadUrl(path);

	if (error || !data?.token || !data?.signedUrl) {
		throw new DatabaseError(
			`Failed to create receipt upload URL: ${error?.message ?? "no url"}`,
		);
	}

	return {
		bucket: REIMBURSEMENT_RECEIPT_BUCKET,
		path: data.path ?? path,
		token: data.token,
		signed_url: data.signedUrl,
	};
}

export async function downloadStoredReceipt({
	bucket,
	path,
	expectedMimeType,
}: {
	bucket: string;
	path: string;
	expectedMimeType?: string | null;
}): Promise<Buffer> {
	if (bucket !== REIMBURSEMENT_RECEIPT_BUCKET) {
		throw new ValidationError("Unsupported receipt storage bucket.");
	}

	const { data, error } = await getSupabase()
		.storage.from(bucket)
		.download(path);
	if (error || !data) {
		throw new DatabaseError(
			`Failed to download receipt object: ${error?.message ?? "no data"}`,
		);
	}

	const buffer = Buffer.from(await data.arrayBuffer());
	assertValidReceiptBuffer(buffer, expectedMimeType);
	return buffer;
}

export async function createReceiptSignedUrl({
	bucket,
	path,
	download,
}: {
	bucket: string;
	path: string;
	download?: string | boolean;
}): Promise<string> {
	if (bucket !== REIMBURSEMENT_RECEIPT_BUCKET) {
		throw new ValidationError("Unsupported receipt storage bucket.");
	}

	const { data, error } = await getSupabase()
		.storage.from(bucket)
		.createSignedUrl(path, 60 * 10, { download });
	if (error || !data?.signedUrl) {
		throw new DatabaseError(
			`Failed to create receipt URL: ${error?.message ?? "no url"}`,
		);
	}

	return data.signedUrl;
}

export async function removeStoredReceipt({
	bucket,
	path,
}: {
	bucket: string;
	path: string;
}): Promise<void> {
	if (bucket !== REIMBURSEMENT_RECEIPT_BUCKET) {
		return;
	}
	await getSupabase().storage.from(bucket).remove([path]);
}
