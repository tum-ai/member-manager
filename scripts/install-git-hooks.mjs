#!/usr/bin/env node

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const GIT_DIR = resolve(REPO_ROOT, ".git");
const PRE_COMMIT_TEMPLATE = resolve(REPO_ROOT, "scripts/git-hooks/pre-commit");
const PRE_PUSH_TEMPLATE = resolve(REPO_ROOT, "scripts/git-hooks/pre-push");

// Previously-managed pre-push hook bodies. When the installed hook matches one
// of these we transparently upgrade it to the current template; anything else is
// treated as the user's own hook and left untouched.
export const LEGACY_MANAGED_PRE_PUSH_HOOK = `#!/bin/sh
set -eu

ROOT_DIR="$(git rev-parse --show-toplevel)"

echo "[pre-push] Running full gate (lint + build + test)"
pnpm --dir "$ROOT_DIR" gate
`;

export const LEGACY_ADVISORY_PRE_PUSH_HOOK = `#!/bin/sh
set -eu

echo "[pre-push] No repo-managed pre-push checks. Run pnpm gate manually when needed."
`;

const UPGRADEABLE_PRE_PUSH_HOOKS = [
	LEGACY_MANAGED_PRE_PUSH_HOOK,
	LEGACY_ADVISORY_PRE_PUSH_HOOK,
];

function installHook(hooksDir, name, content, upgradeable) {
	const destination = resolve(hooksDir, name);
	// Read-then-act without a prior existsSync probe: avoids a check-then-use
	// race and treats "absent" and "present" uniformly via the read result.
	let existing = null;
	try {
		existing = readFileSync(destination, "utf8");
	} catch {
		existing = null;
	}
	if (
		existing !== null &&
		existing !== content &&
		!upgradeable.includes(existing)
	) {
		throw new Error(`Refusing to overwrite a custom .git/hooks/${name} hook.`);
	}
	writeFileSync(destination, content);
	chmodSync(destination, 0o755);
	return destination;
}

export function installGitHooks({
	gitDir = GIT_DIR,
	preCommitTemplate = PRE_COMMIT_TEMPLATE,
	prePushTemplate = PRE_PUSH_TEMPLATE,
} = {}) {
	const hooksDir = resolve(gitDir, "hooks");
	// Create the hooks dir non-recursively (no existsSync probe → no race). This
	// fails fast when .git is missing (ENOENT) or is a worktree gitdir file
	// (ENOTDIR) instead of silently creating a bogus .git/hooks tree; an existing
	// hooks dir (EEXIST) is the normal, fine case.
	try {
		mkdirSync(hooksDir);
	} catch (error) {
		if (error.code !== "EEXIST") {
			throw new Error(
				`No usable .git/hooks directory at ${gitDir} (${error.code ?? error.message}); run this from a git checkout.`,
			);
		}
	}

	const preCommit = installHook(
		hooksDir,
		"pre-commit",
		readFileSync(preCommitTemplate, "utf8"),
		[],
	);
	const prePush = installHook(
		hooksDir,
		"pre-push",
		readFileSync(prePushTemplate, "utf8"),
		UPGRADEABLE_PRE_PUSH_HOOKS,
	);

	return { preCommit, prePush };
}

// Non-throwing variant for `prepare` / `pnpm install`: skips silently when there
// is no .git directory (CI / tarball installs) or a custom hook is present, so
// installing dependencies never fails on hook setup.
export function installGitHooksSafe(options) {
	try {
		return installGitHooks(options);
	} catch (error) {
		console.warn(`[hooks] Skipped git hook install: ${error.message}`);
		return null;
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const quiet = process.argv.includes("--quiet");
	const result = quiet ? installGitHooksSafe() : installGitHooks();
	if (result) {
		console.log(`Installed git hooks: ${result.preCommit}, ${result.prePush}`);
	}
}
