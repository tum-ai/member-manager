import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { encryptValue } from "../../src/lib/sensitiveData.js";
import { verifySensitiveValue } from "../../src/lib/sensitiveDataMaintenance.js";
import {
	parseRotationOptions,
	requiresPrimaryVerification,
} from "../../src/scripts/rotationOptions.js";

const currentKey = "current-maintenance-key-at-least-32-characters";
const fallbackKey = "fallback-maintenance-key-at-least-32-characters";
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

describe("sensitive data maintenance options", () => {
	test("defaults to a full dry run", () => {
		const options = parseRotationOptions([]);

		assert.deepEqual(options, {
			apply: false,
			plaintextOnly: false,
		});
		assert.equal(requiresPrimaryVerification(options), true);
	});

	test("supports apply and plaintext-only modes", () => {
		const options = parseRotationOptions(["--apply", "--plaintext-only"]);

		assert.deepEqual(options, {
			apply: true,
			plaintextOnly: true,
		});
		assert.equal(requiresPrimaryVerification(options), false);
	});

	test("rejects unknown arguments", () => {
		assert.throws(() => parseRotationOptions(["--force"]), /Unknown argument/);
	});

	test("backfill accepts fallback ciphertext while rotation requires primary ciphertext", () => {
		process.env.FIELD_ENCRYPTION_KEY = fallbackKey;
		delete process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;
		const fallbackCiphertext = encryptValue("sensitive-value");

		process.env.FIELD_ENCRYPTION_KEY = currentKey;
		process.env.FIELD_ENCRYPTION_KEY_FALLBACKS = JSON.stringify([fallbackKey]);

		assert.doesNotThrow(() =>
			verifySensitiveValue(fallbackCiphertext, { primaryOnly: false }),
		);
		assert.throws(
			() => verifySensitiveValue(fallbackCiphertext, { primaryOnly: true }),
			/Unable to decrypt/,
		);
	});
});
