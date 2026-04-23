#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const GIT_DIR = resolve(REPO_ROOT, ".git");
const HOOKS_DIR = resolve(GIT_DIR, "hooks");
const PRE_PUSH_TEMPLATE = resolve(REPO_ROOT, "scripts/git-hooks/pre-push");

export function installGitHooks({
	gitDir = GIT_DIR,
	templatePath = PRE_PUSH_TEMPLATE,
} = {}) {
	if (!existsSync(gitDir)) {
		throw new Error("No .git directory found; run this from a git checkout.");
	}

	const hooksDir = resolve(gitDir, "hooks");
	mkdirSync(hooksDir, { recursive: true });

	const source = readFileSync(templatePath, "utf8");
	const destination = resolve(hooksDir, "pre-push");

	if (existsSync(destination)) {
		const existing = readFileSync(destination, "utf8");
		if (existing !== source) {
			throw new Error(
				"Refusing to overwrite an existing custom .git/hooks/pre-push hook.",
			);
		}
	}

	writeFileSync(destination, source);
	chmodSync(destination, 0o755);

	return destination;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const destination = installGitHooks();
	console.log(`Installed pre-push hook at ${destination}`);
}
