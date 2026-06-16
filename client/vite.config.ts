/// <reference types="vitest" />
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

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
			},
		},
		test: {
			globals: true,
			environment: "jsdom",
			setupFiles: "./src/test/setup.ts",
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
					"src/**/*.stories.{ts,tsx}",
					"src/main.tsx",
					"src/vite-env.d.ts",
				],
				// Ratcheting floor: thresholds sit a safe margin (>1.5pt) below the
				// measured baseline (stmts 36.98 / branch 36.76 / func 37.64 /
				// lines 37.93) so an unrelated new file can't trip CI on the
				// global ratio. Raise these (never lower) as coverage improves.
				// See docs/development.md.
				thresholds: {
					statements: 35,
					branches: 35,
					functions: 36,
					lines: 36,
				},
			},
		},
	};
});
