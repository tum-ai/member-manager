#!/usr/bin/env node

// `pnpm doctor` — quick local-environment health check for new contributors.
// Verifies the running Node matches .nvmrc, the generated .env.local files
// exist, and (when the stack is up) that local Supabase is reachable with a
// working seed. Diagnostic only — it never mutates anything. Exits non-zero
// when a hard check fails so it can gate setup scripts.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SUPABASE_AUTH_HEALTH = "http://127.0.0.1:54321/auth/v1/health";
const SUPABASE_TOKEN_URL =
	"http://127.0.0.1:54321/auth/v1/token?grant_type=password";

const LABELS = { pass: "PASS", warn: "WARN", fail: "FAIL" };

export function expectedNodeMajor(versionRaw) {
	const match = String(versionRaw)
		.trim()
		.match(/^v?(\d+)/);
	return match ? Number(match[1]) : null;
}

export function nodeVersionStatus(processVersion, nvmrcRaw) {
	const expected = expectedNodeMajor(nvmrcRaw);
	const actual = expectedNodeMajor(processVersion);
	if (expected === null) {
		return {
			level: "warn",
			message: `Could not parse .nvmrc ("${String(nvmrcRaw).trim()}"); skipping Node check.`,
		};
	}
	if (actual === expected) {
		return {
			level: "pass",
			message: `Node ${processVersion} matches .nvmrc (${expected}.x).`,
		};
	}
	return {
		level: "fail",
		message: `Node ${processVersion} does not match .nvmrc (${expected}.x). Run \`nvm use\` or install Node ${expected}.`,
	};
}

export function envFileStatus(root) {
	const files = ["client/.env.local", "server/.env.local"];
	return files.map((relativePath) => ({
		path: relativePath,
		exists: existsSync(resolve(root, relativePath)),
	}));
}

function readNvmrc(root) {
	try {
		return readFileSync(resolve(root, ".nvmrc"), "utf8");
	} catch {
		return "";
	}
}

function readAnonKey(root) {
	try {
		const raw = readFileSync(resolve(root, "client/.env.local"), "utf8");
		const match = raw.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m);
		return match ? match[1].trim() : null;
	} catch {
		return null;
	}
}

export async function supabaseReachable(url = SUPABASE_AUTH_HEALTH) {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
		return response.ok;
	} catch {
		return false;
	}
}

async function seedSignInWorks(anonKey) {
	try {
		const response = await fetch(SUPABASE_TOKEN_URL, {
			method: "POST",
			headers: { apikey: anonKey, "Content-Type": "application/json" },
			body: JSON.stringify({
				email: "admin@example.com",
				password: "password123",
			}),
			signal: AbortSignal.timeout(5_000),
		});
		const body = await response.json().catch(() => ({}));
		return Boolean(body.access_token);
	} catch {
		return false;
	}
}

function line(level, message) {
	console.log(`[${LABELS[level]}] ${message}`);
}

export async function runDoctor({ root = repoRoot } = {}) {
	let hardFailure = false;

	const node = nodeVersionStatus(process.version, readNvmrc(root));
	line(node.level, node.message);
	if (node.level === "fail") {
		hardFailure = true;
	}

	for (const file of envFileStatus(root)) {
		if (file.exists) {
			line("pass", `${file.path} present.`);
		} else {
			line(
				"fail",
				`${file.path} missing. Run \`pnpm setup:local\` (needs the Supabase stack running).`,
			);
			hardFailure = true;
		}
	}

	if (await supabaseReachable()) {
		line("pass", "Local Supabase reachable at 127.0.0.1:54321.");
		const anonKey = readAnonKey(root);
		if (anonKey && (await seedSignInWorks(anonKey))) {
			line("pass", "Seed account admin@example.com can sign in.");
		} else if (anonKey) {
			// Supabase is up and the anon key is present, but the seeded account
			// cannot sign in — a genuinely broken local auth setup. Fail hard so the
			// quickstart's health check does not green-light it.
			line(
				"fail",
				"Seed sign-in failed. Run `pnpm supabase:reset` to reload supabase/seed.sql.",
			);
			hardFailure = true;
		}
	} else {
		line(
			"warn",
			"Local Supabase not reachable. Run `pnpm supabase:start` if you need the full stack.",
		);
	}

	console.log(
		hardFailure
			? "\nDoctor found problems. See the [FAIL] lines above."
			: "\nDoctor: environment looks healthy.",
	);
	return hardFailure ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runDoctor().then((code) => {
		process.exitCode = code;
	});
}
