// Unit tests for the pure helpers behind the bundle-size guard. No build output
// required — fixtures are written to a tmp dir so the suite stays deterministic.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import {
	collectJsAssets,
	evaluateBudget,
	formatKb,
	gzipSizeBytes,
} from "./check-bundle-size.mjs";

test("gzipSizeBytes matches zlib gzip length", () => {
	const buffer = Buffer.from("a".repeat(1024));
	assert.equal(gzipSizeBytes(buffer), gzipSync(buffer, { level: 9 }).length);
});

test("formatKb renders one decimal kB", () => {
	assert.equal(formatKb(2048), "2.0 kB");
});

test("evaluateBudget flags over/under budget", () => {
	assert.equal(evaluateBudget(100, 200).ok, true);
	assert.equal(evaluateBudget(300, 200).ok, false);
	assert.match(evaluateBudget(300, 200).message, /exceeds/);
});

test("collectJsAssets returns only .js files sorted largest first", () => {
	const dir = mkdtempSync(join(tmpdir(), "member-manager-bundle-"));
	try {
		writeFileSync(join(dir, "small.js"), "x");
		writeFileSync(join(dir, "large.js"), "y".repeat(5000));
		writeFileSync(join(dir, "styles.css"), "ignored");

		const assets = collectJsAssets(dir);
		assert.deepEqual(
			assets.map((a) => a.name),
			["large.js", "small.js"],
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("collectJsAssets returns empty for a missing dir", () => {
	assert.deepEqual(collectJsAssets(join(tmpdir(), "does-not-exist-xyz")), []);
});
