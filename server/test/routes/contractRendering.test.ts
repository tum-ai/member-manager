import "../setup.js";
import assert from "node:assert";
import { test } from "node:test";
import { renderContractText } from "../../src/routes/contracts.js";

test("renders the THEN branch of an inline conditional when it matches", () => {
	const out = renderContractText(
		'[IF {{role}} = "admin" THEN {You are an admin.} ELSE {Regular user.}]',
		{ role: "admin" },
		[],
	);
	assert.strictEqual(out, "You are an admin.");
});

test("renders the ELSE branch when the condition does not match", () => {
	const out = renderContractText(
		'[WENN {{role}} = "admin" DANN {Admin.} SONST {Regular user.}]',
		{ role: "member" },
		[],
	);
	assert.strictEqual(out, "Regular user.");
});

test("substitutes variables inside a rendered conditional branch", () => {
	const out = renderContractText(
		'[IF {{active}} = "yes" THEN {Hello {{name}}.}]',
		{ active: "yes", name: "Ada" },
		[],
	);
	assert.strictEqual(out, "Hello Ada.");
});

test("renders conditionals in large (>100k) contract text without skipping", () => {
	// Regression: an earlier ReDoS guard capped input at 100k and silently
	// returned raw [IF ...] syntax for legitimate large contracts. The linear
	// regex needs no cap, so the branch must still render at schema-max sizes.
	const filler = "x".repeat(150_000);
	const out = renderContractText(
		`${filler}[IF {{role}} = "admin" THEN {ADMIN_BRANCH}]`,
		{ role: "admin" },
		[],
	);
	assert.ok(out.endsWith("ADMIN_BRANCH"), "conditional rendered");
	assert.ok(!out.includes("[IF"), "no raw conditional syntax left");
});

test("conditional regex stays linear on hostile input (no ReDoS hang)", () => {
	// A pathological near-match that would blow up an ambiguous regex. With the
	// disjoint, bounded alternation this completes effectively instantly.
	const hostile = `[IF {{x}} = "${" ".repeat(50_000)}`;
	const start = process.hrtime.bigint();
	const out = renderContractText(hostile, { x: "a" }, []);
	const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
	// Incomplete conditional: no branch is rendered (the [IF stays), the {{x}}
	// variable is still substituted, and crucially it must not hang.
	assert.ok(
		out.startsWith('[IF a = "'),
		"incomplete conditional left unrendered",
	);
	assert.ok(elapsedMs < 1000, `rendering took ${elapsedMs}ms`);
});
