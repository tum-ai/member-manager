#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// File-size policy (lines):
//   - HARD-FAIL (exit 1) gated files exceeding HARD_LIMIT
//   - SOFT-WARN (non-failing) gated files exceeding SOFT_LIMIT
export const HARD_LIMIT = 700;
export const SOFT_LIMIT = 400;

// Paths the size policy applies to (everything else is "ignored").
const GATED_PATTERNS = [
	/^client\/src\/features\/.+\.tsx$/,
	/^client\/src\/components\/layout\/.+\.tsx$/,
];

// Exempt from the size policy entirely.
const EXEMPT_PATTERNS = [
	/^client\/src\/components\/ui\//,
	/\.d\.ts$/,
	/\.stories\.tsx$/,
	/\.test\.tsx?$/,
];

// Current offenders (genuinely >700 lines). Exempt from hard-fail but each
// prints a backlog notice. Tracked as remediation backlog in #189.
export const ALLOWLIST = [
	"client/src/features/profile/ProfilePage.tsx",
	"client/src/features/contracts/ContractTemplatesPage.tsx",
	"client/src/features/contracts/ContractSubmissionDetailPage.tsx",
	"client/src/features/tools/TumaiDaysPage.tsx",
	"client/src/features/jobs/JobPostingsPage.tsx",
	"client/src/features/reimbursements/ReimbursementPage.tsx",
	"client/src/features/members/MemberForm.tsx",
];

/**
 * Classify a file against the size policy.
 *
 * @returns {{status: "ok"|"ignored"|"exempt"|"soft-warn"|"allowlisted"|"hard-fail", limit?: number}}
 */
export function classifyFile(path, lineCount, { allowlist = ALLOWLIST } = {}) {
	if (EXEMPT_PATTERNS.some((re) => re.test(path))) {
		return { status: "exempt" };
	}
	if (!GATED_PATTERNS.some((re) => re.test(path))) {
		return { status: "ignored" };
	}

	if (lineCount > HARD_LIMIT) {
		if (allowlist.includes(path)) {
			return { status: "allowlisted", limit: HARD_LIMIT };
		}
		return { status: "hard-fail", limit: HARD_LIMIT };
	}

	if (lineCount > SOFT_LIMIT) {
		return { status: "soft-warn", limit: SOFT_LIMIT };
	}

	return { status: "ok" };
}

const FEATURE_DIR_PATTERN = /^(client\/src\/features\/[^/]+)\//;
// Anchored to line starts (`m` flag) and bounded by `;` so a match can't span
// across statements. Block comments are stripped before scanning (see
// findCrossFeatureImports), so import-like text in comments or string literals
// is not misreported.
const IMPORT_PATTERN =
	/^[ \t]*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']|^[ \t]*import\s*["']([^"']+)["']/gm;

function featureRootOf(path) {
	const match = FEATURE_DIR_PATTERN.exec(path);
	return match ? match[1] : null;
}

/**
 * Normalize a POSIX-style path, collapsing "." and ".." segments.
 */
export function normalizePosixPath(path) {
	const segments = [];
	for (const segment of path.split("/")) {
		if (segment === "" || segment === ".") {
			continue;
		}
		if (segment === "..") {
			segments.pop();
			continue;
		}
		segments.push(segment);
	}
	return segments.join("/");
}

/**
 * Find relative imports (`../...`) that resolve OUTSIDE the importing file's
 * own `client/src/features/<feature>/` directory.
 *
 * Non-failing WARNING signal: returns the offending specifiers so the caller
 * can print them. Convention: use the `@/` alias to cross folder boundaries,
 * reserve relative imports for within a single feature.
 *
 * @returns {{specifier: string, resolved: string}[]}
 */
export function findCrossFeatureImports(path, source) {
	const featureRoot = featureRootOf(path);
	if (!featureRoot) {
		return [];
	}

	const fileDir = path.slice(0, path.lastIndexOf("/"));
	const offenders = [];
	// Strip block comments so commented-out import lines aren't misreported.
	const scannable = source.replace(/\/\*[\s\S]*?\*\//g, "");
	IMPORT_PATTERN.lastIndex = 0;
	let match = IMPORT_PATTERN.exec(scannable);
	while (match !== null) {
		const specifier = match[1] ?? match[2];
		match = IMPORT_PATTERN.exec(scannable);
		if (!specifier?.startsWith("../")) {
			continue;
		}
		const resolved = normalizePosixPath(`${fileDir}/${specifier}`);
		if (resolved !== featureRoot && !resolved.startsWith(`${featureRoot}/`)) {
			offenders.push({ specifier, resolved });
		}
	}
	return offenders;
}

/**
 * Detect allowlist entries that no longer belong: either no longer tracked
 * (renamed or deleted) or no longer exceeding the hard limit (file was split
 * below the threshold). Non-failing warning so the allowlist self-cleans.
 *
 * @returns {{path: string, reason: string}[]}
 */
export function findStaleAllowlist(
	trackedFiles,
	lineCounts,
	allowlist = ALLOWLIST,
) {
	const tracked = new Set(trackedFiles);
	const stale = [];
	for (const entry of allowlist) {
		if (!tracked.has(entry)) {
			stale.push({
				path: entry,
				reason: "no longer tracked (renamed or deleted)",
			});
			continue;
		}
		const lineCount = lineCounts.get(entry) ?? 0;
		if (lineCount <= HARD_LIMIT) {
			stale.push({
				path: entry,
				reason: `now ${lineCount} lines (<= ${HARD_LIMIT})`,
			});
		}
	}
	return stale;
}

function listTrackedFiles() {
	const output = execFileSync("git", ["ls-files", "-z"], {
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	return output.split("\0").filter(Boolean);
}

/**
 * Count lines in a source string, matching `wc -l` semantics plus a final
 * line that lacks a trailing newline.
 */
export function countLinesInSource(source) {
	if (source === "") {
		return 0;
	}
	let lineCount = 0;
	for (const char of source) {
		if (char === "\n") {
			lineCount++;
		}
	}
	// Count a final non-empty line without a trailing newline.
	if (!source.endsWith("\n")) {
		lineCount++;
	}
	return lineCount;
}

function countLines(path) {
	const source = readFileSync(path, "utf8");
	return { lineCount: countLinesInSource(source), source };
}

export function main() {
	const files = listTrackedFiles();

	const hardFailures = [];
	const softWarnings = [];
	const allowlistNotices = [];
	const crossFeatureWarnings = [];
	const lineCounts = new Map();

	for (const path of files) {
		if (!path.endsWith(".tsx") && !path.endsWith(".ts")) {
			continue;
		}

		const { lineCount, source } = countLines(path);
		lineCounts.set(path, lineCount);
		const { status, limit } = classifyFile(path, lineCount);

		if (status === "hard-fail") {
			hardFailures.push({ path, lineCount, limit });
		} else if (status === "soft-warn") {
			softWarnings.push({ path, lineCount, limit });
		} else if (status === "allowlisted") {
			allowlistNotices.push({ path, lineCount, limit });
		}

		const offenders = findCrossFeatureImports(path, source);
		if (offenders.length > 0) {
			crossFeatureWarnings.push({ path, offenders });
		}
	}

	if (allowlistNotices.length > 0) {
		console.log("Backlog (allowlisted oversize files — tracked in #189):");
		for (const { path, lineCount, limit } of allowlistNotices) {
			console.log(`  - ${path} (${lineCount} lines > ${limit})`);
		}
		console.log("");
	}

	if (softWarnings.length > 0) {
		console.log(`Soft warnings (> ${SOFT_LIMIT} lines, non-failing):`);
		for (const { path, lineCount, limit } of softWarnings) {
			console.log(`  - ${path} (${lineCount} lines > ${limit})`);
		}
		console.log("");
	}

	if (crossFeatureWarnings.length > 0) {
		console.log(
			"Cross-feature relative-import WARNING (non-failing): prefer the `@/` alias.",
		);
		for (const { path, offenders } of crossFeatureWarnings) {
			for (const { specifier } of offenders) {
				console.log(`  - ${path} imports "${specifier}"`);
			}
		}
		console.log("");
	}

	const staleAllowlist = findStaleAllowlist(files, lineCounts);
	if (staleAllowlist.length > 0) {
		console.log(
			"Stale allowlist entries (non-failing) — remove from ALLOWLIST in scripts/check-file-size.mjs:",
		);
		for (const { path, reason } of staleAllowlist) {
			console.log(`  - ${path}: ${reason}`);
		}
		console.log("");
	}

	if (hardFailures.length > 0) {
		console.error(`File-size hard limit exceeded (> ${HARD_LIMIT} lines):`);
		for (const { path, lineCount, limit } of hardFailures) {
			console.error(`  - ${path} (${lineCount} lines > ${limit})`);
		}
		console.error(
			"\nSplit these files or, if intentional, add them to the allowlist in scripts/check-file-size.mjs.",
		);
		return 1;
	}

	console.log(
		"File-size guardrail passed: no non-allowlisted file exceeds the hard limit.",
	);
	return 0;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	process.exitCode = main();
}
