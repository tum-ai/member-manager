import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { installGitHooks } from "./install-git-hooks.mjs";

function makeFixture() {
	const root = mkdtempSync(join(tmpdir(), "member-manager-hooks-"));
	const gitDir = join(root, ".git");
	mkdirSync(join(gitDir, "hooks"), { recursive: true });
	const templatePath = join(root, "pre-push.template");
	writeFileSync(
		templatePath,
		"#!/bin/sh\nset -eu\necho \"hook\"\n",
	);
	return { root, gitDir, templatePath };
}

test("installGitHooks writes the pre-push hook", () => {
	const { root, gitDir, templatePath } = makeFixture();

	try {
		const destination = installGitHooks({ gitDir, templatePath });
		assert.equal(
			readFileSync(destination, "utf8"),
			readFileSync(templatePath, "utf8"),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("installGitHooks refuses to overwrite a custom hook", () => {
	const { root, gitDir, templatePath } = makeFixture();

	try {
		writeFileSync(join(gitDir, "hooks", "pre-push"), "#!/bin/sh\necho custom\n");
		assert.throws(
			() => installGitHooks({ gitDir, templatePath }),
			/custom \.git\/hooks\/pre-push/,
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
