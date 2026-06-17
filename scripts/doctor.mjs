#!/usr/bin/env node

// `pnpm doctor` — quick local-environment health check for new contributors.
// Verifies the running Node matches .nvmrc, the generated .env.local files
// exist, and that the local Supabase stack is reachable. Diagnostic only — it
// never mutates anything and never sends local file contents over the network.
// Seed integrity (the fixtures the app/E2E rely on) is checked separately by
// `pnpm test:scripts` (see check-seed-fixture-parity + verify-local-seed).
// Exits non-zero when a hard check fails so it can gate setup scripts.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SUPABASE_AUTH_HEALTH = "http://127.0.0.1:54321/auth/v1/health";

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

export async function supabaseReachable(url = SUPABASE_AUTH_HEALTH) {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
		return response.ok;
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
	} else {
		line(
			"warn",
			"Local Supabase not reachable. Run `pnpm supabase:start` if you need the full stack.",
		);
	}

	console.log(
		hardFailure
			? "\nDoctor found problems. See the [FAIL] lines above."
			: "\nDoctor: environment looks healthy. Run `pnpm test:scripts` to verify the seed.",
	);
	return hardFailure ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runDoctor().then((code) => {
		process.exitCode = code;
	});
}
