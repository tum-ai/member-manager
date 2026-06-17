import { defineConfig, devices } from "@playwright/test";

// Smoke E2E against the local stack. In CI the harness starts Supabase and
// writes .env.local first (see .github/workflows/e2e.yml); Playwright then
// boots the API server and the Vite dev client via the webServer entries
// below. Locally, run `pnpm dev:local` in another terminal and these reuse it.
const CLIENT_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";
const SERVER_URL = process.env.E2E_SERVER_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// Serial everywhere (not just CI): several specs sign in as the same seeded
	// users and mutate shared rows (agreements, SEPA, review queues), so parallel
	// workers race and flake. Until the suite is isolated per worker (worker-scoped
	// seeded accounts + runtime-created data), one worker keeps runs deterministic.
	workers: 1,
	reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
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
			command: "pnpm --filter @member-manager/server dev:local",
			url: `${SERVER_URL}/health`,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			stdout: "pipe",
			stderr: "pipe",
		},
		{
			command: "pnpm --filter @member-manager/client dev",
			url: CLIENT_URL,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			stdout: "pipe",
			stderr: "pipe",
		},
	],
});
