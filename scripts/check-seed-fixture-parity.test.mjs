// Parity guard: the E2E suite hard-codes seeded fixtures in e2e/helpers.ts
// (seed accounts + a contract signing token). If supabase/seed.sql drifts from
// those constants the suite breaks confusingly at runtime. This reads the same
// constants the specs use and checks them against the live local stack.
//
// The constant-extraction test runs offline (so a rename is caught anywhere,
// including the CI test job); the live checks skip when the stack isn't
// reachable, matching verify-local-seed.test.mjs.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_URL = process.env.E2E_SERVER_URL ?? "http://127.0.0.1:8787";

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

function readHelpers() {
	return readFileSync(resolve(repoRoot, "e2e/helpers.ts"), "utf8");
}

function readAnonKey() {
	try {
		const raw = readFileSync(resolve(repoRoot, "client/.env.local"), "utf8");
		const match = raw.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m);
		return match ? match[1].trim() : null;
	} catch {
		return null;
	}
}

async function authHealth() {
	try {
		const response = await fetch("http://127.0.0.1:54321/auth/v1/health", {
			signal: AbortSignal.timeout(2_000),
		});
		return response.ok;
	} catch {
		return false;
	}
}

async function signInStatus(anonKey, email) {
	const response = await fetch(
		"http://127.0.0.1:54321/auth/v1/token?grant_type=password",
		{
			method: "POST",
			headers: { apikey: anonKey, "Content-Type": "application/json" },
			body: JSON.stringify({ email, password: "password123" }),
		},
	);
	return response.status;
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
	const constants = extractSeedConstants(readHelpers());
	for (const [name, value] of Object.entries(constants)) {
		assert.ok(
			value,
			`e2e/helpers.ts no longer exports the constant behind "${name}"; update scripts/check-seed-fixture-parity.test.mjs to match.`,
		);
	}
});

test("seeded accounts from e2e/helpers.ts can sign in", async (t) => {
	if (!(await authHealth())) {
		t.skip("local Supabase not reachable at 127.0.0.1:54321");
		return;
	}
	const anonKey = readAnonKey();
	if (!anonKey) {
		t.skip("client/.env.local missing; run `pnpm setup:local` first");
		return;
	}

	const { adminEmail, regularEmail } = extractSeedConstants(readHelpers());
	for (const email of [adminEmail, regularEmail]) {
		const status = await signInStatus(anonKey, email);
		assert.equal(
			status,
			200,
			`E2E seed account ${email} could not sign in (status ${status}). supabase/seed.sql has drifted from e2e/helpers.ts.`,
		);
	}
});

test("seeded contract signing token from e2e/helpers.ts resolves", async (t) => {
	const { signToken } = extractSeedConstants(readHelpers());

	let response;
	try {
		response = await fetch(`${SERVER_URL}/api/contracts/sign/${signToken}`, {
			signal: AbortSignal.timeout(3_000),
		});
	} catch {
		t.skip(
			`API not reachable at ${SERVER_URL}; run \`pnpm dev\` to check the token`,
		);
		return;
	}

	assert.notEqual(
		response.status,
		404,
		`Seeded signing token ${signToken} not found — supabase/seed.sql has drifted from e2e/helpers.ts.`,
	);
});
