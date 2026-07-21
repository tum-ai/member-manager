import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
	new URL(
		"../supabase/migrations/20260718120000_finance_department_mappings.sql",
		import.meta.url,
	),
	"utf8",
);

test("finance mappings revoke broad authenticated privileges before exact grants", () => {
	const revokeIndex = migration.indexOf(
		'revoke all on table "public"."finance_department_mappings"',
	);
	const grantIndex = migration.indexOf("grant select, insert, update, delete");

	assert.notStrictEqual(revokeIndex, -1);
	assert.match(
		migration.slice(revokeIndex, grantIndex),
		/from "anon", "authenticated"/,
	);
	assert.ok(grantIndex > revokeIndex);
	assert.doesNotMatch(
		migration.slice(grantIndex),
		/grant[^;]*truncate[^;]*authenticated/i,
	);
});
