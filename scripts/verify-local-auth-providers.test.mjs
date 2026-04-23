// Integration test: the local Supabase auth service must have the external
// providers the app depends on enabled. Today that's email (always on) and
// slack_oidc (needed because the member portal's primary login button routes
// through Slack).
//
// Skips when the local Supabase stack isn't reachable so offline / CI runs
// stay green.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readAnonKey() {
	try {
		const raw = readFileSync(resolve(repoRoot, "client/.env.local"), "utf8");
		const match = raw.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m);
		return match ? match[1].trim() : null;
	} catch {
		return null;
	}
}

async function fetchAuthSettings(anonKey) {
	const response = await fetch("http://127.0.0.1:54321/auth/v1/settings", {
		headers: { apikey: anonKey },
		signal: AbortSignal.timeout(2_000),
	});
	if (!response.ok) {
		throw new Error(`auth settings returned HTTP ${response.status}`);
	}
	return response.json();
}

async function authReachable() {
	try {
		const response = await fetch("http://127.0.0.1:54321/auth/v1/health", {
			signal: AbortSignal.timeout(2_000),
		});
		return response.ok;
	} catch {
		return false;
	}
}

test("local auth has slack_oidc provider enabled", async (t) => {
	if (!(await authReachable())) {
		t.skip("local Supabase not reachable at 127.0.0.1:54321");
		return;
	}

	const anonKey = readAnonKey();
	if (!anonKey) {
		t.skip("client/.env.local missing; run `pnpm setup:local` first");
		return;
	}

	const settings = await fetchAuthSettings(anonKey);

	assert.equal(
		settings.external?.slack_oidc,
		true,
		`expected external.slack_oidc === true, got ${JSON.stringify(settings.external)}`,
	);
});

test("local auth still has email provider enabled", async (t) => {
	if (!(await authReachable())) {
		t.skip("local Supabase not reachable at 127.0.0.1:54321");
		return;
	}

	const anonKey = readAnonKey();
	if (!anonKey) {
		t.skip("client/.env.local missing; run `pnpm setup:local` first");
		return;
	}

	const settings = await fetchAuthSettings(anonKey);
	assert.equal(settings.external?.email, true);
});
