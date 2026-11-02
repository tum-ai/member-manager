import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { TUMAI_SLACK_TEAM_ID } from "../../src/lib/slackWorkspace.js";
import "../setup.js";
import { asRequest, runInRollback } from "./localDatabase.js";

const migration = readFileSync(
	new URL(
		"../../../supabase/migrations/20261102180000_nomcp_access_approval.sql",
		import.meta.url,
	),
	"utf8",
);
const RUN_LOCAL_RLS_TESTS = process.env.RUN_LOCAL_SUPABASE_RLS_TESTS === "true";

const ADMIN_SEED_STATEMENT =
	migration.match(
		/insert into "public"\."mcp_access" \("user_id", "status", "role"[\s\S]*?on conflict \("user_id"\) do nothing;/,
	)?.[0] ?? "";

test("the table keeps a role only while approved", () => {
	assert.match(
		migration,
		/"status" text not null default 'pending'\s+check \("status" in \('pending', 'approved', 'denied'\)\)/,
	);
	assert.match(
		migration,
		/"role" text check \("role" in \('reader', 'editor'\)\)/,
	);
	assert.match(
		migration,
		/check \(\("status" = 'approved'\) = \("role" is not null\)\)/,
	);
});

test("members can read their own status, but not who decided or the note", () => {
	const grant = migration.match(
		/grant select \(([\s\S]*?)\) on table "public"\."mcp_access" to authenticated;/,
	);
	assert.ok(grant);
	assert.doesNotMatch(grant[1], /decided_by|decision_note/);
	assert.match(
		migration,
		/revoke all on table "public"\."mcp_access" from public, anon, authenticated;/,
	);
	assert.match(
		migration,
		/create policy "Members can view own nomcp access" on "public"\."mcp_access"\s+for select to authenticated\s+using \(\(select auth\.uid\(\)\) = "user_id"\);/,
	);
});

test("the admins of the day are approved as editors", () => {
	assert.ok(ADMIN_SEED_STATEMENT);
	assert.match(ADMIN_SEED_STATEMENT, /'approved', 'editor'/);
	assert.match(ADMIN_SEED_STATEMENT, /where r\."role" = 'admin'/);
});

test("mcp_principal v2 writes, so it is volatile, and stays locked down", () => {
	assert.match(
		migration,
		/create or replace function "public"\."mcp_principal"\(\) returns jsonb\s+language plpgsql\s+volatile\s+security definer\s+set search_path = ''/,
	);
	assert.match(
		migration,
		/v_eligible := v_principal ->> 'member_status' = 'active'\s+and \(v_principal ->> 'slack_team_ok'\)::boolean;/,
	);
	assert.match(
		migration,
		/v_access\.last_seen_at < now\(\) - interval '1 minute'/,
	);
	assert.match(
		migration,
		/revoke all on function "public"\."mcp_principal"\(\) from public, anon;\s+grant execute on function "public"\."mcp_principal"\(\) to authenticated;/,
	);
});

// Seeded accounts (supabase/seed.sql).
const ADMIN_ID = "00000000-0000-0000-0000-000000000001";
const MEMBER_ID = "00000000-0000-0000-0000-000000000006"; // active, user role
const ALUMNI_ID = "00000000-0000-0000-0000-000000000018";
const CLIENT_ID = "00000000-0000-4000-8000-0000000c11e2";

const appClaims = (sub: string) => ({
	sub,
	role: "authenticated",
	client_id: CLIENT_ID,
});

/** Gives the member a Slack identity (seeded users only have email ones). */
const slackIdentity = (userId: string, teamId = TUMAI_SLACK_TEAM_ID) =>
	`insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
	values ('U-${userId}', '${userId}',
		'{"sub": "U-${userId}", "custom_claims": {"https://slack.com/team_id": "${teamId}"}}'::jsonb,
		'slack_oidc', now(), now())`;

/** The app the claims name, as GoTrue stores it. */
const OAUTH_CLIENT = `insert into auth.oauth_clients
	(id, client_name, registration_type, redirect_uris, grant_types, client_type,
	 token_endpoint_auth_method, created_at, updated_at)
	values ('${CLIENT_ID}', 'Claude Code', 'dynamic', 'http://localhost:33418/callback',
		'authorization_code,refresh_token', 'public', 'none', now(), now())`;

const clearAccess = (userId: string) =>
	`delete from public.mcp_access where user_id = '${userId}'`;

const PRINCIPAL_ACCESS =
	"select p ->> 'access_status', coalesce(p ->> 'access_role', '-') from public.mcp_principal() p";

const accessRow = (userId: string) => `select status, coalesce(role, '-'),
	requested_at = now(), last_seen_at = now(), coalesce(last_client_id, '-'), coalesce(last_client_name, '-')
	from public.mcp_access where user_id = '${userId}'`;

describe("nomcp access approval against the local database", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, () => {
	test("an active TUM.ai Slack member's first sign-in files a pending request", () => {
		const output = runInRollback([
			clearAccess(MEMBER_ID),
			slackIdentity(MEMBER_ID),
			OAUTH_CLIENT,
			...asRequest(appClaims(MEMBER_ID)),
			PRINCIPAL_ACCESS,
			"reset role",
			accessRow(MEMBER_ID),
		]);
		assert.deepStrictEqual(output, [
			"pending|-",
			`pending|-|t|t|${CLIENT_ID}|Claude Code`,
		]);
	});

	test("members who can't use nomcp read pending but file no request", () => {
		for (const [userId, identity] of [
			[ALUMNI_ID, slackIdentity(ALUMNI_ID)],
			[MEMBER_ID, slackIdentity(MEMBER_ID, "T999FOREIGN")],
			[MEMBER_ID, "select 1"],
		]) {
			const output = runInRollback([
				clearAccess(userId),
				identity,
				...asRequest(appClaims(userId)),
				PRINCIPAL_ACCESS,
				"reset role",
				`select count(*) from public.mcp_access where user_id = '${userId}'`,
			]);
			assert.deepStrictEqual(output.slice(-2), ["pending|-", "0"], userId);
		}
	});

	test("an approved member gets their role; a denied one none", () => {
		const withAccess = (status: string, role: string | null) =>
			runInRollback([
				clearAccess(MEMBER_ID),
				`insert into public.mcp_access (user_id, status, role, decided_at)
				values ('${MEMBER_ID}', '${status}', ${role ? `'${role}'` : "null"}, now())`,
				...asRequest(appClaims(MEMBER_ID)),
				PRINCIPAL_ACCESS,
			]);
		assert.deepStrictEqual(withAccess("approved", "reader"), [
			"approved|reader",
		]);
		assert.deepStrictEqual(withAccess("approved", "editor"), [
			"approved|editor",
		]);
		assert.deepStrictEqual(withAccess("denied", null), ["denied|-"]);
		assert.deepStrictEqual(withAccess("pending", null), ["pending|-"]);
	});

	test("last seen and the client are refreshed at most once a minute", () => {
		const seenAgo = (interval: string) =>
			runInRollback([
				clearAccess(MEMBER_ID),
				OAUTH_CLIENT,
				`insert into public.mcp_access (user_id, status, role, last_seen_at, last_client_id, last_client_name)
				values ('${MEMBER_ID}', 'approved', 'editor', now() - interval '${interval}', 'old-client', 'Old app')`,
				...asRequest(appClaims(MEMBER_ID)),
				PRINCIPAL_ACCESS,
				"reset role",
				`select last_seen_at = now(), last_client_id, last_client_name
				from public.mcp_access where user_id = '${MEMBER_ID}'`,
			]);
		assert.deepStrictEqual(seenAgo("2 minutes"), [
			"approved|editor",
			`t|${CLIENT_ID}|Claude Code`,
		]);
		assert.deepStrictEqual(seenAgo("30 seconds"), [
			"approved|editor",
			"f|old-client|Old app",
		]);
	});

	test("an unknown client still counts as seen, without a name", () => {
		const output = runInRollback([
			clearAccess(MEMBER_ID),
			`insert into public.mcp_access (user_id, status, role) values ('${MEMBER_ID}', 'approved', 'reader')`,
			...asRequest({ ...appClaims(MEMBER_ID), client_id: "not-a-uuid" }),
			PRINCIPAL_ACCESS,
			"reset role",
			`select last_seen_at = now(), last_client_id, coalesce(last_client_name, '-')
			from public.mcp_access where user_id = '${MEMBER_ID}'`,
		]);
		assert.deepStrictEqual(output, ["approved|reader", "t|not-a-uuid|-"]);
	});

	test("every admin is approved as an editor", () => {
		// The seed (local) and the migration's own statement (production).
		const check = `select count(*) filter (where a.status = 'approved' and a.role = 'editor'), count(*)
			from public.user_roles r join public.members m on m.user_id = r.user_id
			left join public.mcp_access a on a.user_id = r.user_id
			where r.role = 'admin'`;
		const [seeded] = runInRollback([check]);
		const [fromMigration] = runInRollback([
			"delete from public.mcp_access",
			`update public.user_roles set role = 'admin' where user_id = '${MEMBER_ID}'`,
			ADMIN_SEED_STATEMENT,
			check,
		]);
		const [approved, admins] = seeded.split("|");
		assert.ok(Number(admins) > 0, "the seed has no admins");
		assert.strictEqual(approved, admins);
		const [approvedAfter, adminsAfter] = fromMigration.split("|");
		assert.strictEqual(adminsAfter, String(Number(admins) + 1));
		assert.strictEqual(approvedAfter, adminsAfter);
	});

	test("the table blocks OAuth app tokens and shows members only their own row", () => {
		const [policy] = runInRollback([
			`select permissive || ' ' || cmd || ' ' || array_to_string(roles, ',')
			from pg_catalog.pg_policies
			where schemaname = 'public' and tablename = 'mcp_access' and policyname = 'oauth_clients_blocked'`,
		]);
		assert.strictEqual(policy, "RESTRICTIVE ALL authenticated");

		const visible = (claims: Record<string, unknown>) =>
			runInRollback([
				`insert into public.mcp_access (user_id) values ('${MEMBER_ID}') on conflict do nothing`,
				...asRequest(claims),
				"select count(*) from public.mcp_access",
			]);
		assert.deepStrictEqual(visible({ sub: MEMBER_ID, role: "authenticated" }), [
			"1",
		]);
		assert.deepStrictEqual(visible(appClaims(MEMBER_ID)), ["0"]);
		assert.throws(
			() =>
				runInRollback([
					...asRequest({ sub: ADMIN_ID, role: "authenticated" }),
					"select decision_note from public.mcp_access",
				]),
			/permission denied for table mcp_access/,
		);
		assert.throws(
			() =>
				runInRollback([
					...asRequest({ sub: MEMBER_ID, role: "authenticated" }),
					`update public.mcp_access set status = 'approved', role = 'editor' where user_id = '${MEMBER_ID}'`,
				]),
			/permission denied for table mcp_access/,
		);
	});

	test("an approved row needs a role and nothing else has one", () => {
		for (const values of [
			`'${MEMBER_ID}', 'approved', null`,
			`'${MEMBER_ID}', 'pending', 'reader'`,
			`'${MEMBER_ID}', 'denied', 'editor'`,
		]) {
			assert.throws(
				() =>
					runInRollback([
						clearAccess(MEMBER_ID),
						`insert into public.mcp_access (user_id, status, role) values (${values})`,
					]),
				/mcp_access_role_only_when_approved/,
				values,
			);
		}
	});
});
