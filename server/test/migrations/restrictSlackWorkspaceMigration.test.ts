import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { TUMAI_SLACK_TEAM_ID } from "../../src/lib/slackWorkspace.js";
import "../setup.js";

const MIGRATION_PATH = new URL(
	"../../../supabase/migrations/20261101120000_restrict_slack_workspace.sql",
	import.meta.url,
);
const migration = readFileSync(MIGRATION_PATH, "utf8");
const RUN_LOCAL_RLS_TESTS = process.env.RUN_LOCAL_SUPABASE_RLS_TESTS === "true";
const REPO_ROOT =
	process.env.SUPABASE_TEST_PROJECT_DIR ??
	fileURLToPath(new URL("../../..", import.meta.url));

test("the sign-up trigger allows the same workspace as the server", () => {
	assert.match(
		migration,
		new RegExp(
			`allowed_slack_team_ids constant text\\[\\] := array\\['${TUMAI_SLACK_TEAM_ID}'\\]`,
		),
	);
});

test("the sign-up trigger rejects Slack users from other workspaces", () => {
	assert.match(migration, /new\.raw_app_meta_data->>'provider' = 'slack_oidc'/);
	assert.match(
		migration,
		/new\.raw_user_meta_data->'custom_claims'->>'https:\/\/slack\.com\/team_id'/,
	);
	assert.match(
		migration,
		/slack_team_id is null or not \(slack_team_id = any \(allowed_slack_team_ids\)\)[\s\S]*?raise exception/,
	);
});

test("the trigger still creates the member row and default role", () => {
	assert.match(migration, /insert into public\.members \(/);
	assert.match(
		migration,
		/insert into public\.user_roles \(user_id, role\)\s+values \(new\.id, 'user'\)/,
	);
});

function localDbUrl(): string {
	const output = execFileSync("supabase", ["status", "-o", "env"], {
		cwd: REPO_ROOT,
		encoding: "utf8",
	});
	const match = output.match(/^DB_URL=['"]?([^'"\n]+)['"]?$/m);
	assert.ok(match, "supabase status did not report DB_URL");
	return match[1];
}

describe("Slack workspace sign-up guard against the local database", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, () => {
	// Each insert runs in a transaction that is rolled back, so the local
	// database keeps no test users.
	function insertAuthUser(provider: string, userMetadata: object): string {
		const id = randomUUID();
		const insert = `insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
			values ('${id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
				'${id}@example.com',
				'${JSON.stringify({ provider, providers: [provider] })}'::jsonb,
				'${JSON.stringify(userMetadata)}'::jsonb, now(), now())`;
		return execFileSync(
			"psql",
			[
				localDbUrl(),
				"-qAt",
				"-v",
				"ON_ERROR_STOP=1",
				"-c",
				"begin",
				"-c",
				insert,
				"-c",
				`select count(*) from public.members where user_id = '${id}'`,
				"-c",
				"rollback",
			],
			{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
		);
	}

	const slackClaims = (teamId: string) => ({
		iss: "https://slack.com",
		custom_claims: { "https://slack.com/team_id": teamId },
	});

	test("a TUM.ai Slack sign-up creates a member", () => {
		assert.match(
			insertAuthUser("slack_oidc", slackClaims(TUMAI_SLACK_TEAM_ID)),
			/^1$/m,
		);
	});

	test("a Slack sign-up from another workspace is rejected", () => {
		assert.throws(
			() => insertAuthUser("slack_oidc", slackClaims("T999FOREIGN")),
			/Slack workspace T999FOREIGN is not allowed/,
		);
	});

	test("a Slack sign-up without a team claim is rejected", () => {
		assert.throws(
			() => insertAuthUser("slack_oidc", { iss: "https://slack.com" }),
			/Slack workspace <none> is not allowed/,
		);
	});

	test("an email sign-up is unaffected", () => {
		assert.match(insertAuthUser("email", {}), /^1$/m);
	});
});
