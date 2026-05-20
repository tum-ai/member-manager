import assert from "node:assert/strict";
import {
	existsSync,
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
	LEGACY_MANAGED_PRE_PUSH_HOOK,
} from "./install-git-hooks.mjs";

function makeFixture() {
	const root = mkdtempSync(join(tmpdir(), "member-manager-hooks-"));
	const gitDir = join(root, ".git");
	mkdirSync(join(gitDir, "hooks"), { recursive: true });
	const templatePath = join(root, "pre-commit.template");
	writeFileSync(templatePath, '#!/bin/sh\nset -eu\necho "hook"\n');
	return { root, gitDir, templatePath };
}

test("installGitHooks writes the pre-commit hook", () => {
	const { root, gitDir, templatePath } = makeFixture();

	try {
		const destination = installGitHooks({ gitDir, templatePath });
		assert.equal(destination, join(gitDir, "hooks", "pre-commit"));
		assert.equal(
			readFileSync(destination, "utf8"),
			readFileSync(templatePath, "utf8"),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("installGitHooks refuses to overwrite a custom pre-commit hook", () => {
	const { root, gitDir, templatePath } = makeFixture();

	try {
		writeFileSync(
			join(gitDir, "hooks", "pre-commit"),
			"#!/bin/sh\necho custom\n",
		);
		assert.throws(
			() => installGitHooks({ gitDir, templatePath }),
			/custom \.git\/hooks\/pre-commit/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("installGitHooks is idempotent for its own hook", () => {
	const { root, gitDir, templatePath } = makeFixture();

	try {
		const first = installGitHooks({ gitDir, templatePath });
		const second = installGitHooks({ gitDir, templatePath });
		assert.equal(first, second);
		assert.equal(
			readFileSync(first, "utf8"),
			readFileSync(templatePath, "utf8"),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("installGitHooks disables the legacy managed pre-push hook", () => {
	const { root, gitDir, templatePath } = makeFixture();
	const prePushHook = join(gitDir, "hooks", "pre-push");
	const disabledPrePushHook = join(
		gitDir,
		"hooks",
		"pre-push.member-manager-full-gate.disabled",
	);

	try {
		writeFileSync(prePushHook, LEGACY_MANAGED_PRE_PUSH_HOOK);

		installGitHooks({ gitDir, templatePath });

		assert.equal(existsSync(prePushHook), false);
		assert.equal(
			readFileSync(disabledPrePushHook, "utf8"),
			LEGACY_MANAGED_PRE_PUSH_HOOK,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("installGitHooks leaves custom pre-push hooks untouched", () => {
	const { root, gitDir, templatePath } = makeFixture();
	const prePushHook = join(gitDir, "hooks", "pre-push");
	const customPrePushHook = "#!/bin/sh\necho custom\n";

	try {
		writeFileSync(prePushHook, customPrePushHook);

		installGitHooks({ gitDir, templatePath });

		assert.equal(readFileSync(prePushHook, "utf8"), customPrePushHook);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
