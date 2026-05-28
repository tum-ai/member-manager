import { createHash, randomUUID } from "node:crypto";
import { ConflictError, DatabaseError, ValidationError } from "./errors.js";
import { getSupabase } from "./supabase.js";

// Member CVs are immutable and versioned. Files live in a private Supabase
// Storage bucket; this module owns the storage + metadata interplay so routes
// stay thin. See docs/member-cvs.md.

export const CV_BUCKET = "member-cvs";
export const CV_MIME_TYPE = "application/pdf";
export const MAX_CV_BYTES = 5 * 1024 * 1024; // 5 MiB, mirrors the DB + bucket.
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

// Insert a new CV version: upload the immutable object, insert metadata, and
// flip the previous current row. Storage and metadata are kept consistent by
// uploading first (named by the new row id) then inserting; on insert failure
// the orphan object is best-effort removed.
export async function addCvVersion(
	input: AddCvVersionInput,
): Promise<MemberCvRow> {
	assertValidCvPdf(input.buffer);
	const supabase = getSupabase();

	const { data: existing, error: existingError } = await supabase
		.from("member_cvs")
		.select("id, version")
		.eq("user_id", input.userId)
		.order("version", { ascending: false })
		.limit(1);
	if (existingError) {
		throw new DatabaseError(
			`Failed to read existing CVs: ${existingError.message}`,
		);
	}

	const previous = (existing?.[0] as { id: string; version: number }) ?? null;
	const nextVersion = (previous?.version ?? 0) + 1;
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

	// Demote the current row before inserting the new current one so the
	// partial unique index (one is_current per user) is never violated.
	const { error: demoteError } = await supabase
		.from("member_cvs")
		.update({ is_current: false })
		.eq("user_id", input.userId)
		.eq("is_current", true);
	if (demoteError) {
		await supabase.storage.from(CV_BUCKET).remove([storagePath]);
		throw new DatabaseError(
			`Failed to supersede previous CV: ${demoteError.message}`,
		);
	}

	const { data: inserted, error: insertError } = await supabase
		.from("member_cvs")
		.insert({
			id: cvId,
			user_id: input.userId,
			storage_bucket: CV_BUCKET,
			storage_path: storagePath,
			original_filename: sanitizeCvFilename(input.originalFilename),
			mime_type: CV_MIME_TYPE,
			size_bytes: input.buffer.length,
			sha256: sha256Hex(input.buffer),
			source: input.source,
			version: nextVersion,
			is_current: true,
			uploaded_by_user_id: input.uploadedByUserId,
			supersedes_cv_id: previous?.id ?? null,
		})
		.select("*")
		.single();
	if (insertError || !inserted) {
		await supabase.storage.from(CV_BUCKET).remove([storagePath]);
		if (insertError?.code === "23505") {
			throw new ConflictError("A newer CV version already exists. Retry.");
		}
		throw new DatabaseError(
			`Failed to record CV version: ${insertError?.message ?? "no row"}`,
		);
	}

	return inserted as MemberCvRow;
}
