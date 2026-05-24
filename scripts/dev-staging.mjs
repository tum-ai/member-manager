#!/usr/bin/env node
// Start the app against the hosted staging Supabase project.
//
// This intentionally bypasses generated local `.env.local` files so a stale
// Dockerized Supabase stack cannot hijack `pnpm dev:staging`. The client gets
// staging values via process.env (Vite keeps process env as highest priority),
// and the server gets DOTENV_CONFIG_PATH so its loader replaces the default
// `.env` + `.env.local` chain entirely.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDotenv } from "./supabase-start.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientEnvPath = resolve(repoRoot, "client/.env.staging.local");
const serverEnvPath = resolve(repoRoot, "server/.env.staging.local");

const REQUIRED_CLIENT_KEYS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
const REQUIRED_SERVER_KEYS = [
	"SUPABASE_URL",
	"SUPABASE_SERVICE_ROLE_KEY",
	"FIELD_ENCRYPTION_KEY",
];

const CLIENT_DEFAULTS = {
	VITE_API_PROXY_TARGET: "http://127.0.0.1:8787",
	VITE_SLACK_CALLBACK_URL: "",
};

const SERVER_DEFAULTS = {
	PORT: "8787",
	CORS_ORIGIN: "http://localhost:5173,http://127.0.0.1:5173",
	ENABLE_LOCAL_ADMIN_BOOTSTRAP: "false",
	LOCAL_ADMIN_EMAILS: "",
};

function missingKeys(env, keys) {
	return keys.filter((key) => !env[key]?.trim());
}

function assertHttpsRemoteUrl(rawUrl, envName) {
	let parsed;
	try {
		parsed = new URL(rawUrl);
	} catch {
		throw new Error(`${envName} must be a valid URL`);
	}

	if (parsed.protocol !== "https:") {
		throw new Error(`${envName} must use https:// for staging`);
	}

	if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
		throw new Error(`${envName} must point at hosted staging, not localhost`);
	}
}

export function readEnvFile(path) {
	return parseDotenv(readFileSync(path, "utf8"));
}

export function validateStagingEnv({ clientEnv, serverEnv }) {
	const missingClient = missingKeys(clientEnv, REQUIRED_CLIENT_KEYS);
	const missingServer = missingKeys(serverEnv, REQUIRED_SERVER_KEYS);
	const missing = [
		...missingClient.map((key) => `client/.env.staging.local:${key}`),
		...missingServer.map((key) => `server/.env.staging.local:${key}`),
	];

	if (missing.length > 0) {
		throw new Error(`Missing staging env value(s): ${missing.join(", ")}`);
	}

	assertHttpsRemoteUrl(clientEnv.VITE_SUPABASE_URL, "VITE_SUPABASE_URL");
	assertHttpsRemoteUrl(serverEnv.SUPABASE_URL, "SUPABASE_URL");

	if (clientEnv.VITE_SUPABASE_URL !== serverEnv.SUPABASE_URL) {
		throw new Error(
			"client/.env.staging.local VITE_SUPABASE_URL must match " +
				"server/.env.staging.local SUPABASE_URL",
		);
	}
}

export function buildStagingProcessEnv({
	baseEnv = process.env,
	clientEnv,
	serverEnv,
	serverEnvPath,
}) {
	validateStagingEnv({ clientEnv, serverEnv });

	return {
		...baseEnv,
		...CLIENT_DEFAULTS,
		...SERVER_DEFAULTS,
		...clientEnv,
		...serverEnv,
		DOTENV_CONFIG_PATH: serverEnvPath,
	};
}

function missingFileMessage(missingFiles) {
	return [
		`Missing staging env file(s): ${missingFiles.join(", ")}`,
		"Create them from the examples and fill them with the dedicated staging Supabase project credentials:",
		"  cp client/.env.staging.example client/.env.staging.local",
		"  cp server/.env.staging.example server/.env.staging.local",
		"Do not use production Supabase credentials here.",
	].join("\n");
}

function runCli() {
	const missingFiles = [
		[clientEnvPath, "client/.env.staging.local"],
		[serverEnvPath, "server/.env.staging.local"],
	]
		.filter(([path]) => !existsSync(path))
		.map(([, label]) => label);

	if (missingFiles.length > 0) {
		console.error(missingFileMessage(missingFiles));
		process.exit(1);
	}

	let env;
	try {
		const clientEnv = readEnvFile(clientEnvPath);
		const serverEnv = readEnvFile(serverEnvPath);
		env = buildStagingProcessEnv({
			clientEnv,
			serverEnv,
			serverEnvPath,
		});
		console.log(
			`using hosted staging Supabase: ${clientEnv.VITE_SUPABASE_URL}`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Invalid staging env configuration.\n${message}`);
		process.exit(1);
	}

	const child = spawn(
		"pnpm",
		[
			"-r",
			"--parallel",
			"--filter",
			"@member-manager/client",
			"--filter",
			"@member-manager/server",
			"run",
			"dev",
		],
		{
			cwd: repoRoot,
			stdio: "inherit",
			env,
		},
	);

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
