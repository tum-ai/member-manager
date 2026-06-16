import type { FullConfig } from "@playwright/test";
import { SEED_CONTRACT_SIGN_TOKEN } from "./helpers";

const SERVER_URL = process.env.E2E_SERVER_URL ?? "http://127.0.0.1:8787";

// Deterministic-seed guard. The local Supabase stack loads supabase/seed.sql on
// `supabase start` / `db reset` (see [db.seed] in supabase/config.toml), so by
// the time Playwright runs, the fixtures the specs rely on must already exist.
// Rather than re-seed here (which would race the shared stack the specs share),
// we assert one representative seeded fixture is reachable through the API and
// fail fast with an actionable message if it is not — turning a confusing mid-
// run failure into a clear "the seed did not load" signal.
async function globalSetup(_config: FullConfig): Promise<void> {
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

	if (!response.ok) {
		throw new Error(
			`E2E global setup: unexpected ${response.status} from ${url} while ` +
				`verifying seeded fixtures.`,
		);
	}
}

export default globalSetup;
