import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	decryptContractArtifact,
	decryptContractJson,
	encryptContractArtifact,
	encryptContractJson,
	isEncryptedContractArtifact,
} from "../../src/lib/contracts/contractArtifactCrypto.js";

const originalKey = process.env.FIELD_ENCRYPTION_KEY;
const originalFallbacks = process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;

describe("contract artifact encryption", () => {
	beforeEach(() => {
		process.env.FIELD_ENCRYPTION_KEY = "p".repeat(32);
		delete process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;
	});

	afterEach(() => {
		if (originalKey === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
		else process.env.FIELD_ENCRYPTION_KEY = originalKey;
		if (originalFallbacks === undefined) {
			delete process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;
		} else {
			process.env.FIELD_ENCRYPTION_KEY_FALLBACKS = originalFallbacks;
		}
	});

	it("round trips binary artifacts without retaining plaintext", () => {
		const plaintext = Buffer.from("sensitive contract contents");
		const encrypted = encryptContractArtifact(plaintext);
		assert.equal(isEncryptedContractArtifact(encrypted), true);
		assert.equal(encrypted.includes(plaintext), false);
		assert.deepEqual(decryptContractArtifact(encrypted), plaintext);
	});

	it("decrypts an artifact after primary key rotation", () => {
		const plaintext = Buffer.from("rotated contract");
		const encrypted = encryptContractArtifact(plaintext);
		process.env.FIELD_ENCRYPTION_KEY = "n".repeat(32);
		process.env.FIELD_ENCRYPTION_KEY_FALLBACKS = JSON.stringify([
			"p".repeat(32),
		]);
		assert.deepEqual(decryptContractArtifact(encrypted), plaintext);
	});

	it("rejects tampered ciphertext", () => {
		const encrypted = encryptContractArtifact(Buffer.from("contract"));
		encrypted[encrypted.length - 1] ^= 1;
		assert.throws(() => decryptContractArtifact(encrypted));
	});

	it("round trips encrypted JSON payloads", () => {
		const encrypted = encryptContractJson({ iban: "not stored as plaintext" });
		assert.match(encrypted, /^enc-bin-v1:/);
		assert.equal(encrypted.includes("iban"), false);
		assert.deepEqual(decryptContractJson(encrypted), {
			iban: "not stored as plaintext",
		});
	});
});
