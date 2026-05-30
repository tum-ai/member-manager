import { randomUUID } from "node:crypto";
import { ValidationError } from "./errors.js";
import { getSupabase } from "./supabase.js";

// Screenshots attached to bug reports live in a PUBLIC Supabase Storage bucket.
// Public is deliberate: the URL is embedded in the GitHub issue we open, and
// GitHub's image proxy (camo) fetches it server-side with no Supabase creds, so
// a private/signed URL would not render. Object paths are unguessable UUIDs and
// uploads only ever go through the server (service role). See docs.

export const BUG_REPORT_IMAGE_BUCKET = "bug-report-images";
export const MAX_BUG_REPORT_IMAGE_MB = 10;
export const MAX_BUG_REPORT_IMAGE_BYTES = MAX_BUG_REPORT_IMAGE_MB * 1024 * 1024;
// base64 encodes 3 bytes as 4 chars; bound the encoded string so we reject
// oversized payloads before allocating a Buffer for them.
export const MAX_BUG_REPORT_IMAGE_BASE64_CHARS =
	Math.ceil(MAX_BUG_REPORT_IMAGE_BYTES / 3) * 4;

interface BugReportImageType {
	contentType: string;
	extension: string;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Sniff the image type from magic bytes rather than trusting a client-supplied
// MIME type. Returns null for anything that isn't a supported image.
export function detectBugReportImageType(
	buffer: Buffer,
): BugReportImageType | null {
	if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
		return { contentType: "image/png", extension: "png" };
	}
	if (
		buffer.length >= 3 &&
		buffer[0] === 0xff &&
		buffer[1] === 0xd8 &&
		buffer[2] === 0xff
	) {
		return { contentType: "image/jpeg", extension: "jpg" };
	}
	if (buffer.length >= 6) {
		const header = buffer.subarray(0, 6).toString("latin1");
		if (header === "GIF87a" || header === "GIF89a") {
			return { contentType: "image/gif", extension: "gif" };
		}
	}
	if (
		buffer.length >= 12 &&
		buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
		buffer.subarray(8, 12).toString("latin1") === "WEBP"
	) {
		return { contentType: "image/webp", extension: "webp" };
	}
	return null;
}

export interface BugReportImage {
	buffer: Buffer;
	contentType: string;
	extension: string;
}

function stripDataUrlPrefix(value: string): string {
	const match = /^data:[^;,]*;base64,/.exec(value);
	return match ? value.slice(match[0].length) : value;
}

// Decode and validate a base64-encoded image. Throws ValidationError (→ 400)
// for empty, oversized, or non-image input.
export function decodeBugReportImage(dataBase64: string): BugReportImage {
	const buffer = Buffer.from(stripDataUrlPrefix(dataBase64.trim()), "base64");
	if (buffer.length === 0) {
		throw new ValidationError("Attached image is empty");
	}
	if (buffer.length > MAX_BUG_REPORT_IMAGE_BYTES) {
		throw new ValidationError(
			`Attached image is too large (max ${MAX_BUG_REPORT_IMAGE_MB} MB)`,
		);
	}
	const type = detectBugReportImageType(buffer);
	if (!type) {
		throw new ValidationError(
			"Attached image must be a PNG, JPEG, GIF, or WebP file",
		);
	}
	return {
		buffer,
		contentType: type.contentType,
		extension: type.extension,
	};
}

type BugReportImageUploader = (image: BugReportImage) => Promise<string>;

async function defaultBugReportImageUploader(
	image: BugReportImage,
): Promise<string> {
	const supabase = getSupabase();
	const path = `${randomUUID()}.${image.extension}`;

	const { error } = await supabase.storage
		.from(BUG_REPORT_IMAGE_BUCKET)
		.upload(path, image.buffer, {
			contentType: image.contentType,
			upsert: false,
		});
	if (error) {
		throw new Error(`Failed to upload bug report image: ${error.message}`);
	}

	const { data } = supabase.storage
		.from(BUG_REPORT_IMAGE_BUCKET)
		.getPublicUrl(path);
	if (!data?.publicUrl) {
		throw new Error("Bug report image upload returned no public URL");
	}
	return data.publicUrl;
}

let activeBugReportImageUploader: BugReportImageUploader =
	defaultBugReportImageUploader;

export async function uploadBugReportImage(
	image: BugReportImage,
): Promise<string> {
	return activeBugReportImageUploader(image);
}

export function setBugReportImageUploader(
	uploader: BugReportImageUploader,
): void {
	activeBugReportImageUploader = uploader;
}

export function resetBugReportImageUploader(): void {
	activeBugReportImageUploader = defaultBugReportImageUploader;
}
