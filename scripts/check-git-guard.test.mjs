import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, test } from "node:test";

// `.claude/hooks/git-guard.sh` is the PreToolUse guard for every Bash command
// Claude Code runs in this repo. Exit 2 blocks the command; anything else lets
// it through. These cases pin the policy: no force pushes, no pushes to main,
// no destructive resets/cleans, no remote Supabase writes.
const HOOK = resolve(".claude/hooks/git-guard.sh");

const scratch = mkdtempSync(join(tmpdir(), "git-guard-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function repoOnBranch(branch) {
	const dir = join(scratch, branch.replaceAll("/", "-"));
	mkdirSync(dir);
	execFileSync("git", ["init", "--quiet", "--initial-branch", branch, dir]);
	return dir;
}

const onMain = repoOnBranch("main");
const onFeature = repoOnBranch("feat/example");

function runHook(command, { cwd = onFeature, env = process.env } = {}) {
	return spawnSync("bash", [HOOK], {
		cwd,
		env,
		input: JSON.stringify({ tool_input: { command } }),
		encoding: "utf8",
	});
}

function assertBlocked(command, options) {
	const result = runHook(command, options);
	assert.equal(
		result.status,
		2,
		`expected block: ${command}\n${result.stderr}`,
	);
	assert.match(result.stderr, /git-guard: blocked/);
}

function assertAllowed(command, options) {
	const result = runHook(command, options);
	assert.equal(
		result.status,
		0,
		`expected allow: ${command}\n${result.stderr}`,
	);
}

describe("git-guard blocks", () => {
	for (const command of [
		"git push --force",
		"git push origin feat/x --force",
		"git push -f origin feat/x",
		"git -C ../other push -f",
		"git push --force-with-lease origin feat/x",
		"git push origin +feat/x",
		"git push origin main",
		"git push -u origin HEAD:main",
		"git push origin refs/heads/main",
		"pnpm lint && git push origin main",
		"git reset --hard HEAD~1",
		"git clean -fd",
		"rm -rf node_modules",
		"supabase db push",
		"supabase link --project-ref abc",
	]) {
		test(command, () => assertBlocked(command));
	}

	for (const command of [
		"git push",
		"git push origin",
		"git push -u origin HEAD",
	]) {
		test(`${command} (on main)`, () => assertBlocked(command, { cwd: onMain }));
	}
});

describe("git-guard allows", () => {
	for (const command of [
		"git status",
		"pnpm gate",
		"git push origin fix/main-nav",
		"git push -u origin feat/x",
		"git push origin main-backup",
		"git push",
		"git push origin HEAD",
	]) {
		test(command, () => assertAllowed(command));
	}

	test("an empty payload", () => {
		const result = spawnSync("bash", [HOOK], {
			cwd: onFeature,
			input: "{}",
			encoding: "utf8",
		});
		assert.equal(result.status, 0);
	});
});

test("warns but allows a non-conventional commit message", () => {
	const result = runHook('git commit -m "update stuff"');
	assert.equal(result.status, 0);
	assert.match(result.stderr, /not conventional-commit style/);
});

test("still parses the payload when jq is not installed", () => {
	// A PATH with only the tools the hook needs, minus jq, exercises the node
	// fallback. Without it the hook used to fail open.
	const bin = join(scratch, "bin-without-jq");
	mkdirSync(bin);
	for (const tool of ["bash", "cat", "git", "grep", "head", "node", "sed"]) {
		const path = execFileSync("bash", ["-c", `command -v ${tool}`], {
			encoding: "utf8",
		}).trim();
		symlinkSync(path, join(bin, tool));
	}
	assertBlocked("git push --force", {
		env: { ...process.env, PATH: bin },
	});
});
