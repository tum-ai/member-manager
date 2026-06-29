// Unit tests for the pure helpers behind `pnpm doctor`. The network-dependent
// checks (Supabase reachability, seed sign-in) skip gracefully at runtime and
// are exercised by verify-local-seed.test.mjs against a live stack, so they are
// intentionally not covered here — these tests stay deterministic and offline.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	envFileStatus,
	expectedNodeMajor,
	nodeVersionStatus,
} from "./doctor.mjs";

test("expectedNodeMajor parses .nvmrc and version strings", () => {
	assert.equal(expectedNodeMajor("24"), 24);
	assert.equal(expectedNodeMajor("24\n"), 24);
	assert.equal(expectedNodeMajor("v24.3.0"), 24);
	assert.equal(expectedNodeMajor("lts/*"), null);
	assert.equal(expectedNodeMajor(""), null);
});

test("nodeVersionStatus passes on a matching major", () => {
	const status = nodeVersionStatus("v24.3.0", "24");
	assert.equal(status.level, "pass");
});

test("nodeVersionStatus fails on a mismatched major", () => {
	const status = nodeVersionStatus("v20.11.0", "24");
	assert.equal(status.level, "fail");
	assert.match(status.message, /does not match/);
});

test("nodeVersionStatus warns when .nvmrc cannot be parsed", () => {
	const status = nodeVersionStatus("v24.3.0", "lts/*");
	assert.equal(status.level, "warn");
});

test("envFileStatus reports presence per file", () => {
	const root = mkdtempSync(join(tmpdir(), "member-manager-doctor-"));
	try {
		mkdirSync(join(root, "client"), { recursive: true });
		mkdirSync(join(root, "server"), { recursive: true });
		writeFileSync(join(root, "client/.env.local"), "VITE_SUPABASE_URL=x\n");

		const statuses = envFileStatus(root);
		const byPath = Object.fromEntries(statuses.map((s) => [s.path, s.exists]));

		assert.equal(byPath["client/.env.local"], true);
		assert.equal(byPath["server/.env.local"], false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
