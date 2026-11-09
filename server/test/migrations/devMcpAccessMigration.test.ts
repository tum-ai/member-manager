import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { TUMAI_SLACK_TEAM_ID } from "../../src/lib/slackWorkspace.js";
import "../setup.js";
import { asRequest, runInRollback } from "./localDatabase.js";

const migration = readFileSync(
	new URL(
		"../../../supabase/migrations/20261109120000_dev_mcp_access.sql",
		import.meta.url,
	),
	"utf8",
);
const RUN_LOCAL_RLS_TESTS = process.env.RUN_LOCAL_SUPABASE_RLS_TESTS === "true";

const NEW_TABLES = [
	"dev_mcp_access",
	"dev_mcp_tool_grants",
	"dev_mcp_access_events",
	"mcp_client_resources",
	"mcp_resource_settings",
];

/** `create or replace function "public"."<name>"(…) returns …` plus its header. */
function functionHeader(name: string): string {
	const match = migration.match(
		new RegExp(
			`create or replace function "public"\\."${name}"\\([\\s\\S]*?\\) returns [\\s\\S]*?as \\$\\$`,
		),
	);
	assert.ok(match, `${name} is not defined`);
	return match[0];
}

test("every new table has RLS and blocks OAuth app tokens", () => {
	for (const table of NEW_TABLES) {
		assert.match(
			migration,
			new RegExp(
				`alter table "public"\\."${table}" enable row level security;`,
			),
			table,
		);
		assert.match(
			migration,
			new RegExp(
				`create policy "oauth_clients_blocked" on "public"\\."${table}" as restrictive for all to authenticated\\s+using \\(\\(select auth\\.jwt\\(\\) ->> 'client_id'\\) is null\\)\\s+with check \\(\\(select auth\\.jwt\\(\\) ->> 'client_id'\\) is null\\);`,
			),
			table,
		);
	}
});

test("members read their own status and grants, not who decided or the note", () => {
	const access = migration.match(
		/grant select \(([\s\S]*?)\) on table "public"\."dev_mcp_access" to authenticated;/,
	);
	assert.ok(access);
	assert.doesNotMatch(access[1], /decided_by|decision_note/);
	const grants = migration.match(
		/grant select \(([\s\S]*?)\)\s+on table "public"\."dev_mcp_tool_grants" to authenticated;/,
	);
	assert.ok(grants);
	assert.doesNotMatch(grants[1], /granted_by/);
	for (const table of ["dev_mcp_access", "dev_mcp_tool_grants"]) {
		assert.match(
			migration,
			new RegExp(
				`create policy "[^"]+" on "public"\\."${table}"\\s+for select to authenticated\\s+using \\(\\(select auth\\.uid\\(\\)\\) = "user_id"\\);`,
			),
		);
	}
});

test("the event log is append-only, even for the service role", () => {
	assert.match(
		migration,
		/revoke all on table "public"\."dev_mcp_access_events" from public, anon, authenticated, service_role;\s+grant select, insert on table "public"\."dev_mcp_access_events" to service_role;/,
	);
});

test("an active member always has a role and nobody else has one", () => {
	assert.match(
		migration,
		/check \(\("status" = 'active'\) = \("role" is not null\)\)/,
	);
});

test("the production resource is dev-mcp's /mcp URL", () => {
	assert.match(
		migration,
		/values \('dev_mcp', 'https:\/\/tumai-dev-mcp\.vercel\.app\/mcp'\)\s+on conflict \("key"\) do nothing;/,
	);
});

test("every function is a locked-down security definer", () => {
	const grants: Record<string, string> = {
		member_slack_user_id: "service_role",
		dev_mcp_access_record: "service_role",
		dev_mcp_access_for: "service_role",
		dev_mcp_file_request: "service_role",
		dev_mcp_apply_change: "service_role",
		bind_oauth_authorization: "authenticated",
		dev_mcp_principal: "authenticated",
	};
	for (const [name, role] of Object.entries(grants)) {
		assert.match(
			functionHeader(name),
			/security definer\s+set search_path = ''/,
			name,
		);
		assert.match(
			migration,
			new RegExp(
				`revoke all on function "public"\\."${name}"\\([^)]*\\) from public, anon, [a-z_]+;\\s+grant execute on function "public"\\."${name}"\\([^)]*\\) to ${role};`,
			),
			name,
		);
	}
});

test("the Slack ID comes from the TUM.ai workspace identity", () => {
	assert.match(
		migration,
		/i\.identity_data -> 'custom_claims' ->> 'https:\/\/slack\.com\/user_id',\s+i\.identity_data ->> 'sub'/,
	);
	assert.match(migration, /'\^\[UW\]\[A-Z0-9\]\{2,20\}\$'/);
	assert.ok(migration.includes(`= '${TUMAI_SLACK_TEAM_ID}'`));
});

test("mcp_principal (nomcp's contract) is left alone", () => {
	assert.doesNotMatch(migration, /function "public"\."mcp_principal"/);
});

// Seeded accounts (supabase/seed.sql).
const ADMIN_ID = "00000000-0000-0000-0000-000000000001";
const VICE_ID = "00000000-0000-0000-0000-000000000002"; // second admin
const MEMBER_ID = "00000000-0000-0000-0000-000000000006"; // active, no Slack identity
const ALUMNI_ID = "00000000-0000-0000-0000-000000000018";
const SLACK_MEMBER_ID = "00000000-0000-0000-0000-000000000019";
const SLACK_MEMBER_SLACK_ID = "U0DEVSEED19";
const LOCAL_RESOURCE = "http://localhost:3000/mcp";
const CLIENT_ID = "00000000-0000-4000-8000-00000000de11";

const appClaims = (sub: string, extra: Record<string, unknown> = {}) => ({
	sub,
	role: "authenticated",
	client_id: CLIENT_ID,
	...extra,
});
const sessionClaims = (sub: string) => ({ sub, role: "authenticated" });

const slackIdentity = (
	userId: string,
	slackId: string,
	teamId = TUMAI_SLACK_TEAM_ID,
) =>
	`insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
	values ('${slackId}', '${userId}',
		'{"sub": "${slackId}", "custom_claims": {"https://slack.com/team_id": "${teamId}"}}'::jsonb,
		'slack_oidc', now(), now())`;

const OAUTH_CLIENT = `insert into auth.oauth_clients
	(id, client_name, registration_type, redirect_uris, grant_types, client_type,
	 token_endpoint_auth_method, created_at, updated_at)
	values ('${CLIENT_ID}', 'Claude Code', 'dynamic', 'http://localhost:33418/callback',
		'authorization_code,refresh_token', 'public', 'none', now(), now())`;

const bindClient = (resource = LOCAL_RESOURCE) =>
	`insert into public.mcp_client_resources (client_id, resource) values ('${CLIENT_ID}', '${resource}')`;

const clearAccess = (userId: string) =>
	`delete from public.dev_mcp_access where user_id = '${userId}'`;

const PRINCIPAL =
	// A null result is still one row in FROM; `where` turns it into no output.
	"select p ->> 'status', coalesce(p ->> 'role', '-'), p -> 'tools' from public.dev_mcp_principal() p where p is not null";

describe("dev-mcp access against the local database", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, () => {
	test("member_slack_user_id reads the TUM.ai Slack identity only", () => {
		assert.deepStrictEqual(
			runInRollback([
				`select public.member_slack_user_id('${SLACK_MEMBER_ID}')`,
			]),
			[SLACK_MEMBER_SLACK_ID],
		);
		assert.deepStrictEqual(
			runInRollback([
				`select coalesce(public.member_slack_user_id('${MEMBER_ID}'), '-')`,
			]),
			["-"],
		);
		for (const [slackId, team, expected] of [
			["U0FOREIGN1", "T999FOREIGN", "-"],
			["not-slack", TUMAI_SLACK_TEAM_ID, "-"],
			["W0WORKSPACE", TUMAI_SLACK_TEAM_ID, "W0WORKSPACE"],
		]) {
			assert.deepStrictEqual(
				runInRollback([
					slackIdentity(MEMBER_ID, slackId, team),
					`select coalesce(public.member_slack_user_id('${MEMBER_ID}'), '-')`,
				]),
				[expected],
				slackId,
			);
		}
	});

	test("dev_mcp_access_for returns the contract record, or null", () => {
		const [json] = runInRollback([
			`select public.dev_mcp_access_for('${SLACK_MEMBER_SLACK_ID}')`,
		]);
		const record = JSON.parse(json);
		assert.deepStrictEqual(Object.keys(record).sort(), [
			"display_name",
			"member_status",
			"role",
			"slack_team_ok",
			"slack_user_id",
			"status",
			"tools",
			"user_id",
		]);
		assert.deepStrictEqual(record, {
			user_id: SLACK_MEMBER_ID,
			slack_user_id: SLACK_MEMBER_SLACK_ID,
			display_name: "Sofia Software",
			member_status: "active",
			slack_team_ok: true,
			status: "requested",
			role: null,
			tools: [],
		});
		assert.deepStrictEqual(
			runInRollback([
				"select coalesce(public.dev_mcp_access_for('U0NOBODY1')::text, '-')",
			]),
			["-"],
		);
	});

	test("the seeded admins are dev-mcp admins with the admin preset", () => {
		const [line] = runInRollback([
			`select a.status, a.role, string_agg(g.tool, ',' order by g.tool)
			from public.dev_mcp_access a join public.dev_mcp_tool_grants g using (user_id)
			where a.user_id = '${ADMIN_ID}' group by a.status, a.role`,
		]);
		assert.strictEqual(
			line,
			"active|admin|add_to_github_org,create_mailbox,create_notion_page,create_shared_mailbox,whoami",
		);
	});

	test("file_request files once, and reopens only a denied request", () => {
		const output = runInRollback([
			clearAccess(SLACK_MEMBER_ID),
			`select public.dev_mcp_file_request('${SLACK_MEMBER_ID}', 'dev_mcp')`,
			`select public.dev_mcp_file_request('${SLACK_MEMBER_ID}', 'dev_mcp')`,
			`update public.dev_mcp_access set status = 'denied' where user_id = '${SLACK_MEMBER_ID}'`,
			`select public.dev_mcp_file_request('${SLACK_MEMBER_ID}', 'dev_mcp')`,
			`select status from public.dev_mcp_access where user_id = '${SLACK_MEMBER_ID}'`,
			`select count(*) from public.dev_mcp_access_events
			where user_id = '${SLACK_MEMBER_ID}' and action = 'access_requested' and source = 'dev_mcp'`,
		]);
		assert.deepStrictEqual(output, ["t", "f", "t", "requested", "2"]);
	});

	const applyChange = (args: {
		userId?: string;
		from: string;
		status: string;
		role?: string | null;
		expectedRole?: string | null;
		setTools?: string | null;
		dropTools?: string | null;
	}) =>
		`select public.dev_mcp_apply_change(
			'${args.userId ?? SLACK_MEMBER_ID}', '${ADMIN_ID}', 'admin', 'member_updated',
			array[${args.from}]::text[], ${args.expectedRole ? `'${args.expectedRole}'` : "null"},
			'${args.status}', ${args.role ? `'${args.role}'` : "null"}, null,
			${args.setTools ?? "null"}, ${args.dropTools ?? "null"})`;

	test("apply_change approves with grants and logs one event", () => {
		const output = runInRollback([
			applyChange({
				from: "'requested'",
				status: "active",
				role: "member",
				setTools: "array['whoami', 'create_notion_page']",
			}),
			`select status, role, decided_by from public.dev_mcp_access where user_id = '${SLACK_MEMBER_ID}'`,
			`select string_agg(tool, ',' order by tool) from public.dev_mcp_tool_grants where user_id = '${SLACK_MEMBER_ID}'`,
			`select action, details -> 'added' from public.dev_mcp_access_events
			where user_id = '${SLACK_MEMBER_ID}' and source = 'admin'`,
		]);
		assert.deepStrictEqual(output, [
			`active|member|${ADMIN_ID}`,
			"create_notion_page,whoami",
			'member_updated|["create_notion_page", "whoami"]',
		]);
	});

	test("apply_change refuses a stale status or role", () => {
		assert.throws(
			() =>
				runInRollback([applyChange({ from: "'active'", status: "suspended" })]),
			/Can't do that to Dev MCP access that is requested/,
		);
		assert.throws(
			() =>
				runInRollback([
					`update public.dev_mcp_access set status = 'active', role = 'lead' where user_id = '${SLACK_MEMBER_ID}'`,
					applyChange({
						from: "'active'",
						status: "active",
						role: "member",
						expectedRole: "admin",
					}),
				]),
			/role changed in the meantime/,
		);
	});

	test("nobody removes the last active admin", () => {
		const demoteBoth = [
			applyChange({ userId: VICE_ID, from: "'active'", status: "suspended" }),
			applyChange({ userId: ADMIN_ID, from: "'active'", status: "suspended" }),
		];
		assert.throws(() => runInRollback(demoteBoth), /last active Dev MCP admin/);
		assert.doesNotThrow(() => runInRollback(demoteBoth.slice(0, 1)));
	});

	test("leaving active drops every grant; a demotion only the named ones", () => {
		const output = runInRollback([
			applyChange({
				from: "'requested'",
				status: "active",
				role: "lead",
				setTools: "array['whoami', 'create_mailbox']",
			}),
			applyChange({
				from: "'active'",
				status: "active",
				role: "member",
				expectedRole: "lead",
				dropTools: "array['create_mailbox']",
			}),
			`select string_agg(tool, ',') from public.dev_mcp_tool_grants where user_id = '${SLACK_MEMBER_ID}'`,
			applyChange({ from: "'active'", status: "suspended" }),
			`select count(*) from public.dev_mcp_tool_grants where user_id = '${SLACK_MEMBER_ID}'`,
		]);
		// The void calls print nothing.
		assert.deepStrictEqual(output, ["whoami", "0"]);
	});

	test("bind_oauth_authorization binds a client to its resource once", () => {
		const authorization = (id: string, resource: string | null) =>
			`insert into auth.oauth_authorizations
				(id, authorization_id, client_id, user_id, redirect_uri, scope, state, resource,
				 code_challenge, code_challenge_method, response_type, status, created_at, expires_at)
			values ('${randomUUID()}', '${id}', '${CLIENT_ID}', '${SLACK_MEMBER_ID}',
				'http://localhost:33418/callback', 'email', 'state', ${resource ? `'${resource}'` : "null"},
				'challenge', 's256', 'code', 'pending', now(), now() + interval '10 minutes')`;
		const bind = (id: string) =>
			`select public.bind_oauth_authorization('${id}')`;
		const asMember = asRequest(sessionClaims(SLACK_MEMBER_ID));

		const bound = runInRollback([
			OAUTH_CLIENT,
			authorization("auth-dev", LOCAL_RESOURCE),
			authorization("auth-dev-2", LOCAL_RESOURCE),
			...asMember,
			bind("auth-dev"),
			bind("auth-dev-2"),
			"reset role",
			`select resource, user_id from public.mcp_client_resources where client_id = '${CLIENT_ID}'`,
		]);
		assert.deepStrictEqual(bound, [`${LOCAL_RESOURCE}|${SLACK_MEMBER_ID}`]);

		assert.throws(
			() =>
				runInRollback([
					OAUTH_CLIENT,
					bindClient("https://nomcp.example/mcp"),
					authorization("auth-dev", LOCAL_RESOURCE),
					...asMember,
					bind("auth-dev"),
				]),
			/already connected to another TUM\.ai server/,
		);
		// Without `resource` (nomcp clients that predate RFC 8707) nothing is bound and
		// nothing fails: nomcp keeps working, dev_mcp_principal() refuses the client.
		const unbound = runInRollback([
			OAUTH_CLIENT,
			authorization("auth-none", null),
			...asMember,
			bind("auth-none"),
			"reset role",
			`select count(*) from public.mcp_client_resources where client_id = '${CLIENT_ID}'`,
		]);
		assert.deepStrictEqual(unbound, ["0"]);
		// Someone else's authorization, and an app token, bind nothing.
		assert.throws(
			() =>
				runInRollback([
					OAUTH_CLIENT,
					authorization("auth-dev", LOCAL_RESOURCE),
					...asRequest(sessionClaims(MEMBER_ID)),
					bind("auth-dev"),
				]),
			/wasn't found/,
		);
		assert.throws(
			() =>
				runInRollback([
					OAUTH_CLIENT,
					authorization("auth-dev", LOCAL_RESOURCE),
					...asRequest(appClaims(SLACK_MEMBER_ID)),
					bind("auth-dev"),
				]),
			/Apps can't bind authorizations/,
		);
	});

	test("dev_mcp_principal answers only for clients bound to dev-mcp", () => {
		const asApp = asRequest(appClaims(SLACK_MEMBER_ID));
		assert.deepStrictEqual(
			runInRollback([OAUTH_CLIENT, ...asApp, PRINCIPAL]),
			[],
		);
		assert.deepStrictEqual(
			runInRollback([
				OAUTH_CLIENT,
				bindClient("https://nomcp.example/mcp"),
				...asApp,
				PRINCIPAL,
			]),
			[],
		);
		assert.deepStrictEqual(
			runInRollback([OAUTH_CLIENT, bindClient(), ...asApp, PRINCIPAL]),
			["requested|-|[]"],
		);
	});

	test("dev_mcp_principal returns null for sessions, non-members and members without Slack", () => {
		for (const claims of [
			sessionClaims(SLACK_MEMBER_ID),
			appClaims(randomUUID()),
			appClaims(MEMBER_ID),
			appClaims(SLACK_MEMBER_ID, { session_id: randomUUID() }),
		]) {
			assert.deepStrictEqual(
				runInRollback([
					OAUTH_CLIENT,
					bindClient(),
					...asRequest(claims),
					PRINCIPAL,
				]),
				[],
				JSON.stringify(claims),
			);
		}
	});

	test("first use files a request for an eligible member, with the client", () => {
		const output = runInRollback([
			clearAccess(SLACK_MEMBER_ID),
			OAUTH_CLIENT,
			bindClient(),
			...asRequest(appClaims(SLACK_MEMBER_ID)),
			PRINCIPAL,
			"reset role",
			`select status, last_seen_at = now(), last_client_id, last_client_name
			from public.dev_mcp_access where user_id = '${SLACK_MEMBER_ID}'`,
			`select source from public.dev_mcp_access_events
			where user_id = '${SLACK_MEMBER_ID}' and action = 'access_requested' order by at desc limit 1`,
		]);
		assert.deepStrictEqual(output, [
			"requested|-|[]",
			`requested|t|${CLIENT_ID}|Claude Code`,
			"oauth",
		]);
	});

	test("an alumnus reads none and files nothing", () => {
		const output = runInRollback([
			slackIdentity(ALUMNI_ID, "U0ALUMNI18"),
			OAUTH_CLIENT,
			bindClient(),
			...asRequest(appClaims(ALUMNI_ID)),
			PRINCIPAL,
			"reset role",
			`select count(*) from public.dev_mcp_access where user_id = '${ALUMNI_ID}'`,
		]);
		assert.deepStrictEqual(output, ["none|-|[]", "0"]);
	});

	test("an active member gets their role and tools", () => {
		const [line] = runInRollback([
			slackIdentity(ADMIN_ID, "U0ADMIN01"),
			OAUTH_CLIENT,
			bindClient(),
			...asRequest(appClaims(ADMIN_ID)),
			"select p ->> 'status', p ->> 'role', jsonb_array_length(p -> 'tools') from public.dev_mcp_principal() p",
		]);
		assert.strictEqual(line, "active|admin|5");
	});

	test("app tokens and other members can't read the tables", () => {
		const visible = (claims: Record<string, unknown>) =>
			runInRollback([
				...asRequest(claims),
				"select count(*) from public.dev_mcp_access",
			]);
		assert.deepStrictEqual(visible(sessionClaims(SLACK_MEMBER_ID)), ["1"]);
		assert.deepStrictEqual(visible(appClaims(SLACK_MEMBER_ID)), ["0"]);
		for (const statement of [
			"select decision_note from public.dev_mcp_access",
			"select granted_by from public.dev_mcp_tool_grants",
			"select * from public.dev_mcp_access_events",
			"select * from public.mcp_client_resources",
			"select * from public.mcp_resource_settings",
			`update public.dev_mcp_access set status = 'active', role = 'admin' where user_id = '${SLACK_MEMBER_ID}'`,
		]) {
			assert.throws(
				() => runInRollback([...asRequest(sessionClaims(ADMIN_ID)), statement]),
				/permission denied/,
				statement,
			);
		}
		for (const fn of [
			`public.dev_mcp_access_for('${SLACK_MEMBER_SLACK_ID}')`,
			`public.member_slack_user_id('${SLACK_MEMBER_ID}')`,
			`public.dev_mcp_file_request('${SLACK_MEMBER_ID}', 'admin')`,
		]) {
			assert.throws(
				() =>
					runInRollback([
						...asRequest(sessionClaims(ADMIN_ID)),
						`select ${fn}`,
					]),
				/permission denied for function/,
				fn,
			);
		}
	});

	test("anon can call neither OAuth function", () => {
		for (const fn of [
			"public.dev_mcp_principal()",
			"public.bind_oauth_authorization('x')",
		]) {
			assert.throws(
				() =>
					runInRollback([
						...asRequest({ role: "anon", client_id: CLIENT_ID }, "anon"),
						`select ${fn}`,
					]),
				/permission denied for function/,
				fn,
			);
		}
	});

	test("events can't be changed or deleted", () => {
		assert.throws(
			() =>
				runInRollback([
					"set local role service_role",
					"delete from public.dev_mcp_access_events",
				]),
			/permission denied for table dev_mcp_access_events/,
		);
	});
});
