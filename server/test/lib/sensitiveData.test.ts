import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
	decryptValue,
	decryptValueWithPrimaryKey,
	encryptValue,
	isEncryptedValue,
	reencryptValue,
} from "../../src/lib/sensitiveData.js";

const currentKey = "current-test-encryption-key-at-least-32-characters";
const previousKey = "previous-test-encryption-key-at-least-32-characters";
const originalCurrentKey = process.env.FIELD_ENCRYPTION_KEY;
const originalFallbackKeys = process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;

afterEach(() => {
	if (originalCurrentKey === undefined) {
		delete process.env.FIELD_ENCRYPTION_KEY;
	} else {
		process.env.FIELD_ENCRYPTION_KEY = originalCurrentKey;
	}
	if (originalFallbackKeys === undefined) {
		delete process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;
	} else {
		process.env.FIELD_ENCRYPTION_KEY_FALLBACKS = originalFallbackKeys;
	}
});

describe("sensitive data encryption", () => {
	test("encrypts with authenticated random ciphertext", () => {
		process.env.FIELD_ENCRYPTION_KEY = currentKey;
		delete process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;

		const first = encryptValue("sensitive-value");
		const second = encryptValue("sensitive-value");

		assert.equal(isEncryptedValue(first), true);
		assert.notEqual(first, second);
		assert.equal(decryptValue(first), "sensitive-value");
	});

	test("rejects ciphertext that was modified", () => {
		process.env.FIELD_ENCRYPTION_KEY = currentKey;
		delete process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;
		const encrypted = String(encryptValue("sensitive-value"));
		const finalCharacter = encrypted.at(-1);
		const tampered = `${encrypted.slice(0, -1)}${finalCharacter === "A" ? "B" : "A"}`;

		assert.throws(() => decryptValue(tampered), /Unable to decrypt/);
	});

	test("decrypts with a fallback key and re-encrypts with the current key", () => {
		process.env.FIELD_ENCRYPTION_KEY = previousKey;
		delete process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;
		const encryptedWithPreviousKey = encryptValue("sensitive-value");

		process.env.FIELD_ENCRYPTION_KEY = currentKey;
		process.env.FIELD_ENCRYPTION_KEY_FALLBACKS = JSON.stringify([previousKey]);
		assert.equal(decryptValue(encryptedWithPreviousKey), "sensitive-value");
		assert.throws(
			() => decryptValueWithPrimaryKey(encryptedWithPreviousKey),
			/Unable to decrypt/,
		);
		const rotated = reencryptValue(encryptedWithPreviousKey);

		delete process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;
		assert.equal(decryptValue(rotated), "sensitive-value");
		assert.equal(decryptValueWithPrimaryKey(rotated), "sensitive-value");
		assert.throws(
			() => decryptValue(encryptedWithPreviousKey),
			/Unable to decrypt/,
		);
	});

	test("requires strong, correctly formatted key configuration", () => {
		process.env.FIELD_ENCRYPTION_KEY = "too-short";
		assert.throws(() => encryptValue("value"), /at least 32 characters/);

		process.env.FIELD_ENCRYPTION_KEY = currentKey;
		process.env.FIELD_ENCRYPTION_KEY_FALLBACKS = "not-json";
		assert.throws(() => encryptValue("value"), /JSON array/);
	});
});
