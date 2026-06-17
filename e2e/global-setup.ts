import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FullConfig } from "@playwright/test";
import { SEED_CONTRACT_SIGN_TOKEN } from "./helpers";

const SERVER_URL = process.env.E2E_SERVER_URL ?? "http://127.0.0.1:8787";
const CLIENT_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";

// Read a single KEY=value from a dotenv file (the same files the web servers
// load). Returns undefined if the file is missing/unreadable or the key absent.
// This is intentionally a tiny parser — we only need the Supabase URL.
function readEnvFileValue(
	relativePath: string,
	key: string,
): string | undefined {
	let contents: string;
	try {
		contents = readFileSync(resolve(process.cwd(), relativePath), "utf8");
	} catch {
		return undefined;
	}
	for (const rawLine of contents.split("\n")) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq === -1 || line.slice(0, eq).trim() !== key) continue;
		let value = line.slice(eq + 1).trim();
		const quoted =
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"));
		if (quoted) value = value.slice(1, -1);
		return value;
	}
	return undefined;
}

// Loopback / link-local hostnames that denote a local, ephemeral stack.
const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)$/i;

// The E2E suite MUTATES the database (approves requests, creates events, signs
// contracts, edits members, …). It must therefore ONLY ever run against a local,
// ephemeral Supabase stack — never a shared/remote project. We fail fast here if
// any resolved target (the client/server the specs hit, or a Supabase/DB URL
// visible in the env) points anywhere non-local, so a misconfigured run aborts
// before the first write instead of corrupting real data.
function assertLocalTarget(label: string, raw: string | undefined): void {
	if (!raw) return;
	let host: string | undefined;
	try {
		host = new URL(raw).hostname;
	} catch {
		host = undefined;
	}
	const looksRemote =
		/supabase\.(?:co|in|net|com)/i.test(raw) ||
		(host !== undefined && !LOCAL_HOST.test(host) && !host.endsWith(".local"));
	if (looksRemote) {
		throw new Error(
			`E2E refuses to run: ${label} ("${raw}") is not a local target. The E2E ` +
				`suite mutates data and may ONLY run against a local ephemeral Supabase ` +
				`stack (loopback / *.local). Run \`supabase start\` + \`pnpm setup:local\`, ` +
				`and point E2E_BASE_URL / E2E_SERVER_URL / SUPABASE_URL at the local stack.`,
		);
	}
}

// Refuse to touch anything but a local, ephemeral stack — checked before any
// network call below so a remote misconfiguration never reaches the database.
function assertLocalStack(): void {
	assertLocalTarget("E2E_BASE_URL (client)", CLIENT_URL);
	assertLocalTarget("E2E_SERVER_URL (api)", SERVER_URL);
	// Also verify any Supabase/DB URL present in Playwright's own env.
	assertLocalTarget("SUPABASE_URL", process.env.SUPABASE_URL);
	assertLocalTarget("VITE_SUPABASE_URL", process.env.VITE_SUPABASE_URL);
	assertLocalTarget("DATABASE_URL", process.env.DATABASE_URL);
	// Critically, the web servers Playwright boots load their Supabase target from
	// these dotenv files — NOT from Playwright's process env (which `setup:local`
	// never exports into). A remote URL here with a local E2E_SERVER_URL would let
	// the local API write straight into a hosted project, so validate the files the
	// servers actually consume. (See Codex P1 on this guard.)
	assertLocalTarget(
		"server/.env.local SUPABASE_URL",
		readEnvFileValue("server/.env.local", "SUPABASE_URL"),
	);
	assertLocalTarget(
		"server/.env.local DATABASE_URL",
		readEnvFileValue("server/.env.local", "DATABASE_URL"),
	);
	assertLocalTarget(
		"client/.env.local VITE_SUPABASE_URL",
		readEnvFileValue("client/.env.local", "VITE_SUPABASE_URL"),
	);
}

// Deterministic-seed guard. The local Supabase stack loads supabase/seed.sql on
// `supabase start` / `db reset` (see [db.seed] in supabase/config.toml), so by
// the time Playwright runs, the fixtures the specs rely on must already exist.
// Rather than re-seed here (which would race the shared stack the specs share),
// we assert one representative seeded fixture is reachable through the API and
// fail fast with an actionable message if it is not — turning a confusing mid-
// run failure into a clear "the seed did not load" signal.
async function globalSetup(_config: FullConfig): Promise<void> {
	// Safety first: never run the mutating E2E suite against a non-local database.
	assertLocalStack();

	const url = `${SERVER_URL}/api/contracts/sign/${SEED_CONTRACT_SIGN_TOKEN}`;

	let response: Response;
	try {
		response = await fetch(url);
	} catch (error) {
		throw new Error(
			`E2E global setup: could not reach the API at ${SERVER_URL}. ` +
				`Is the local stack up (supabase start + pnpm setup:local)? ` +
				`Original error: ${(error as Error).message}`,
		);
	}

	if (response.status === 404) {
		throw new Error(
			`E2E global setup: seeded contract signing token not found ` +
				`(${SEED_CONTRACT_SIGN_TOKEN}). The database seed (supabase/seed.sql) ` +
				`does not appear to be loaded — run a fresh \`supabase start\` or ` +
				`\`supabase db reset\` before the suite.`,
		);
	}

	if (response.status === 409 || response.status === 410) {
		throw new Error(
			`E2E global setup: the seeded signing token (${SEED_CONTRACT_SIGN_TOKEN}) ` +
				`was already consumed (${response.status}) — the database is not fresh. ` +
				`Run \`supabase db reset\` (or a fresh \`supabase start\`) before the suite.`,
		);
	}

	if (!response.ok) {
		throw new Error(
			`E2E global setup: unexpected ${response.status} from ${url} while ` +
				`verifying seeded fixtures.`,
		);
	}
}

export default globalSetup;
