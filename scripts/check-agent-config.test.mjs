import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

// `.agents/` is the canonical home for agent rules, subagents, and skills, but
// Claude Code only discovers them under `.claude/`. These symlinks are the
// adapter; replacing them with real directories (or deleting them) silently
// drops that config for Claude. See "Agent configuration" in AGENTS.md.
const LINKED_DIRS = ["rules", "agents", "skills"];

for (const dir of LINKED_DIRS) {
	test(`.claude/${dir} is a symlink to .agents/${dir}`, () => {
		const link = resolve(".claude", dir);
		assert.ok(
			lstatSync(link).isSymbolicLink(),
			`.claude/${dir} must be a symlink — add files to .agents/${dir} instead`,
		);
		assert.equal(realpathSync(link), realpathSync(resolve(".agents", dir)));
	});
}

// Claude Code reads AGENTS.md natively, but only when no CLAUDE.md exists in
// the working directory or above it. A committed CLAUDE.md would silently
// shadow every AGENTS.md for Claude.
test("no CLAUDE.md is committed alongside AGENTS.md", () => {
	const claudeFiles = execFileSync(
		"git",
		["ls-files", "CLAUDE.md", "**/CLAUDE.md"],
		{ encoding: "utf8" },
	)
		.split("\n")
		.filter(Boolean);
	assert.deepEqual(
		claudeFiles,
		[],
		"put instructions in AGENTS.md; Claude Code loads it directly",
	);
});
