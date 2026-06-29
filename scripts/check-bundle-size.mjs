#!/usr/bin/env node

// Bundle-size guard: gzip-measures the built client JS in client/dist/assets and
// fails when the total exceeds the budget. Run after
// `pnpm --filter @member-manager/client build`.
//
// The budget is intentionally a loose ceiling to catch gross regressions (e.g. a
// dependency accidentally doubling the bundle), not a tight per-byte gate. Read
// the measured total from the CI log and ratchet BUNDLE_SIZE_BUDGET_KB down as
// the real number settles.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_DIR = resolve(repoRoot, "client/dist/assets");
// Ceiling with headroom over the current ~705 kB gzipped baseline. Catches gross
// regressions (a dep doubling the bundle), not minor drift. Ratchet down (never
// blindly up) as the bundle is code-split; override per-run via BUNDLE_SIZE_BUDGET_KB.
const DEFAULT_BUDGET_KB = 900;

export function gzipSizeBytes(buffer) {
	return gzipSync(buffer, { level: 9 }).length;
}

export function formatKb(bytes) {
	return `${(bytes / 1024).toFixed(1)} kB`;
}

export function evaluateBudget(totalBytes, budgetBytes) {
	const within = totalBytes <= budgetBytes;
	return {
		ok: within,
		message: `Total gzipped JS ${formatKb(totalBytes)} ${
			within ? "within" : "exceeds"
		} budget ${formatKb(budgetBytes)}.`,
	};
}

export function collectJsAssets(dir) {
	if (!existsSync(dir)) {
		return [];
	}
	return readdirSync(dir)
		.filter((name) => name.endsWith(".js"))
		.map((name) => ({
			name,
			gzip: gzipSizeBytes(readFileSync(join(dir, name))),
		}))
		.sort((a, b) => b.gzip - a.gzip);
}

function budgetBytes() {
	const kb = Number(process.env.BUNDLE_SIZE_BUDGET_KB) || DEFAULT_BUDGET_KB;
	return kb * 1024;
}

export function runBundleSizeCheck({ assetsDir = ASSETS_DIR } = {}) {
	const assets = collectJsAssets(assetsDir);
	if (assets.length === 0) {
		console.error(
			`No JS assets found in ${assetsDir}. Run \`pnpm --filter @member-manager/client build\` first.`,
		);
		return 1;
	}

	for (const asset of assets) {
		console.log(`  ${formatKb(asset.gzip).padStart(10)}  ${asset.name}`);
	}

	const total = assets.reduce((sum, asset) => sum + asset.gzip, 0);
	const verdict = evaluateBudget(total, budgetBytes());
	console.log(`\n${verdict.message}`);

	if (!verdict.ok) {
		console.error(
			"Reduce the bundle (code-split, lazy-load, or trim deps) or raise BUNDLE_SIZE_BUDGET_KB deliberately.",
		);
		return 1;
	}
	return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	process.exitCode = runBundleSizeCheck();
}
