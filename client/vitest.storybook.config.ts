/// <reference types="vitest" />
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineProject } from "vitest/config";

// Storybook interaction-test project. Runs every story's `play` function plus
// the a11y checks in a real headless Chromium (browser mode) — kept separate
// from the fast jsdom unit project (see vite.config.ts `test.projects`) so the
// unit job stays quick and never spins up a browser. Wired into Vitest via
// `test.projects` and run in CI by the `storybook-test` job.
export default defineProject({
	// This project doesn't inherit vite.config.ts, so mirror the `@` -> src alias
	// the app and stories rely on.
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	plugins: [
		storybookTest({
			configDir: fileURLToPath(new URL("./.storybook", import.meta.url)),
		}),
	],
	test: {
		name: "storybook",
		// Mirror the jsdom unit project's env (vite.config.ts) so stories that
		// import the Supabase client during module evaluation don't throw.
		env: {
			VITE_SUPABASE_URL: "https://test.supabase.co",
			VITE_SUPABASE_ANON_KEY: "test-anon-key",
		},
		browser: {
			enabled: true,
			headless: true,
			provider: playwright({}),
			instances: [{ browser: "chromium" }],
		},
		// Since Storybook 10.3, @storybook/addon-vitest auto-applies the preview
		// annotations (decorators/parameters/globals), so no extra setup file is
		// needed here.
	},
});
