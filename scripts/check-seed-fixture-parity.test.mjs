// Parity guard: the E2E suite hard-codes seeded fixtures in e2e/helpers.ts
// (seed accounts + a contract signing token). If supabase/seed.sql drifts from
// those constants the suite breaks confusingly at runtime. This compares the
// two files directly — fully offline and deterministic, so it runs everywhere
// (including the CI test job) without needing a live stack. Runtime checks that
// the *running* DB is actually seeded live in e2e/global-setup.ts and
// verify-local-seed.test.mjs.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function extractSeedConstants(source) {
	const grab = (name) => {
		const match = source.match(
			new RegExp(`export const ${name}\\s*=\\s*["']([^"']+)["']`),
		);
		return match ? match[1] : null;
	};
	return {
		adminEmail: grab("SEED_ADMIN_EMAIL"),
		regularEmail: grab("SEED_REGULAR_MEMBER_EMAIL"),
		signToken: grab("SEED_CONTRACT_SIGN_TOKEN"),
	};
}

function readRepoFile(relativePath) {
	return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

test("extractSeedConstants parses exported string constants", () => {
	const sample = [
		'export const SEED_ADMIN_EMAIL = "admin@example.com";',
		"export const SEED_REGULAR_MEMBER_EMAIL = 'regular@example.com';",
		'export const SEED_CONTRACT_SIGN_TOKEN = "tok-123";',
	].join("\n");
	assert.deepEqual(extractSeedConstants(sample), {
		adminEmail: "admin@example.com",
		regularEmail: "regular@example.com",
		signToken: "tok-123",
	});
});

test("e2e/helpers.ts still exports the seed constants the parity check reads", () => {
	const constants = extractSeedConstants(readRepoFile("e2e/helpers.ts"));
	for (const [name, value] of Object.entries(constants)) {
		assert.ok(
			value,
			`e2e/helpers.ts no longer exports the constant behind "${name}"; update scripts/check-seed-fixture-parity.test.mjs to match.`,
		);
	}
});

test("supabase/seed.sql contains every fixture e2e/helpers.ts hard-codes", () => {
	const constants = extractSeedConstants(readRepoFile("e2e/helpers.ts"));
	const seed = readRepoFile("supabase/seed.sql");
	for (const [name, value] of Object.entries(constants)) {
		assert.ok(
			value && seed.includes(value),
			`supabase/seed.sql is missing "${value}" (${name} in e2e/helpers.ts). The seed has drifted from the E2E fixtures — update one to match the other.`,
		);
	}
});
