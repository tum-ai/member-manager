import { createHash, randomUUID } from "node:crypto";
import { ConflictError, DatabaseError, ValidationError } from "./errors.js";
import { getSupabase } from "./supabase.js";

// Member CVs are immutable and versioned. Files live in a private Supabase
// Storage bucket; this module owns the storage + metadata interplay so routes
// stay thin. See docs/member-cvs.md.

export const CV_BUCKET = "member-cvs";
export const CV_MIME_TYPE = "application/pdf";
export const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MiB, mirrors the DB + bucket.
const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes for internal export.

export type CvSource = "application" | "member_upload" | "admin_upload";

export interface MemberCvRow {
	id: string;
	user_id: string;
	storage_bucket: string;
	storage_path: string;
	original_filename: string;
	mime_type: string;
	size_bytes: number;
	sha256: string;
	source: CvSource;
	version: number;
	is_current: boolean;
	uploaded_at: string;
	uploaded_by_user_id: string | null;
	supersedes_cv_id: string | null;
	revoked_at: string | null;
	created_at: string;
}

const PDF_MAGIC = Buffer.from("%PDF-");

// Validate that a buffer is a non-empty, within-limit PDF. We sniff the magic
// bytes rather than trusting a client-supplied MIME type.
export function assertValidCvPdf(buffer: Buffer): void {
	if (buffer.length === 0) {
		throw new ValidationError("CV file is empty");
	}
	if (buffer.length > MAX_CV_BYTES) {
		throw new ValidationError(
			`CV file is too large (max ${Math.floor(MAX_CV_BYTES / (1024 * 1024))} MB)`,
		);
	}
	if (!buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
		throw new ValidationError("CV must be a PDF file");
	}
}

export function sha256Hex(buffer: Buffer): string {
	return createHash("sha256").update(buffer).digest("hex");
}

export function sanitizeCvFilename(value: string): string {
	const cleaned = value
		.trim()
		.replace(/[/\\?%*:|"<>]/g, "")
		.replace(/[^\w.\- ]+/g, "")
		.replace(/\s+/g, "_")
		.slice(0, 255);
	if (!cleaned) {
		return "cv.pdf";
	}
	return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

export function cvStoragePath(userId: string, cvId: string): string {
	return `${userId}/${cvId}.pdf`;
}

export async function getCurrentCv(
	userId: string,
): Promise<MemberCvRow | null> {
	const { data, error } = await getSupabase()
		.from("member_cvs")
		.select("*")
		.eq("user_id", userId)
		.eq("is_current", true)
		.is("revoked_at", null)
		.maybeSingle();
	if (error) {
		throw new DatabaseError(`Failed to read current CV: ${error.message}`);
	}
	return (data as MemberCvRow | null) ?? null;
}

// Batch variant of getCurrentCv for export-style fan-outs: one query for many
// members instead of N. Returns a map keyed by user_id; members without a
// current, non-revoked CV are simply absent.
export async function getCurrentCvsForUsers(
	userIds: string[],
): Promise<Map<string, MemberCvRow>> {
	const result = new Map<string, MemberCvRow>();
	if (userIds.length === 0) {
		return result;
	}
	const { data, error } = await getSupabase()
		.from("member_cvs")
		.select("*")
		.in("user_id", userIds)
		.eq("is_current", true)
		.is("revoked_at", null);
	if (error) {
		throw new DatabaseError(`Failed to read current CVs: ${error.message}`);
	}
	for (const row of (data ?? []) as MemberCvRow[]) {
		result.set(row.user_id, row);
	}
	return result;
}

export async function downloadCvObject(row: MemberCvRow): Promise<Buffer> {
	const { data, error } = await getSupabase()
		.storage.from(row.storage_bucket)
		.download(row.storage_path);
	if (error || !data) {
		throw new DatabaseError(
			`Failed to download CV object: ${error?.message ?? "no data"}`,
		);
	}
	return Buffer.from(await data.arrayBuffer());
}

export async function createCvSignedUrl(row: MemberCvRow): Promise<string> {
	const { data, error } = await getSupabase()
		.storage.from(row.storage_bucket)
		.createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
	if (error || !data?.signedUrl) {
		throw new DatabaseError(
			`Failed to create signed CV URL: ${error?.message ?? "no url"}`,
		);
	}
	return data.signedUrl;
}

export interface AddCvVersionInput {
	userId: string;
	buffer: Buffer;
	originalFilename: string;
	source: CvSource;
	uploadedByUserId: string | null;
}

// Insert a new CV version. The immutable object is uploaded to storage first
// (named by the new row id); the metadata flip — read version, demote the old
// current row, insert the new current row — is then performed atomically by
// the insert_member_cv_version RPC, which serializes concurrent uploads for
// the same member with a per-user advisory lock. If the RPC fails, the whole
// metadata change rolls back (the previous current CV is preserved) and the
// orphan object is best-effort removed.
export async function addCvVersion(
	input: AddCvVersionInput,
): Promise<MemberCvRow> {
	assertValidCvPdf(input.buffer);
	const supabase = getSupabase();

	const cvId = randomUUID();
	const storagePath = cvStoragePath(input.userId, cvId);

	const { error: uploadError } = await supabase.storage
		.from(CV_BUCKET)
		.upload(storagePath, input.buffer, {
			contentType: CV_MIME_TYPE,
			upsert: false,
		});
	if (uploadError) {
		throw new DatabaseError(`Failed to upload CV: ${uploadError.message}`);
	}

	const { data: inserted, error: insertError } = await supabase
		.rpc("insert_member_cv_version", {
			p_id: cvId,
			p_user_id: input.userId,
			p_storage_bucket: CV_BUCKET,
			p_storage_path: storagePath,
			p_original_filename: sanitizeCvFilename(input.originalFilename),
			p_mime_type: CV_MIME_TYPE,
			p_size_bytes: input.buffer.length,
			p_sha256: sha256Hex(input.buffer),
			p_source: input.source,
			p_uploaded_by_user_id: input.uploadedByUserId,
		})
		.single();
	if (insertError || !inserted) {
		await supabase.storage.from(CV_BUCKET).remove([storagePath]);
		if ((insertError as { code?: string } | null)?.code === "23505") {
			throw new ConflictError("A newer CV version already exists. Retry.");
		}
		throw new DatabaseError(
			`Failed to record CV version: ${insertError?.message ?? "no row"}`,
		);
	}

	return inserted as MemberCvRow;
}
