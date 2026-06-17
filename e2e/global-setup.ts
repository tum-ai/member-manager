import type { FullConfig } from "@playwright/test";
import { SEED_CONTRACT_SIGN_TOKEN } from "./helpers";

const SERVER_URL = process.env.E2E_SERVER_URL ?? "http://127.0.0.1:8787";
const CLIENT_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";

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
		/supabase\.(?:co|in|net)/i.test(raw) ||
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
	// The API server reads these; when they are also present in Playwright's env
	// (e.g. CI's generated .env.local), verify them too as defence in depth.
	assertLocalTarget("SUPABASE_URL", process.env.SUPABASE_URL);
	assertLocalTarget("VITE_SUPABASE_URL", process.env.VITE_SUPABASE_URL);
	assertLocalTarget("DATABASE_URL", process.env.DATABASE_URL);
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
