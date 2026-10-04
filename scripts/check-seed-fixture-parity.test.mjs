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
		noBankDetailsEmail: grab("SEED_NO_BANK_DETAILS_MEMBER_EMAIL"),
		newJoinerEmail: grab("SEED_NEW_JOINER_EMAIL"),
		signToken: grab("SEED_RETIRED_CONTRACT_SIGN_TOKEN"),
	};
}

function readRepoFile(relativePath) {
	return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

test("extractSeedConstants parses exported string constants", () => {
	const sample = [
		'export const SEED_ADMIN_EMAIL = "admin@example.com";',
		"export const SEED_REGULAR_MEMBER_EMAIL = 'regular@example.com';",
		'export const SEED_NO_BANK_DETAILS_MEMBER_EMAIL = "nobank@example.com";',
		'export const SEED_NEW_JOINER_EMAIL = "new@example.com";',
		'export const SEED_RETIRED_CONTRACT_SIGN_TOKEN = "tok-123";',
	].join("\n");
	assert.deepEqual(extractSeedConstants(sample), {
		adminEmail: "admin@example.com",
		regularEmail: "regular@example.com",
		noBankDetailsEmail: "nobank@example.com",
		newJoinerEmail: "new@example.com",
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

function seedPersonaId(seed, email) {
	return seed.match(new RegExp(`\\('([0-9a-f-]{36})', '${email}'`))?.[1];
}

// Body of the catch-all `insert into public.<table>` up to its `on conflict`.
function catchAllInsert(seed, table) {
	const start = seed.lastIndexOf(`insert into public.${table} (`);
	assert.ok(start >= 0, `no insert into public.${table} in the seed`);
	return seed.slice(start, seed.indexOf("on conflict", start));
}

test("the no-bank-details persona is excluded from the catch-all SEPA seed", () => {
	const { noBankDetailsEmail } = extractSeedConstants(
		readRepoFile("e2e/helpers.ts"),
	);
	const seed = readRepoFile("supabase/seed.sql");
	const personaId = seedPersonaId(seed, noBankDetailsEmail);
	assert.ok(personaId, `no seed user row found for ${noBankDetailsEmail}`);
	assert.ok(
		catchAllInsert(seed, "sepa").includes(`'${personaId}'`),
		`the catch-all public.sepa insert must skip ${noBankDetailsEmail} (${personaId}); e2e/profile-edit.spec.ts relies on that member having no bank details.`,
	);
});

test("the new-joiner persona is excluded from the catch-all agreements seed", () => {
	const { newJoinerEmail } = extractSeedConstants(
		readRepoFile("e2e/helpers.ts"),
	);
	const seed = readRepoFile("supabase/seed.sql");
	const personaId = seedPersonaId(seed, newJoinerEmail);
	assert.ok(personaId, `no seed user row found for ${newJoinerEmail}`);
	for (const table of ["member_agreements", "sepa"]) {
		assert.ok(
			catchAllInsert(seed, table).includes(`'${personaId}'`),
			`the catch-all public.${table} insert must skip ${newJoinerEmail} (${personaId}); e2e/welcome.spec.ts relies on that member having undecided consents.`,
		);
	}
});
