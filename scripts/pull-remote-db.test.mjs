import assert from "node:assert/strict";
import { test } from "node:test";
import {
	assertLocalUrlSafe,
	assertRemoteApiUrlSafe,
	buildAddColumnsSql,
	buildIdentityInsert,
	buildLoadSql,
	buildMemberInsert,
	buildUserInsert,
	inferPgType,
	sqlLiteral,
} from "./pull-remote-db.mjs";

const LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

test("assertRemoteApiUrlSafe rejects missing / local / non-https URLs", () => {
	assert.throws(() => assertRemoteApiUrlSafe(undefined), /not set/);
	assert.throws(
		() => assertRemoteApiUrlSafe("http://localhost:54321"),
		/local host/,
	);
	assert.throws(
		() => assertRemoteApiUrlSafe("http://abc.supabase.co"),
		/https/,
	);
	assert.equal(
		assertRemoteApiUrlSafe("https://abcd.supabase.co").hostname,
		"abcd.supabase.co",
	);
});

test("assertLocalUrlSafe requires loopback host on port 54322", () => {
	assert.equal(assertLocalUrlSafe(LOCAL).port, "54322");
	assert.throws(
		() => assertLocalUrlSafe("postgresql://p@db.x.supabase.co:5432/postgres"),
		/not loopback/,
	);
	assert.throws(
		() => assertLocalUrlSafe("postgresql://postgres@127.0.0.1:5432/postgres"),
		/not the local/,
	);
});

test("sqlLiteral serializes scalars, escapes quotes, and casts objects to jsonb", () => {
	assert.equal(sqlLiteral(null), "NULL");
	assert.equal(sqlLiteral(undefined), "NULL");
	assert.equal(sqlLiteral(true), "true");
	assert.equal(sqlLiteral(42), "42");
	assert.equal(sqlLiteral("O'Brien"), "'O''Brien'");
	assert.equal(sqlLiteral({ a: 1 }), `'{"a":1}'::jsonb`);
});

test("buildUserInsert mirrors the seed columns with a dev password", () => {
	assert.equal(buildUserInsert([]), "");
	const sql = buildUserInsert([
		{ id: "u1", email: "a'b@x.com", app_metadata: { provider: "slack" } },
	]);
	assert.match(sql, /INSERT INTO auth\.users \(id, instance_id, email/);
	assert.match(sql, /extensions\.crypt\('password123'/);
	assert.match(sql, /'a''b@x\.com'/); // escaped
	assert.match(sql, /ON CONFLICT \(id\) DO NOTHING;/);
});

test("buildIdentityInsert expands per-identity rows with a provider_id fallback", () => {
	assert.equal(buildIdentityInsert([{ id: "u1" }]), ""); // no identities -> empty
	const sql = buildIdentityInsert([
		{
			id: "u1",
			identities: [
				{
					provider: "slack",
					id: "SLACK123",
					identity_data: { sub: "SLACK123" },
				},
			],
		},
	]);
	assert.match(sql, /INSERT INTO auth\.identities/);
	assert.match(sql, /gen_random_uuid\(\)/);
	assert.match(sql, /'slack'/);
	assert.match(sql, /'SLACK123'/);
	assert.match(sql, /ON CONFLICT \(provider, provider_id\) DO NOTHING;/);
});

test("buildMemberInsert uses the row's columns and escapes values", () => {
	assert.equal(buildMemberInsert([]), "");
	const sql = buildMemberInsert([
		{ user_id: "u1", given_name: "Jus'tin", active: true },
	]);
	assert.match(
		sql,
		/INSERT INTO public\.members \(user_id, given_name, active\)/,
	);
	assert.match(sql, /'Jus''tin'/);
	assert.match(sql, /, true\)/);
	assert.match(sql, /ON CONFLICT \(user_id\) DO NOTHING;/);
});

test("inferPgType picks a type from the first non-null value", () => {
	assert.equal(inferPgType([{ x: null }, { x: "abc" }], "x"), "text");
	assert.equal(inferPgType([{ x: 5 }], "x"), "numeric");
	assert.equal(inferPgType([{ x: true }], "x"), "boolean");
	assert.equal(inferPgType([{ x: { a: 1 } }], "x"), "jsonb");
	assert.equal(inferPgType([{ x: null }], "x"), "text"); // all-null default
});

test("buildAddColumnsSql emits idempotent ALTERs for prod-only columns", () => {
	assert.equal(buildAddColumnsSql([], []), "");
	const sql = buildAddColumnsSql(["linkedin_id"], [{ linkedin_id: "abc123" }]);
	assert.match(
		sql,
		/ALTER TABLE public\.members ADD COLUMN IF NOT EXISTS "linkedin_id" text;/,
	);
});

test("buildLoadSql wraps sections in a truncate + replica-role envelope", () => {
	const out = buildLoadSql({
		addColumns:
			'ALTER TABLE public.members ADD COLUMN IF NOT EXISTS "linkedin_id" text;',
		users: "INSERT INTO auth.users ...;",
		identities: "",
		members: "INSERT INTO public.members ...;",
	});
	assert.match(out, /SET session_replication_role = replica;/);
	assert.match(out, /ADD COLUMN IF NOT EXISTS "linkedin_id" text;/);
	assert.match(out, /TRUNCATE TABLE auth\.users, public\.members CASCADE;/);
	assert.match(out, /SET session_replication_role = DEFAULT;/);
	// The ALTER runs before the TRUNCATE/inserts.
	assert.ok(out.indexOf("ADD COLUMN") < out.indexOf("TRUNCATE"));
	// Empty sections are dropped.
	assert.ok(!out.includes("\n\n\n"));
});
