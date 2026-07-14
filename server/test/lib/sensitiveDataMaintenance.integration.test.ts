import "../setup.js";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
	decryptValueWithPrimaryKey,
	encryptValue,
	isEncryptedValue,
} from "../../src/lib/sensitiveData.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";
import { runSensitiveDataMaintenance } from "../../src/scripts/rotateSensitiveData.js";
import {
	createMockSupabaseClient,
	mockDatabase,
	resetMockDatabase,
} from "../mocks/supabase.js";

const fallbackKey = "fallback-maintenance-key-at-least-32-characters";
const originalCurrentKey = process.env.FIELD_ENCRYPTION_KEY;
const originalFallbackKeys = process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;

afterEach(() => {
	resetMockDatabase();
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

test("backfills plaintext without rewriting fallback ciphertext, then rotates all rows", async () => {
	resetMockDatabase();
	setSupabaseClient(createMockSupabaseClient());
	const currentKey = process.env.FIELD_ENCRYPTION_KEY;
	assert.ok(currentKey);

	process.env.FIELD_ENCRYPTION_KEY = fallbackKey;
	delete process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;
	const fallbackCiphertext = encryptValue("fallback-sensitive-value");
	assert.equal(typeof fallbackCiphertext, "string");

	process.env.FIELD_ENCRYPTION_KEY = currentKey;
	process.env.FIELD_ENCRYPTION_KEY_FALLBACKS = JSON.stringify([fallbackKey]);
	const sepaRow = mockDatabase.sepa[0];
	assert.ok(sepaRow);
	sepaRow.iban = fallbackCiphertext;

	await runSensitiveDataMaintenance({
		apply: true,
		plaintextOnly: true,
	});

	assert.equal(mockDatabase.sepa[0]?.iban, fallbackCiphertext);
	assert.equal(isEncryptedValue(mockDatabase.members[0]?.street), true);

	await runSensitiveDataMaintenance({
		apply: true,
		plaintextOnly: false,
	});

	const rotatedIban = mockDatabase.sepa[0]?.iban;
	assert.notEqual(rotatedIban, fallbackCiphertext);
	assert.equal(
		decryptValueWithPrimaryKey(rotatedIban),
		"fallback-sensitive-value",
	);
});
