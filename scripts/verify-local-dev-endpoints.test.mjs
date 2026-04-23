// Integration tests: the Vite dev server must be reachable on both
// `localhost` (which macOS + newer Node resolve to ::1) and `127.0.0.1`
// (IPv4), because Supabase's OAuth callback redirect uses the raw IPv4
// form configured as `site_url` in supabase/config.toml.
//
// Skips cleanly when the dev server isn't running, so CI / offline runs
// stay green.

import assert from "node:assert/strict";
import { test } from "node:test";

async function reach(url) {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
		return { ok: response.ok, status: response.status };
	} catch (error) {
		return { ok: false, status: 0, error: String(error) };
	}
}

async function viteRunning() {
	const probe = await reach("http://localhost:5173/");
	if (probe.ok) return true;
	const probeIpv4 = await reach("http://127.0.0.1:5173/");
	return probeIpv4.ok;
}

test("vite dev server responds on http://localhost:5173", async (t) => {
	if (!(await viteRunning())) {
		t.skip("Vite dev server not running; start `pnpm dev:local` first");
		return;
	}

	const { ok, status } = await reach("http://localhost:5173/");
	assert.ok(ok, `expected 2xx from http://localhost:5173/, got ${status}`);
});

test("vite dev server responds on http://127.0.0.1:5173 (IPv4)", async (t) => {
	if (!(await viteRunning())) {
		t.skip("Vite dev server not running; start `pnpm dev:local` first");
		return;
	}

	const { ok, status } = await reach("http://127.0.0.1:5173/");
	assert.ok(
		ok,
		`expected 2xx from http://127.0.0.1:5173/, got ${status}. ` +
			"Supabase's OAuth callback uses 127.0.0.1 because supabase/config.toml " +
			"has site_url set to that host, so Vite must bind to IPv4 too.",
	);
});

test("supabase auth allows redirect_to http://localhost:5173/ (trailing slash)", async (t) => {
	try {
		const health = await fetch("http://127.0.0.1:54321/auth/v1/health", {
			signal: AbortSignal.timeout(2_000),
		});
		if (!health.ok) {
			t.skip("local Supabase not reachable");
			return;
		}
	} catch {
		t.skip("local Supabase not reachable");
		return;
	}

	const target = encodeURIComponent("http://localhost:5173/");
	const response = await fetch(
		`http://127.0.0.1:54321/auth/v1/authorize?provider=slack_oidc&redirect_to=${target}`,
		{ redirect: "manual", signal: AbortSignal.timeout(2_000) },
	);

	assert.equal(response.status, 302);
	const location = response.headers.get("location") ?? "";
	const url = new URL(location);
	const state = url.searchParams.get("state");
	assert.ok(state, "authorize response must carry a state parameter");
	// GoTrue stores the validated redirect_to against this state; we can't
	// inspect that directly, but we can at least assert the hop to Slack
	// worked, which it won't if redirect_to was rejected outright.
	assert.equal(url.hostname, "slack.com");
});
