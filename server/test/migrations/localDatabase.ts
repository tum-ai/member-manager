import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * psql helpers for the migration tests that run against the local Supabase
 * stack (`RUN_LOCAL_SUPABASE_RLS_TESTS=true`). `SUPABASE_TEST_PROJECT_DIR`
 * points them at another project directory, e.g. a stack on other ports.
 */
const PROJECT_DIR =
	process.env.SUPABASE_TEST_PROJECT_DIR ??
	fileURLToPath(new URL("../../..", import.meta.url));

let dbUrl: string | undefined;

export function localDbUrl(): string {
	if (dbUrl) return dbUrl;
	const output = execFileSync("supabase", ["status", "-o", "env"], {
		cwd: PROJECT_DIR,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	const match = output.match(/^DB_URL=['"]?([^'"\n]+)['"]?$/m);
	assert.ok(match, "supabase status did not report DB_URL");
	dbUrl = match[1];
	return dbUrl;
}

/** Runs the statements in one rolled-back transaction; returns stdout lines. */
export function runInRollback(statements: string[]): string[] {
	const args = [localDbUrl(), "-qAt", "-v", "ON_ERROR_STOP=1", "-c", "begin"];
	for (const statement of statements) args.push("-c", statement);
	args.push("-c", "rollback");
	return execFileSync("psql", args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	})
		.split("\n")
		.filter((line) => line !== "");
}

/**
 * Statements that make the rest of the transaction run like a PostgREST
 * request with these JWT claims. `reset role` returns to the owner.
 */
export function asRequest(
	claims: Record<string, unknown>,
	role = "authenticated",
): string[] {
	return [
		`set local role ${role}`,
		`do $$ begin perform set_config('request.jwt.claims', '${JSON.stringify(claims)}', true); end $$`,
	];
}
