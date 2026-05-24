import assert from "node:assert/strict";
import test from "node:test";
import { buildStagingProcessEnv, validateStagingEnv } from "./dev-staging.mjs";

const validClientEnv = {
	VITE_SUPABASE_URL: "https://staging-project.supabase.co",
	VITE_SUPABASE_ANON_KEY: "anon-key",
};

const validServerEnv = {
	SUPABASE_URL: "https://staging-project.supabase.co",
	SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
	FIELD_ENCRYPTION_KEY: "staging-encryption-key",
};

test("validateStagingEnv accepts matching hosted Supabase URLs", () => {
	assert.doesNotThrow(() =>
		validateStagingEnv({
			clientEnv: validClientEnv,
			serverEnv: validServerEnv,
		}),
	);
});

test("validateStagingEnv rejects localhost Supabase URLs", () => {
	assert.throws(
		() =>
			validateStagingEnv({
				clientEnv: {
					...validClientEnv,
					VITE_SUPABASE_URL: "http://127.0.0.1:54321",
				},
				serverEnv: {
					...validServerEnv,
					SUPABASE_URL: "http://127.0.0.1:54321",
				},
			}),
		/https:\/\/ for staging/,
	);
});

test("validateStagingEnv requires client and server to share one Supabase project", () => {
	assert.throws(
		() =>
			validateStagingEnv({
				clientEnv: validClientEnv,
				serverEnv: {
					...validServerEnv,
					SUPABASE_URL: "https://different-project.supabase.co",
				},
			}),
		/must match/,
	);
});

test("buildStagingProcessEnv overrides stale local-dev process env", () => {
	const env = buildStagingProcessEnv({
		baseEnv: {
			VITE_SUPABASE_URL: "http://127.0.0.1:54321",
			SUPABASE_URL: "http://127.0.0.1:54321",
			VITE_API_PROXY_TARGET: "http://127.0.0.1:3000",
			ENABLE_LOCAL_ADMIN_BOOTSTRAP: "true",
		},
		clientEnv: validClientEnv,
		serverEnv: validServerEnv,
		serverEnvPath: "/repo/server/.env.staging.local",
	});

	assert.equal(env.VITE_SUPABASE_URL, "https://staging-project.supabase.co");
	assert.equal(env.SUPABASE_URL, "https://staging-project.supabase.co");
	assert.equal(env.VITE_API_PROXY_TARGET, "http://127.0.0.1:8787");
	assert.equal(env.ENABLE_LOCAL_ADMIN_BOOTSTRAP, "false");
	assert.equal(env.DOTENV_CONFIG_PATH, "/repo/server/.env.staging.local");
});
