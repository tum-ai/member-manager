import { createHash } from "node:crypto";
import {
	CONTRACT_RENDER_ARTIFACT_BUCKET,
	CONTRACT_TEMPLATE_DOCUMENT_BUCKET,
} from "@member-manager/shared";
import { ConflictError, DatabaseError, ValidationError } from "../errors.js";
import { getSupabase } from "../supabase.js";
import {
	decryptContractArtifact,
	isEncryptedContractArtifact,
} from "./contractArtifactCrypto.js";

const ALLOWED_BUCKETS = new Set([
	CONTRACT_TEMPLATE_DOCUMENT_BUCKET,
	CONTRACT_RENDER_ARTIFACT_BUCKET,
]);
const SAFE_PATH = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,900}$/;

export interface StoredContractArtifact {
	bucket: string;
	path: string;
	sha256: string;
	sizeBytes: number;
}

export function contractArtifactSha256(value: Buffer): string {
	return createHash("sha256").update(value).digest("hex");
}

// Contract artifacts are stored as-is in private buckets and reach the browser
// through short-lived signed URLs, so nothing is written encrypted any more.
// Objects written by earlier builds still are, so reads decide by content.
function readStoredArtifact(stored: Buffer): Buffer {
	return isEncryptedContractArtifact(stored)
		? decryptContractArtifact(stored)
		: stored;
}

export function assertContractArtifactLocation(
	bucket: string,
	path: string,
): void {
	if (!ALLOWED_BUCKETS.has(bucket)) {
		throw new ValidationError("Unsupported contract artifact bucket");
	}
	if (
		!SAFE_PATH.test(path) ||
		path.startsWith("/") ||
		path.split("/").some((part) => part === "." || part === "..")
	) {
		throw new ValidationError("Invalid contract artifact path");
	}
}

export async function uploadContractArtifact(args: {
	bucket: string;
	path: string;
	plaintext: Buffer;
	contentType: string;
	// LibreOffice stamps a /CreationDate into every PDF, so a re-render after an
	// interrupted job produces different bytes at an immutable path. Set this for
	// such outputs to adopt the object already stored instead of failing forever.
	adoptExisting?: boolean;
}): Promise<StoredContractArtifact> {
	assertContractArtifactLocation(args.bucket, args.path);
	const plaintextSha256 = contractArtifactSha256(args.plaintext);
	const storage = getSupabase().storage.from(args.bucket);
	const { error } = await storage.upload(args.path, args.plaintext, {
		contentType: args.contentType,
		upsert: false,
		metadata: {
			plaintext_content_type: args.contentType,
			plaintext_sha256: plaintextSha256,
		},
	});
	if (error) {
		const existing = await storage.download(args.path);
		if (existing.data) {
			try {
				const plaintext = readStoredArtifact(
					Buffer.from(await existing.data.arrayBuffer()),
				);
				const existingSha256 = contractArtifactSha256(plaintext);
				if (existingSha256 === plaintextSha256) {
					return {
						bucket: args.bucket,
						path: args.path,
						sha256: plaintextSha256,
						sizeBytes: args.plaintext.length,
					};
				}
				if (args.adoptExisting) {
					return {
						bucket: args.bucket,
						path: args.path,
						sha256: existingSha256,
						sizeBytes: plaintext.length,
					};
				}
			} catch {
				// An existing unreadable object must never be overwritten at an immutable path.
			}
			throw new ConflictError(
				"Contract artifact path already contains different content",
			);
		}
		throw new DatabaseError(
			`Failed to store contract artifact: ${error.message}`,
		);
	}
	return {
		bucket: args.bucket,
		path: args.path,
		sha256: plaintextSha256,
		sizeBytes: args.plaintext.length,
	};
}

export async function downloadContractArtifact(args: {
	bucket: string;
	path: string;
	expectedSha256?: string | null;
}): Promise<Buffer> {
	assertContractArtifactLocation(args.bucket, args.path);
	const { data, error } = await getSupabase()
		.storage.from(args.bucket)
		.download(args.path);
	if (error || !data) {
		throw new DatabaseError(
			`Failed to read contract artifact: ${error?.message ?? "no data"}`,
		);
	}
	let plaintext: Buffer;
	try {
		plaintext = readStoredArtifact(Buffer.from(await data.arrayBuffer()));
	} catch {
		throw new DatabaseError("Stored contract artifact could not be decrypted");
	}
	if (
		args.expectedSha256 &&
		contractArtifactSha256(plaintext) !== args.expectedSha256
	) {
		throw new DatabaseError(
			"Stored contract artifact failed integrity validation",
		);
	}
	return plaintext;
}

export async function removeContractArtifact(args: {
	bucket: string;
	path: string;
}): Promise<void> {
	assertContractArtifactLocation(args.bucket, args.path);
	const { error } = await getSupabase()
		.storage.from(args.bucket)
		.remove([args.path]);
	if (error) {
		throw new DatabaseError(
			`Failed to remove contract artifact: ${error.message}`,
		);
	}
}

// Rendered artifacts leave through a short-lived signed URL rather than the
// function response body, which is capped at 4.5 MB per invocation. The bucket
// stays private; the URL is the only way in and it expires.
const SIGNED_URL_TTL_SECONDS = 60 * 10;

export async function createContractArtifactSignedUrl(args: {
	bucket: string;
	path: string;
	/** Filename to force a download; omit to let the browser display it. */
	download?: string;
}): Promise<string> {
	assertContractArtifactLocation(args.bucket, args.path);
	const { data, error } = await getSupabase()
		.storage.from(args.bucket)
		.createSignedUrl(args.path, SIGNED_URL_TTL_SECONDS, {
			download: args.download,
		});
	if (error || !data?.signedUrl) {
		throw new DatabaseError(
			`Failed to create contract artifact URL: ${error?.message ?? "no url"}`,
		);
	}
	return data.signedUrl;
}
