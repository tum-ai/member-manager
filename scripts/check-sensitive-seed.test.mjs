import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const seed = readFileSync(resolve("supabase/seed.sql"), "utf8");
const plaintextBankIdentifier =
	/'(?:[A-Z]{2}\d{2}[A-Z0-9]{11,30}|[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)'/g;

test("sensitive seed fixtures do not contain plaintext IBANs or BICs", () => {
	assert.deepEqual(seed.match(plaintextBankIdentifier) ?? [], []);
});
