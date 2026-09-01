/// <reference types="vitest" />
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	// PostHog's ingestion host, used only by the dev-server `/ingest` proxy that
	// mirrors the production rewrites in vercel.json. The asset host serves the
	// lazily-loaded extensions (session recorder, surveys) and follows PostHog's
	// `<region>.i` -> `<region>-assets.i` naming.
	const posthogHost =
		env.VITE_POSTHOG_PROXY_TARGET || "https://eu.i.posthog.com";
	const posthogAssetsHost = posthogHost.replace(
		".i.posthog.com",
		"-assets.i.posthog.com",
	);

	return {
		plugins: [react(), tailwindcss()],
		resolve: {
			alias: {
				"@": fileURLToPath(new URL("./src", import.meta.url)),
			},
		},
		server: {
			// Bind to every local interface so the dev server is reachable via
			// both `http://localhost:5173` and `http://127.0.0.1:5173`. macOS +
			// Node resolve `localhost` to `::1` first, so Vite's default localhost
			// binding skips IPv4 - and Supabase's OAuth callback redirects back
			// via `site_url`, which uses the 127.0.0.1 form.
			host: true,
			proxy: {
				"/api": {
					target: env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8787",
					changeOrigin: true,
				},
				// Same-origin PostHog proxy, matching the `/ingest` rewrites in
				// vercel.json so `VITE_POSTHOG_HOST=/ingest` behaves identically in
				// dev and production. Longest prefix first - Vite matches in key order.
				"/ingest/static": {
					target: posthogAssetsHost,
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/ingest/, ""),
				},
				"/ingest": {
					target: posthogHost,
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/ingest/, ""),
				},
			},
		},
		test: {
			// Two Vitest projects: the fast jsdom unit project (this block, applied
			// to the "unit" project via `extends: true`) and a separate headless-
			// browser "storybook" project (./vitest.storybook.config.ts) that runs
			// the stories' `play` interaction tests + a11y checks. Kept additive to
			// minimize merge conflicts with the concurrent MSW work (#185).
			projects: [
				{
					extends: true,
					test: {
						name: "unit",
						// Storybook stories run in the browser project, not here.
						exclude: ["**/*.stories.{ts,tsx}", "**/node_modules/**"],
					},
				},
				"./vitest.storybook.config.ts",
			],
			globals: true,
			environment: "jsdom",
			setupFiles: "./src/test/setup.ts",
			// On CI, add the github-actions reporter so failed tests annotate the
			// PR diff directly instead of hiding in the raw job log.
			reporters: process.env.CI ? ["default", "github-actions"] : ["default"],
			// v8 coverage instrumentation slows userEvent-heavy tests; give them
			// headroom so they don't time out on slower CI runners.
			testTimeout: 30_000,
			hookTimeout: 30_000,
			env: {
				VITE_SUPABASE_URL: "https://test.supabase.co",
				VITE_SUPABASE_ANON_KEY: "test-anon-key",
			},
			coverage: {
				provider: "v8",
				reporter: ["text-summary", "json-summary", "lcov"],
				// Count every source file, not just those a test imports, so a new
				// untested file drags the ratchet down instead of slipping past it.
				all: true,
				include: ["src/**/*.{ts,tsx}"],
				exclude: [
					"src/**/*.d.ts",
					"src/test/**",
					// Test files: explicit so they can never count as covered source
					// and inflate the ratio (vitest also excludes its test glob by
					// default; measured totals are identical with/without this entry).
					"src/**/*.test.{ts,tsx}",
					"src/**/*.stories.{ts,tsx}",
					"src/main.tsx",
					"src/vite-env.d.ts",
				],
				// Ratcheting floor: thresholds sit a safe margin (~2pt) below the
				// measured baseline (stmts 65.58 / branch 58.10 / func 59.81 /
				// lines 66.85) so an unrelated new file can't trip CI on the
				// global ratio. Raise these (never lower) as coverage improves.
				// The Phase-5 (#186) / #204 target was ~55/50/55/55 — now cleared
				// on all four metrics: MemberForm's split + tests, the PDF
				// generators, the legal/sepa/tools interaction tests, and the
				// profile feature + standalone-hook test sweep (#204) lifted
				// coverage well past target. `contracts/*` stays untested pending
				// its rework, capping further gains. See docs/development.md.
				thresholds: {
					statements: 63,
					branches: 56,
					functions: 57,
					lines: 64,
				},
			},
		},
	};
});
