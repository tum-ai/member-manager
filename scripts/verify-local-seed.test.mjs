// Integration test: the seeded admin/user accounts the README promises
// (`admin@example.com` / `password123`, `user@example.com` / `password123`)
// must actually be able to obtain a session from the local Supabase stack
// after `supabase db reset`.
//
// Skips when the local stack isn't reachable so CI / offline runs stay green.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readEnvValue(file, name) {
	try {
		const raw = readFileSync(resolve(repoRoot, file), "utf8");
		const match = raw.match(new RegExp(`^${name}=(.+)$`, "m"));
		return match ? match[1].trim() : null;
	} catch {
		return null;
	}
}

function readAnonKey() {
	return readEnvValue("client/.env.local", "VITE_SUPABASE_ANON_KEY");
}

// The server-side key written by `pnpm setup:local`; it bypasses RLS and the
// table grants, so the seed can be checked on tables browsers cannot read.
function readServiceRoleKey() {
	return readEnvValue("server/.env.local", "SUPABASE_SERVICE_ROLE_KEY");
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

async function signIn(anonKey, email, password) {
	const response = await fetch(
		"http://127.0.0.1:54321/auth/v1/token?grant_type=password",
		{
			method: "POST",
			headers: {
				apikey: anonKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email, password }),
		},
	);
	const body = await response.json().catch(() => ({}));
	return { status: response.status, body };
}

test("seed creates admin@example.com that can sign in with password", async (t) => {
	if (!(await authHealth())) {
		t.skip("local Supabase not reachable at 127.0.0.1:54321");
		return;
	}

	const anonKey = readAnonKey();
	if (!anonKey) {
		t.skip("client/.env.local missing; run `pnpm setup:local` first");
		return;
	}

	const { status, body } = await signIn(
		anonKey,
		"admin@example.com",
		"password123",
	);

	assert.equal(
		status,
		200,
		`expected 200 from /auth/v1/token, got ${status}: ${JSON.stringify(body)}`,
	);
	assert.ok(body.access_token, "expected access_token in response");
	assert.equal(body.user?.email, "admin@example.com");
});

test("seed creates user@example.com that can sign in with password", async (t) => {
	if (!(await authHealth())) {
		t.skip("local Supabase not reachable at 127.0.0.1:54321");
		return;
	}

	const anonKey = readAnonKey();
	if (!anonKey) {
		t.skip("client/.env.local missing; run `pnpm setup:local` first");
		return;
	}

	const { status, body } = await signIn(
		anonKey,
		"user@example.com",
		"password123",
	);

	assert.equal(
		status,
		200,
		`expected 200 from /auth/v1/token, got ${status}: ${JSON.stringify(body)}`,
	);
	assert.ok(body.access_token, "expected access_token in response");
	assert.equal(body.user?.email, "user@example.com");
});

async function countRows(anonKey, accessToken, table) {
	const response = await fetch(
		`http://127.0.0.1:54321/rest/v1/${table}?select=id`,
		{
			headers: {
				apikey: anonKey,
				Authorization: `Bearer ${accessToken}`,
			},
		},
	);
	const body = await response.json().catch(() => []);
	return {
		status: response.status,
		count: Array.isArray(body) ? body.length : 0,
	};
}

test("seed populates the feature tables (jobs, contracts, tumai days)", async (t) => {
	if (!(await authHealth())) {
		t.skip("local Supabase not reachable at 127.0.0.1:54321");
		return;
	}

	const anonKey = readAnonKey();
	if (!anonKey) {
		t.skip("client/.env.local missing; run `pnpm setup:local` first");
		return;
	}

	const { body } = await signIn(anonKey, "admin@example.com", "password123");
	assert.ok(body.access_token, "expected admin access_token");

	// contract_submissions is checked separately below: it is server-only
	// (#392), so a browser token gets 403 even as admin.
	for (const table of ["job_posting_requests", "tumai_days"]) {
		const { status, count } = await countRows(
			anonKey,
			body.access_token,
			table,
		);
		assert.equal(status, 200, `expected 200 reading ${table}, got ${status}`);
		assert.ok(count > 0, `expected seeded rows in ${table}, got ${count}`);
	}
});

test("seed populates contract_submissions (server-only, read with the service role)", async (t) => {
	if (!(await authHealth())) {
		t.skip("local Supabase not reachable at 127.0.0.1:54321");
		return;
	}

	const serviceKey = readServiceRoleKey();
	if (!serviceKey) {
		t.skip("server/.env.local missing; run `pnpm setup:local` first");
		return;
	}

	const { status, count } = await countRows(
		serviceKey,
		serviceKey,
		"contract_submissions",
	);
	assert.equal(
		status,
		200,
		`expected 200 reading contract_submissions, got ${status}`,
	);
	assert.ok(
		count > 0,
		`expected seeded rows in contract_submissions, got ${count}`,
	);
});
