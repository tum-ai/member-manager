#!/usr/bin/env node

import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const GIT_DIR = resolve(REPO_ROOT, ".git");
const PRE_COMMIT_TEMPLATE = resolve(REPO_ROOT, "scripts/git-hooks/pre-commit");
const LEGACY_PRE_PUSH_BACKUP_NAME =
	"pre-push.member-manager-full-gate.disabled";

export const LEGACY_MANAGED_PRE_PUSH_HOOK = `#!/bin/sh
set -eu

ROOT_DIR="$(git rev-parse --show-toplevel)"

echo "[pre-push] Running full gate (lint + build + test)"
pnpm --dir "$ROOT_DIR" gate
`;

function getLegacyPrePushMigration(hooksDir) {
	const legacyHook = resolve(hooksDir, "pre-push");

	if (!existsSync(legacyHook)) {
		return undefined;
	}

	const existing = readFileSync(legacyHook, "utf8");
	if (existing !== LEGACY_MANAGED_PRE_PUSH_HOOK) {
		return undefined;
	}

	const disabledHook = resolve(hooksDir, LEGACY_PRE_PUSH_BACKUP_NAME);
	if (existsSync(disabledHook)) {
		throw new Error(
			`Refusing to disable legacy .git/hooks/pre-push hook because .git/hooks/${LEGACY_PRE_PUSH_BACKUP_NAME} already exists.`,
		);
	}

	return { from: legacyHook, to: disabledHook };
}

export function installGitHooks({
	gitDir = GIT_DIR,
	templatePath = PRE_COMMIT_TEMPLATE,
} = {}) {
	if (!existsSync(gitDir)) {
		throw new Error("No .git directory found; run this from a git checkout.");
	}

	const hooksDir = resolve(gitDir, "hooks");
	mkdirSync(hooksDir, { recursive: true });

	const source = readFileSync(templatePath, "utf8");
	const destination = resolve(hooksDir, "pre-commit");
	const legacyPrePushMigration = getLegacyPrePushMigration(hooksDir);

	try {
		// Atomic create-or-fail: the `wx` flag (O_CREAT | O_EXCL) closes the
		// TOCTOU window between checking for and writing the hook.
		writeFileSync(destination, source, { flag: "wx", mode: 0o755 });
	} catch (error) {
		if (error?.code !== "EEXIST") {
			throw error;
		}
		// A hook already exists. Only re-install (idempotently) when it is
		// byte-for-byte our managed hook; refuse to clobber a foreign one.
		const existing = readFileSync(destination, "utf8");
		if (existing !== source) {
			throw new Error(
				"Refusing to overwrite an existing custom .git/hooks/pre-commit hook.",
			);
		}
	}
	chmodSync(destination, 0o755);

	if (legacyPrePushMigration) {
		renameSync(legacyPrePushMigration.from, legacyPrePushMigration.to);
	}

	return destination;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const destination = installGitHooks();
	console.log(`Installed pre-commit hook at ${destination}`);
}
