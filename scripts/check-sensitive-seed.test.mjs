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

test("seeded door PINs are ciphertext only", () => {
	const start = seed.indexOf("insert into public.member_door_pins");
	assert.ok(start >= 0, "the seed no longer inserts door PINs");
	const insert = seed.slice(start, seed.indexOf("on conflict", start));
	const rows = [...insert.matchAll(/\('([0-9a-f-]{36})', '([^']*)'/g)];
	assert.ok(rows.length > 0, "no door PIN rows found in the seed insert");
	for (const [, userId, pin] of rows) {
		assert.match(
			pin,
			/^enc-v1:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]+$/,
			`door PIN for ${userId} must be enc-v1 ciphertext`,
		);
	}
	// No quoted 4-10 digit literal (a plaintext PIN) anywhere in the insert.
	assert.deepEqual(insert.match(/'\d{4,10}'/g) ?? [], []);
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
