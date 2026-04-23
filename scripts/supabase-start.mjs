#!/usr/bin/env node
// Wrapper around `supabase start` that pre-loads secrets from
// `supabase/.env.local` into the child process environment. This lets
// `config.toml` use `env(NAME)` substitution for OAuth provider secrets
// without requiring users to remember to export shell variables first.
//
// The supabase CLI itself resolves `env(...)` by reading process.env of
// whichever shell it was launched from; it does not auto-load any dotenv
// file. We bridge that gap here.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function parseDotenv(raw) {
	if (typeof raw !== "string") return {};

	const result = {};
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
		if (!match) continue;

		const [, key, rawValue] = match;
		let value = rawValue.trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		result[key] = value;
	}
	return result;
}

export function loadEnvFile(path) {
	try {
		const raw = readFileSync(path, "utf8");
		return parseDotenv(raw);
	} catch (error) {
		if (error && typeof error === "object" && error.code === "ENOENT") {
			return {};
		}
		throw error;
	}
}

function runCli() {
	const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const envFile = resolve(repoRoot, "supabase/.env.local");
	const loaded = loadEnvFile(envFile);

	const loadedKeys = Object.keys(loaded);
	if (loadedKeys.length > 0) {
		console.log(
			`loaded ${loadedKeys.length} var(s) from supabase/.env.local: ${loadedKeys.join(", ")}`,
		);
	} else {
		console.log(
			"no supabase/.env.local found (or empty); spawning `supabase start` with current shell env only.",
		);
	}

	const child = spawn("supabase", ["start"], {
		cwd: repoRoot,
		stdio: "inherit",
		env: { ...process.env, ...loaded },
	});

	child.on("exit", (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}
		process.exit(code ?? 0);
	});
}

const invokedDirectly =
	import.meta.url === `file://${process.argv[1]}` ||
	import.meta.url.endsWith(process.argv[1] ?? "");

if (invokedDirectly) {
	runCli();
}
