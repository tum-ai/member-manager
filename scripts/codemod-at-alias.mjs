#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

// Codemod: rewrite parent-relative ("../") import/export specifiers under
// client/src onto the existing "@/" alias ("@/* -> ./src/*").
//
// Scope (issue #202): ALL parent-relative specifiers ("../", "../../", ...).
// Same-directory ("./...") and non-relative ("@/...", packages) are untouched.
// Only the specifier string is rewritten; quotes/formatting are preserved and
// any file extension is kept exactly as written. Idempotent.

const SRC_ROOT = resolve(process.cwd(), "client", "src");

/** Recurse a directory, yielding absolute paths of .ts/.tsx files. */
function* walk(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(full);
		} else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
			yield full;
		}
	}
}

// Matches the specifier in static imports/exports and dynamic import() calls.
// Group 1: leading syntax up to the opening quote. Group 2: quote char.
// Group 3: the specifier. Group 4: closing quote.
const SPEC_RE =
	/(\bimport\s*\(\s*|\b(?:import|export)\b[^'"]*?\bfrom\s*|\bimport\s+)(['"])(\.\.\/[^'"]*)(\2)/g;

/**
 * Rewrite a single file's contents. Returns the new contents (possibly
 * unchanged).
 */
export function rewriteContents(contents, fileAbsPath, { warn = console.warn } = {}) {
	const fileDir = dirname(fileAbsPath);
	return contents.replace(SPEC_RE, (match, pre, quote, spec, close) => {
		const targetAbs = resolve(fileDir, spec);
		const rel = relative(SRC_ROOT, targetAbs);
		if (rel.startsWith("..") || rel.startsWith(sep) || rel === "") {
			warn(
				`[codemod-at-alias] WARNING: ${spec} in ${fileAbsPath} resolves outside client/src; leaving unchanged.`,
			);
			return match;
		}
		const aliased = `@/${rel.split(sep).join("/")}`;
		return `${pre}${quote}${aliased}${close}`;
	});
}

function main() {
	let changed = 0;
	let scanned = 0;
	for (const file of walk(SRC_ROOT)) {
		scanned++;
		const original = readFileSync(file, "utf8");
		const next = rewriteContents(original, file);
		if (next !== original) {
			writeFileSync(file, next);
			changed++;
			console.log(`rewrote ${relative(process.cwd(), file)}`);
		}
	}
	console.log(`\n${changed} file(s) changed (${scanned} scanned).`);
}

// Run only when invoked directly (not when imported by tests).
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(import.meta.dirname, "codemod-at-alias.mjs")) {
	main();
}
