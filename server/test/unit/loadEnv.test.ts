import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DEFAULT_ENV_CHAIN, loadEnvChain } from "../../src/lib/loadEnv.js";

describe("loadEnvChain", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "member-manager-loadenv-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("loads a single .env file when only it exists", () => {
		writeFileSync(
			join(tmpDir, ".env"),
			"SUPABASE_URL=https://hosted.example\nPORT=3001\n",
		);

		const env = loadEnvChain({ packageRoot: tmpDir });

		assert.equal(env.SUPABASE_URL, "https://hosted.example");
		assert.equal(env.PORT, "3001");
	});

	it(".env.local overrides .env when both exist", () => {
		writeFileSync(
			join(tmpDir, ".env"),
			"SUPABASE_URL=https://hosted.example\nSHARED_KEY=from-env\n",
		);
		writeFileSync(
			join(tmpDir, ".env.local"),
			"SUPABASE_URL=http://127.0.0.1:54321\n",
		);

		const env = loadEnvChain({ packageRoot: tmpDir });

		assert.equal(
			env.SUPABASE_URL,
			"http://127.0.0.1:54321",
			".env.local must win over .env",
		);
		assert.equal(
			env.SHARED_KEY,
			"from-env",
			"keys only present in .env should still be loaded",
		);
	});

	it("an explicit DOTENV_CONFIG_PATH takes precedence over the default chain", () => {
		writeFileSync(
			join(tmpDir, ".env"),
			"SUPABASE_URL=https://hosted.example\n",
		);
		writeFileSync(
			join(tmpDir, ".env.local"),
			"SUPABASE_URL=http://127.0.0.1:54321\n",
		);
		writeFileSync(
			join(tmpDir, ".env.custom"),
			"SUPABASE_URL=http://custom.example\n",
		);

		const env = loadEnvChain({
			packageRoot: tmpDir,
			explicitPath: ".env.custom",
		});

		assert.equal(env.SUPABASE_URL, "http://custom.example");
	});

	it("is a no-op when no candidate files exist", () => {
		const env = loadEnvChain({ packageRoot: tmpDir });
		assert.equal(env.SUPABASE_URL, undefined);
	});

	it(".env does NOT override pre-existing process env (prod-safety)", () => {
		writeFileSync(
			join(tmpDir, ".env"),
			"SUPABASE_URL=https://from-dotenv.example\nCORS_ORIGIN=from-dotenv\n",
		);

		const target: NodeJS.ProcessEnv = {
			SUPABASE_URL: "https://from-platform.example",
		};

		loadEnvChain({ packageRoot: tmpDir, target });

		assert.equal(
			target.SUPABASE_URL,
			"https://from-platform.example",
			"platform env (e.g. Vercel dashboard) must win over a committed .env",
		);
		assert.equal(
			target.CORS_ORIGIN,
			"from-dotenv",
			".env should still fill in keys that are not set on the platform",
		);
	});

	it(".env.local DOES override pre-existing process env (explicit dev opt-in)", () => {
		writeFileSync(
			join(tmpDir, ".env.local"),
			"SUPABASE_URL=http://127.0.0.1:54321\n",
		);

		const target: NodeJS.ProcessEnv = {
			SUPABASE_URL: "https://hosted.example",
		};

		loadEnvChain({ packageRoot: tmpDir, target });

		assert.equal(
			target.SUPABASE_URL,
			"http://127.0.0.1:54321",
			".env.local is the developer's explicit local override and must win",
		);
	});

	it("exposes the default chain order (.env, then .env.local)", () => {
		assert.deepEqual(DEFAULT_ENV_CHAIN, [".env", ".env.local"]);
	});
});
