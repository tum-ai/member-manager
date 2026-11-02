import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { TUMAI_SLACK_TEAM_ID } from "../../src/lib/slackWorkspace.js";
import "../setup.js";
import { asRequest, runInRollback } from "./localDatabase.js";

const MIGRATIONS_DIR = new URL(
	"../../../supabase/migrations/",
	import.meta.url,
);
const MIGRATION_FILE = "20261102120000_mcp_oauth.sql";
const migration = readFileSync(new URL(MIGRATION_FILE, MIGRATIONS_DIR), "utf8");
const RUN_LOCAL_RLS_TESTS = process.env.RUN_LOCAL_SUPABASE_RLS_TESTS === "true";

// The seeded local admin (supabase/seed.sql), who can read every member row.
const SEED_ADMIN_ID = "00000000-0000-0000-0000-000000000001";
const CLIENT_ID = "00000000-0000-4000-8000-00000000c11e";

/**
 * Public tables that keep RLS off. Every authenticated token reaches them,
 * OAuth app tokens included, because the restrictive policy only applies
 * where RLS is on. Keep this empty: enable RLS on new tables instead.
 */
const PUBLIC_TABLES_WITHOUT_RLS: string[] = [];

test("every RLS table in public and storage.objects gets the restrictive policy", () => {
	assert.match(
		migration,
		/where c\.relkind in \('r', 'p'\)\s+and c\.relrowsecurity\s+and \(\s+n\.nspname = 'public'\s+or \(n\.nspname = 'storage' and c\.relname = 'objects'\)\s+\)/,
	);
	assert.match(
		migration,
		/'create policy "oauth_clients_blocked" on %I\.%I as restrictive for all to authenticated '\s+'using \(\(select auth\.jwt\(\) ->> ''client_id''\) is null\) '\s+'with check \(\(select auth\.jwt\(\) ->> ''client_id''\) is null\)'/,
	);
});

test("mcp_principal is a locked-down security definer function", () => {
	assert.match(
		migration,
		/create or replace function "public"\."mcp_principal"\(\) returns jsonb\s+language sql\s+stable\s+security definer\s+set search_path = ''/,
	);
	assert.match(
		migration,
		/where \(select auth\.jwt\(\) ->> 'client_id'\) is not null\s+and m\.user_id = \(select auth\.uid\(\)\)/,
	);
	assert.match(
		migration,
		/revoke all on function "public"\."mcp_principal"\(\) from public, anon;/,
	);
	assert.match(
		migration,
		/grant execute on function "public"\."mcp_principal"\(\) to authenticated;/,
	);
});

test("mcp_principal checks the same Slack workspace as the server", () => {
	assert.match(
		migration,
		new RegExp(
			`i\\.provider = 'slack_oidc'\\s+and btrim\\(i\\.identity_data -> 'custom_claims' ->> 'https://slack\\.com/team_id'\\) = '${TUMAI_SLACK_TEAM_ID}'`,
		),
	);
});

// The migration only covers the tables that existed when it ran. A table
// created later is open to OAuth app tokens unless its migration adds the
// policy too, so check every later migration offline here; the catalog test
// below checks the database itself.
test("later migrations add the restrictive policy to each public table they create", () => {
	const later = readdirSync(MIGRATIONS_DIR)
		.filter((file) => file.endsWith(".sql") && file > MIGRATION_FILE)
		.sort();
	const missing: string[] = [];
	for (const file of later) {
		const sql = readFileSync(new URL(file, MIGRATIONS_DIR), "utf8");
		const created = sql.matchAll(
			/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi,
		);
		for (const [, table] of created) {
			const policy = new RegExp(
				`create\\s+policy\\s+"oauth_clients_blocked"\\s+on\\s+(?:"?public"?\\.)?"?${table}"?\\s+as\\s+restrictive`,
				"i",
			);
			if (!policy.test(sql)) missing.push(`${file}: ${table}`);
		}
	}
	assert.deepStrictEqual(missing, []);
});

const sessionClaims = (sub: string) => ({ sub, role: "authenticated" });
const appClaims = (sub: string, extra: Record<string, unknown> = {}) => ({
	sub,
	role: "authenticated",
	client_id: CLIENT_ID,
	...extra,
});

// Counts the rows of every RLS table the role may select from (some, like
// `members`, only grant columns), as that role.
const COUNT_RLS_TABLE_ROWS = `
	select format('%s.%s=%s', n.nspname, c.relname,
		(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text)
	from pg_catalog.pg_class c
	join pg_catalog.pg_namespace n on n.oid = c.relnamespace
	where c.relkind in ('r', 'p') and c.relrowsecurity
	  and (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects'))
	  and has_any_column_privilege(c.oid, 'select')
	order by 1`;

describe("OAuth app tokens against the local database", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, () => {
	test("every RLS table in public and storage.objects carries the restrictive policy", () => {
		const missing = runInRollback([
			`select n.nspname || '.' || c.relname
			from pg_catalog.pg_class c
			join pg_catalog.pg_namespace n on n.oid = c.relnamespace
			where c.relkind in ('r', 'p') and c.relrowsecurity
			  and (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects'))
			  and not exists (
			    select 1 from pg_catalog.pg_policies p
			    where p.schemaname = n.nspname and p.tablename = c.relname
			      and p.policyname = 'oauth_clients_blocked'
			      and p.permissive = 'RESTRICTIVE' and p.cmd = 'ALL'
			      and p.roles = array['authenticated']::name[]
			      and p.qual like '%client_id%IS NULL%'
			      and p.with_check like '%client_id%IS NULL%'
			  )
			order by 1`,
		]);
		assert.deepStrictEqual(missing, []);
	});

	test("public tables without RLS are the known exceptions", () => {
		const withoutRls = runInRollback([
			`select c.relname from pg_catalog.pg_class c
			join pg_catalog.pg_namespace n on n.oid = c.relnamespace
			where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
			order by 1`,
		]);
		assert.deepStrictEqual(withoutRls, PUBLIC_TABLES_WITHOUT_RLS);
	});

	test("an OAuth app token reads no rows from any RLS table, even as an admin", () => {
		const asSession = runInRollback([
			...asRequest(sessionClaims(SEED_ADMIN_ID)),
			COUNT_RLS_TABLE_ROWS,
		]);
		assert.ok(
			asSession.some((line) => /^public\.members=[1-9]\d*$/.test(line)),
			`the admin session should see member rows: ${asSession.join(", ")}`,
		);

		const asApp = runInRollback([
			...asRequest(appClaims(SEED_ADMIN_ID)),
			COUNT_RLS_TABLE_ROWS,
		]);
		assert.ok(asApp.length > 0);
		assert.deepStrictEqual(
			asApp.filter((line) => !line.endsWith("=0")),
			[],
		);
	});

	// `department_permissions` is one of the tables an admin session may write
	// to directly.
	test("an OAuth app token can't write where the admin's session can", () => {
		const update = `with updated as (
			update public.department_permissions set permissions = permissions returning 1
		) select count(*) > 0 from updated`;
		const insert = `insert into public.department_permissions (department, permissions)
			values ('MCP OAuth test', '[]'::jsonb)`;
		const asSession = asRequest(sessionClaims(SEED_ADMIN_ID));
		const asApp = asRequest(appClaims(SEED_ADMIN_ID));

		assert.deepStrictEqual(runInRollback([...asSession, update]), ["t"]);
		assert.deepStrictEqual(runInRollback([...asApp, update]), ["f"]);
		assert.doesNotThrow(() => runInRollback([...asSession, insert]));
		assert.throws(
			() => runInRollback([...asApp, insert]),
			/new row violates row-level security policy/,
		);
	});

	const principal = "select public.mcp_principal()";

	// Contract v2 (20261102180000_nomcp_access_approval.sql) adds the access
	// fields; the seeded admin is approved as an editor.
	test("mcp_principal returns the member an OAuth app token belongs to", () => {
		const [expected] = runInRollback([
			`select jsonb_build_object(
				'user_id', m.user_id,
				'display_name', btrim(m.given_name || ' ' || m.surname),
				'email', u.email,
				'member_status', m.member_status,
				'slack_team_ok', false,
				'access_status', 'approved',
				'access_role', 'editor'
			) from public.members m join auth.users u on u.id = m.user_id
			where m.user_id = '${SEED_ADMIN_ID}'`,
		]);
		const [actual] = runInRollback([
			...asRequest(appClaims(SEED_ADMIN_ID)),
			principal,
		]);
		assert.deepStrictEqual(JSON.parse(actual), JSON.parse(expected));
		assert.deepStrictEqual(Object.keys(JSON.parse(actual)).sort(), [
			"access_role",
			"access_status",
			"display_name",
			"email",
			"member_status",
			"slack_team_ok",
			"user_id",
		]);
	});

	test("mcp_principal returns null for a browser session and for non-members", () => {
		assert.deepStrictEqual(
			runInRollback([...asRequest(sessionClaims(SEED_ADMIN_ID)), principal]),
			[],
		);
		assert.deepStrictEqual(
			runInRollback([...asRequest(appClaims(randomUUID())), principal]),
			[],
		);
	});

	test("slack_team_ok is true only for a TUM.ai Slack identity", () => {
		const withSlackIdentity = (teamId: string) =>
			runInRollback([
				`insert into auth.identities (provider_id, user_id, identity_data, provider)
				values ('U-mcp-test', '${SEED_ADMIN_ID}',
					'{"sub": "U-mcp-test", "custom_claims": {"https://slack.com/team_id": "${teamId}"}}'::jsonb,
					'slack_oidc')`,
				...asRequest(appClaims(SEED_ADMIN_ID)),
				"select public.mcp_principal() ->> 'slack_team_ok'",
			]);
		assert.deepStrictEqual(withSlackIdentity(TUMAI_SLACK_TEAM_ID), ["true"]);
		assert.deepStrictEqual(withSlackIdentity("T999FOREIGN"), ["false"]);
	});

	test("mcp_principal returns null once the token's session is gone", () => {
		const sessionId = randomUUID();
		const claims = appClaims(SEED_ADMIN_ID, { session_id: sessionId });
		assert.deepStrictEqual(
			runInRollback([...asRequest(claims), principal]),
			[],
		);
		assert.deepStrictEqual(
			runInRollback([
				`insert into auth.sessions (id, user_id, created_at, updated_at)
				values ('${sessionId}', '${SEED_ADMIN_ID}', now(), now())`,
				...asRequest(claims),
				"select public.mcp_principal() ->> 'user_id'",
			]),
			[SEED_ADMIN_ID],
		);
	});

	test("anon can't call mcp_principal", () => {
		assert.throws(
			() =>
				runInRollback([
					...asRequest({ role: "anon", client_id: CLIENT_ID }, "anon"),
					principal,
				]),
			/permission denied for function mcp_principal/,
		);
	});
});
