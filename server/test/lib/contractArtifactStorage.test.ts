import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptContractArtifact } from "../../src/lib/contracts/contractArtifactCrypto.js";
import { ConflictError } from "../../src/lib/errors.js";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { uploadContractArtifact } = await import(
	"../../src/lib/contracts/contractArtifactStorage.js"
);
const { getSupabase, setSupabaseClient } = await import(
	"../../src/lib/supabase.js"
);

const originalClient = getSupabase();
const originalKey = process.env.FIELD_ENCRYPTION_KEY;

function storageClient(existingPlaintext: Buffer): SupabaseClient {
	const encrypted = encryptContractArtifact(existingPlaintext);
	return {
		storage: {
			from: () => ({
				upload: async () => ({
					data: null,
					error: { message: "The resource already exists" },
				}),
				download: async () => ({
					data: new Blob([encrypted]),
					error: null,
				}),
			}),
		},
	} as unknown as SupabaseClient;
}

describe("contract artifact storage", () => {
	beforeEach(() => {
		process.env.FIELD_ENCRYPTION_KEY = "s".repeat(32);
	});

	afterEach(() => {
		setSupabaseClient(originalClient);
		if (originalKey === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
		else process.env.FIELD_ENCRYPTION_KEY = originalKey;
	});

	it("accepts an immutable upload retry when plaintext hashes match", async () => {
		const plaintext = Buffer.from("same contract artifact");
		setSupabaseClient(storageClient(plaintext));
		const result = await uploadContractArtifact({
			bucket: "contract-render-artifacts",
			path: "submissions/id/version/document.pdf",
			plaintext,
			contentType: "application/pdf",
		});
		assert.equal(result.sizeBytes, plaintext.length);
		assert.match(result.sha256, /^[a-f0-9]{64}$/);
	});

	it("rejects an immutable upload retry when content differs", async () => {
		setSupabaseClient(storageClient(Buffer.from("first artifact")));
		await assert.rejects(
			() =>
				uploadContractArtifact({
					bucket: "contract-render-artifacts",
					path: "submissions/id/version/document.pdf",
					plaintext: Buffer.from("different artifact"),
					contentType: "application/pdf",
				}),
			(error: unknown) => error instanceof ConflictError,
		);
	});

	it("adopts the stored artifact when a re-render is not byte-identical", async () => {
		// LibreOffice stamps a /CreationDate, so a job killed after upload but
		// before finalize re-converts to different bytes. Without adoption the
		// retry conflicts forever and the version is stuck as failed.
		const stored = Buffer.from("pdf rendered on the first attempt");
		setSupabaseClient(storageClient(stored));
		const result = await uploadContractArtifact({
			bucket: "contract-render-artifacts",
			path: "submissions/id/version/document.pdf",
			plaintext: Buffer.from("pdf rendered on the second attempt"),
			contentType: "application/pdf",
			adoptExisting: true,
		});
		assert.equal(result.sizeBytes, stored.length);
		assert.equal(
			result.sha256,
			createHash("sha256").update(stored).digest("hex"),
		);
	});
});
