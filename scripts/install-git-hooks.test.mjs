import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	installGitHooks,
	installGitHooksSafe,
	LEGACY_ADVISORY_PRE_PUSH_HOOK,
	LEGACY_MANAGED_PRE_PUSH_HOOK,
} from "./install-git-hooks.mjs";

function makeFixture() {
	const root = mkdtempSync(join(tmpdir(), "member-manager-hooks-"));
	const gitDir = join(root, ".git");
	mkdirSync(join(gitDir, "hooks"), { recursive: true });
	const preCommitTemplate = join(root, "pre-commit.template");
	const prePushTemplate = join(root, "pre-push.template");
	writeFileSync(preCommitTemplate, '#!/bin/sh\nset -eu\necho "pre-commit"\n');
	writeFileSync(prePushTemplate, '#!/bin/sh\nset -eu\necho "pre-push"\n');
	return { root, gitDir, preCommitTemplate, prePushTemplate };
}

test("installGitHooks writes both the pre-commit and pre-push hooks", () => {
	const { root, gitDir, preCommitTemplate, prePushTemplate } = makeFixture();

	try {
		const { preCommit, prePush } = installGitHooks({
			gitDir,
			preCommitTemplate,
			prePushTemplate,
		});
		assert.equal(preCommit, join(gitDir, "hooks", "pre-commit"));
		assert.equal(prePush, join(gitDir, "hooks", "pre-push"));
		assert.equal(
			readFileSync(preCommit, "utf8"),
			readFileSync(preCommitTemplate, "utf8"),
		);
		assert.equal(
			readFileSync(prePush, "utf8"),
			readFileSync(prePushTemplate, "utf8"),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("installGitHooks refuses to overwrite a custom pre-commit hook", () => {
	const { root, gitDir, preCommitTemplate, prePushTemplate } = makeFixture();

	try {
		writeFileSync(
			join(gitDir, "hooks", "pre-commit"),
			"#!/bin/sh\necho custom\n",
		);
		assert.throws(
			() => installGitHooks({ gitDir, preCommitTemplate, prePushTemplate }),
			/custom \.git\/hooks\/pre-commit/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("installGitHooks refuses to overwrite a custom pre-push hook", () => {
	const { root, gitDir, preCommitTemplate, prePushTemplate } = makeFixture();

	try {
		writeFileSync(
			join(gitDir, "hooks", "pre-push"),
			"#!/bin/sh\necho custom\n",
		);
		assert.throws(
			() => installGitHooks({ gitDir, preCommitTemplate, prePushTemplate }),
			/custom \.git\/hooks\/pre-push/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("installGitHooks upgrades a legacy managed pre-push hook", () => {
	const { root, gitDir, preCommitTemplate, prePushTemplate } = makeFixture();

	try {
		writeFileSync(
			join(gitDir, "hooks", "pre-push"),
			LEGACY_MANAGED_PRE_PUSH_HOOK,
		);
		const { prePush } = installGitHooks({
			gitDir,
			preCommitTemplate,
			prePushTemplate,
		});
		assert.equal(
			readFileSync(prePush, "utf8"),
			readFileSync(prePushTemplate, "utf8"),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("installGitHooks upgrades the legacy advisory pre-push hook", () => {
	const { root, gitDir, preCommitTemplate, prePushTemplate } = makeFixture();

	try {
		writeFileSync(
			join(gitDir, "hooks", "pre-push"),
			LEGACY_ADVISORY_PRE_PUSH_HOOK,
		);
		const { prePush } = installGitHooks({
			gitDir,
			preCommitTemplate,
			prePushTemplate,
		});
		assert.equal(
			readFileSync(prePush, "utf8"),
			readFileSync(prePushTemplate, "utf8"),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("installGitHooks is idempotent for its own hooks", () => {
	const { root, gitDir, preCommitTemplate, prePushTemplate } = makeFixture();

	try {
		const first = installGitHooks({
			gitDir,
			preCommitTemplate,
			prePushTemplate,
		});
		const second = installGitHooks({
			gitDir,
			preCommitTemplate,
			prePushTemplate,
		});
		assert.deepEqual(first, second);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("installGitHooksSafe returns null when there is no .git directory", () => {
	const root = mkdtempSync(join(tmpdir(), "member-manager-hooks-"));
	try {
		const result = installGitHooksSafe({ gitDir: join(root, ".git") });
		assert.equal(result, null);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
