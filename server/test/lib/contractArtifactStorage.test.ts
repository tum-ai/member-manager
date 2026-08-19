import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptContractArtifact } from "../../src/lib/contracts/contractArtifactCrypto.js";
import { uploadContractArtifact } from "../../src/lib/contracts/contractArtifactStorage.js";
import { ConflictError } from "../../src/lib/errors.js";
import { getSupabase, setSupabaseClient } from "../../src/lib/supabase.js";

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
});
