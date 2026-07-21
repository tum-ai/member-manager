import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const seed = readFileSync(resolve("supabase/seed.sql"), "utf8");
const auditMigration = readFileSync(
	resolve(
		"supabase/migrations/20260721200000_sanitize_member_merge_audit_snapshots.sql",
	),
	"utf8",
);
const plaintextBankIdentifier =
	/'(?:[A-Z]{2}\d{2}[A-Z0-9]{11,30}|[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)'/g;

test("sensitive seed fixtures do not contain plaintext IBANs or BICs", () => {
	assert.deepEqual(seed.match(plaintextBankIdentifier) ?? [], []);
});

test("member merge audit snapshots are sanitized historically and on write", () => {
	assert.match(auditMigration, /update "public"\."member_merge_audit"/);
	assert.match(auditMigration, /before insert or update of "source_snapshot"/);

	for (const field of [
		"date_of_birth",
		"street",
		"number",
		"postal_code",
		"city",
		"country",
		"phone",
		"iban",
		"bic",
		"bank_name",
	]) {
		assert.ok(auditMigration.includes(`'${field}'`));
	}
});
