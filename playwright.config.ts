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
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
	use: {
		baseURL: CLIENT_URL,
		trace: "on-first-retry",
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
