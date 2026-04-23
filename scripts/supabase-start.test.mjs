import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadEnvFile, parseDotenv } from "./supabase-start.mjs";

test("parseDotenv parses KEY=value lines", () => {
	const parsed = parseDotenv(
		[
			"# a comment",
			"",
			"FOO=bar",
			"BAZ=with spaces",
			'QUX="quoted value"',
			"EMPTY=",
		].join("\n"),
	);

	assert.deepEqual(parsed, {
		FOO: "bar",
		BAZ: "with spaces",
		QUX: "quoted value",
		EMPTY: "",
	});
});

test("parseDotenv ignores malformed lines and inline comments markers inside values", () => {
	const parsed = parseDotenv(
		["not a pair", "GOOD=yes", "NAME=value with # hash"].join("\n"),
	);

	assert.deepEqual(parsed, {
		GOOD: "yes",
		NAME: "value with # hash",
	});
});

test("loadEnvFile returns empty object when the file is missing", () => {
	const missing = join(tmpdir(), `no-such-env-${Date.now()}.local`);
	assert.deepEqual(loadEnvFile(missing), {});
});

test("loadEnvFile reads and parses a dotenv file", () => {
	const dir = mkdtempSync(join(tmpdir(), "supabase-start-env-"));
	try {
		const file = join(dir, ".env.local");
		writeFileSync(file, "SUPABASE_AUTH_EXTERNAL_SLACK_OIDC_CLIENT_ID=abc123\n");
		assert.deepEqual(loadEnvFile(file), {
			SUPABASE_AUTH_EXTERNAL_SLACK_OIDC_CLIENT_ID: "abc123",
		});
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
