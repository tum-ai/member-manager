/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		// Bind to every local interface so the dev server is reachable via
		// both `http://localhost:5173` and `http://127.0.0.1:5173`. macOS +
		// Node resolve `localhost` to `::1` first, so Vite's default localhost
		// binding skips IPv4 - and Supabase's OAuth callback redirects back
		// via `site_url`, which uses the 127.0.0.1 form.
		host: true,
		proxy: {
			"/api": {
				target: "http://127.0.0.1:3000",
				changeOrigin: true,
			},
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: "./src/test/setup.ts",
		env: {
			VITE_SUPABASE_URL: "https://test.supabase.co",
			VITE_SUPABASE_ANON_KEY: "test-anon-key",
		},
	},
});
