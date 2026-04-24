// Integration test: the admin directory endpoint must not 500.
//
// Regression guard for prod issue where `GET /api/admin/members` returned
// 500 `A database error occurred` because PostgREST could not embed
// `sepa(*)` from `members` (no declared FK between the two tables, both
// reference auth.users independently). Fixed by the
// `add_sepa_members_user_id_fkey` migration.
//
// Skips when the local Supabase stack or API server isn't reachable, so
// CI / offline runs stay green.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_BASE = "http://127.0.0.1:3000";
const SUPABASE_BASE = "http://127.0.0.1:54321";

function readAnonKey() {
	try {
		const raw = readFileSync(resolve(repoRoot, "client/.env.local"), "utf8");
		const match = raw.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m);
		return match ? match[1].trim() : null;
	} catch {
		return null;
	}
}

async function healthy(url) {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
		const body = await response.json().catch(() => null);
		return response.status === 200 && body?.status === "ok";
	} catch {
		return false;
	}
}

async function signInAsAdmin(anonKey) {
	const response = await fetch(
		`${SUPABASE_BASE}/auth/v1/token?grant_type=password`,
		{
			method: "POST",
			headers: { apikey: anonKey, "Content-Type": "application/json" },
			body: JSON.stringify({
				email: "admin@example.com",
				password: "password123",
			}),
		},
	);
	const body = await response.json().catch(() => ({}));
	if (!response.ok || !body.access_token) {
		throw new Error(
			`admin sign-in failed (${response.status}): ${JSON.stringify(body)}`,
		);
	}
	return body.access_token;
}

test("GET /api/admin/members returns 200 with an embedded sepa relation", async (t) => {
	if (!(await healthy(`${SUPABASE_BASE}/auth/v1/health`))) {
		t.skip("local Supabase not reachable at 127.0.0.1:54321");
		return;
	}
	if (!(await healthy(`${API_BASE}/health`))) {
		t.skip("local API server not reachable at 127.0.0.1:3000");
		return;
	}

	const anonKey = readAnonKey();
	if (!anonKey) {
		t.skip("client/.env.local missing; run `pnpm setup:local` first");
		return;
	}

	const token = await signInAsAdmin(anonKey);

	const response = await fetch(`${API_BASE}/api/admin/members?limit=1000`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: AbortSignal.timeout(5_000),
	});
	const body = await response.json().catch(() => ({}));

	assert.equal(
		response.status,
		200,
		`expected 200 from /api/admin/members, got ${response.status}: ${JSON.stringify(body)}`,
	);
	assert.ok(Array.isArray(body.data), "expected body.data to be an array");
	for (const member of body.data) {
		assert.ok(
			"sepa" in member,
			"each row must have a sepa key (object or {}), else the PostgREST embed failed",
		);
		assert.equal(
			typeof member.sepa,
			"object",
			"sepa must be an object (possibly empty), never an array or null",
		);
	}
});
