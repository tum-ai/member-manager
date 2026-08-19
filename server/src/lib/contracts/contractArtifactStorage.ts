import { createHash } from "node:crypto";
import {
	CONTRACT_RENDER_ARTIFACT_BUCKET,
	CONTRACT_TEMPLATE_DOCUMENT_BUCKET,
} from "@member-manager/shared";
import { ConflictError, DatabaseError, ValidationError } from "../errors.js";
import { getSupabase } from "../supabase.js";
import {
	decryptContractArtifact,
	encryptContractArtifact,
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
}): Promise<StoredContractArtifact> {
	assertContractArtifactLocation(args.bucket, args.path);
	const plaintextSha256 = contractArtifactSha256(args.plaintext);
	const encrypted = encryptContractArtifact(args.plaintext);
	const storage = getSupabase().storage.from(args.bucket);
	const { error } = await storage.upload(args.path, encrypted, {
		contentType: "application/octet-stream",
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
				const plaintext = decryptContractArtifact(
					Buffer.from(await existing.data.arrayBuffer()),
				);
				if (contractArtifactSha256(plaintext) === plaintextSha256) {
					return {
						bucket: args.bucket,
						path: args.path,
						sha256: plaintextSha256,
						sizeBytes: args.plaintext.length,
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
		plaintext = decryptContractArtifact(Buffer.from(await data.arrayBuffer()));
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
