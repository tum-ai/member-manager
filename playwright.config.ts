import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Smoke E2E against the local stack. In CI the harness starts Supabase and
// writes .env.local first (see .github/workflows/e2e.yml); Playwright then
// boots the API server and the Vite dev client via the webServer entries
// below. Locally, only the seeded Supabase stack must already be running; the
// E2E API process is always isolated so finance settings cannot leak in.
const CLIENT_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";
const SERVER_URL = process.env.E2E_SERVER_URL ?? "http://127.0.0.1:8787";
const CLIENT_PORT = new URL(CLIENT_URL).port || "5173";
const SERVER_PORT = new URL(SERVER_URL).port || "8787";
const PARTNER_PORTAL_STUB_PORT = process.env.PARTNER_PORTAL_STUB_PORT ?? "8791";
const PARTNER_PORTAL_STUB_URL = `http://127.0.0.1:${PARTNER_PORTAL_STUB_PORT}`;
const USE_REAL_BB_POSTINGS = process.env.E2E_BB_LIVE === "true";
const serverEnvPath = resolve("server/.env.local");
const serverLocalEnv = existsSync(serverEnvPath)
	? dotenv.parse(readFileSync(serverEnvPath))
	: {};

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// One retry on CI to absorb genuine boot/timing flakes. We deliberately do not
	// retry more: specs mutate shared seeded rows and globalSetup's reset does not
	// re-run between retries, so a retry re-runs against an already-mutated DB —
	// extra attempts mask real breakage more than they recover from it.
	retries: process.env.CI ? 1 : 0,
	// Serial everywhere (not just CI): several specs sign in as the same seeded
	// users and mutate shared rows (agreements, SEPA, review queues), so parallel
	// workers race and flake. Until the suite is isolated per worker (worker-scoped
	// seeded accounts + runtime-created data), one worker keeps runs deterministic.
	workers: 1,
	// `github` reporter annotates failed specs directly on the PR diff in CI.
	reporter: process.env.CI
		? [["github"], ["html", { open: "never" }], ["list"]]
		: "list",
	// Fail fast if the deterministic DB seed (supabase/seed.sql) is not loaded,
	// so the heavier flows have their fixtures guaranteed (see e2e/global-setup).
	globalSetup: "./e2e/global-setup.ts",
	use: {
		baseURL: CLIENT_URL,
		// Retain a trace for any failed test (not only first-retry) so the
		// multi-step reimbursement and contract-signing flows stay debuggable from
		// the uploaded CI artifact.
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: [
		{
			command: "node e2e/partner-portal-stub.mjs",
			url: `${PARTNER_PORTAL_STUB_URL}/health`,
			reuseExistingServer: !process.env.CI,
			timeout: 30_000,
			stdout: "pipe",
			stderr: "pipe",
		},
		{
			command: "pnpm --filter @member-manager/server dev:local",
			url: `${SERVER_URL}/health`,
			// Never reuse an API process with unknown finance settings. The E2E
			// server is forced to mock mode unless the dedicated live smoke command
			// explicitly opts in.
			reuseExistingServer: false,
			timeout: 120_000,
			stdout: "pipe",
			stderr: "pipe",
			env: {
				...process.env,
				...serverLocalEnv,
				CORS_ORIGIN: CLIENT_URL,
				DOTENV_CONFIG_PATH: "/dev/null",
				PARTNER_PORTAL_API_URL: PARTNER_PORTAL_STUB_URL,
				PARTNER_PORTAL_API_TOKEN: "e2e-partner-management-token",
				BUCHHALTUNGSBUTLER_POSTINGS_USE_REAL_API: USE_REAL_BB_POSTINGS
					? "true"
					: "false",
				BB_USE_REAL_API: USE_REAL_BB_POSTINGS ? "1" : "0",
				PORT: SERVER_PORT,
			},
		},
		{
			command: `pnpm --filter @member-manager/client exec vite --host 127.0.0.1 --port ${CLIENT_PORT}`,
			url: CLIENT_URL,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			stdout: "pipe",
			stderr: "pipe",
			env: {
				...process.env,
				VITE_API_PROXY_TARGET: SERVER_URL,
			},
		},
	],
});
