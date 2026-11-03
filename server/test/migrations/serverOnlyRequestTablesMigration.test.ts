import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import "../setup.js";
import { asRequest, runInRollback } from "./localDatabase.js";

const migration = readFileSync(
	new URL(
		"../../../supabase/migrations/20261103120000_server_only_request_and_contract_tables.sql",
		import.meta.url,
	),
	"utf8",
);
const RUN_LOCAL_RLS_TESTS = process.env.RUN_LOCAL_SUPABASE_RLS_TESTS === "true";

const MEMBER_ID = "00000000-0000-0000-0000-000000000006"; // active, user role
const ADMIN_ID = "00000000-0000-0000-0000-000000000001";

const SERVER_ONLY_TABLES = [
	"contract_submissions",
	"contract_document_versions",
	"contract_status_events",
	"member_change_requests",
	"engagement_certificate_requests",
] as const;

const BROWSER_POLICIES: Record<(typeof SERVER_ONLY_TABLES)[number], string[]> =
	{
		contract_submissions: [
			"Submitters insert own submissions",
			"Submitters read own submissions",
			"L&F manage submissions",
		],
		contract_document_versions: [
			"L&F manage contract document versions",
			"Submitters read own contract document versions",
		],
		contract_status_events: ["Contracts admins read status events"],
		member_change_requests: [
			"Admins manage member change requests",
			"Members insert own change requests",
			"Members read own change requests",
		],
		engagement_certificate_requests: [
			"Admins manage engagement certificate requests",
			"Members insert own engagement certificate requests",
			"Members read own engagement certificate requests",
		],
	};

const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const table of SERVER_ONLY_TABLES) {
	test(`${table}: browser roles lose every grant and policy`, () => {
		assert.match(
			migration,
			new RegExp(
				`revoke all on table "public"\\."${table}" from "public", "anon", "authenticated";`,
			),
		);
		for (const policy of BROWSER_POLICIES[table]) {
			assert.match(
				migration,
				new RegExp(
					`drop policy if exists "${escapeRegExp(policy)}" on "public"\\."${table}";`,
				),
			);
		}
	});
}

test("the migration re-grants nothing to browser roles", () => {
	assert.doesNotMatch(
		migration,
		/\bgrant\b[^;]*\bto\b[^;]*(anon|authenticated)/i,
	);
	assert.doesNotMatch(migration, /\bcreate policy\b/i);
});

describe("server-only request and contract tables against the local database", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, () => {
	const member = { sub: MEMBER_ID, role: "authenticated" };
	const admin = { sub: ADMIN_ID, role: "authenticated" };

	test("a member can't file a change request with hidden member columns", () => {
		assert.throws(
			() =>
				runInRollback([
					...asRequest(member),
					`insert into public.member_change_requests (user_id, status, changes)
						values ('${MEMBER_ID}', 'pending',
							'{"degree":"M.Sc.","educational_course_role":"administrator","active":true}'::jsonb)`,
				]),
			/permission denied for table member_change_requests/,
		);
	});

	test("a member can't file an engagement certificate request", () => {
		assert.throws(
			() =>
				runInRollback([
					...asRequest(member),
					`insert into public.engagement_certificate_requests (user_id, status, engagements, reviewed_by, reviewed_at)
						values ('${MEMBER_ID}', 'approved', '[]'::jsonb, '${MEMBER_ID}', now())`,
				]),
			/permission denied for table engagement_certificate_requests/,
		);
	});

	test("a member can't read signing tokens or insert a contract submission", () => {
		assert.throws(
			() =>
				runInRollback([
					...asRequest(member),
					"select board_signature_token from public.contract_submissions",
				]),
			/permission denied for table contract_submissions/,
		);
		assert.throws(
			() =>
				runInRollback([
					...asRequest(member),
					`insert into public.contract_submissions (template_id, submitter_user_id, status)
						select id, '${MEMBER_ID}', 'partner_signed' from public.contract_templates limit 1`,
				]),
			/permission denied for table contract_submissions/,
		);
	});

	test("admin sessions go through the API too", () => {
		for (const table of SERVER_ONLY_TABLES) {
			assert.throws(
				() =>
					runInRollback([...asRequest(admin), `select 1 from public.${table}`]),
				new RegExp(`permission denied for table ${table}`),
			);
		}
	});

	test("the service role keeps full access", () => {
		const output = runInRollback(
			SERVER_ONLY_TABLES.map(
				(table) =>
					`select has_table_privilege('service_role', 'public.${table}', 'SELECT, INSERT, UPDATE, DELETE')`,
			),
		);
		assert.deepStrictEqual(
			output,
			SERVER_ONLY_TABLES.map(() => "t"),
		);
	});
});
