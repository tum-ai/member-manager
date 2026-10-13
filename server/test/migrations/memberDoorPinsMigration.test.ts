import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { encryptValue } from "../../src/lib/sensitiveData.js";
import "../setup.js";

const MIGRATION_PATH = new URL(
	"../../../supabase/migrations/20261013120000_member_door_pins.sql",
	import.meta.url,
);
const migration = readFileSync(MIGRATION_PATH, "utf8");
const RUN_LOCAL_RLS_TESTS = process.env.RUN_LOCAL_SUPABASE_RLS_TESTS === "true";
const REPO_ROOT =
	process.env.SUPABASE_TEST_PROJECT_DIR ??
	fileURLToPath(new URL("../../..", import.meta.url));
// Seeded admin (supabase/seed.sql); merge_duplicate_member requires an admin.
const SEED_ADMIN_ID = "00000000-0000-0000-0000-000000000001";

test("door PINs are service-role only", () => {
	assert.match(
		migration,
		/alter table "public"\."member_door_pins" enable row level security/,
	);
	assert.match(
		migration,
		/revoke all on table "public"\."member_door_pins"\s+from public, anon, authenticated/,
	);
	assert.match(
		migration,
		/grant select, insert, update, delete\s+on table "public"\."member_door_pins"\s+to service_role/,
	);
});

test("the encryption guard covers door PINs on insert and on PIN updates", () => {
	assert.match(
		migration,
		/elsif tg_table_name = 'member_door_pins' then\s+if not private\.is_encrypted_sensitive_value\(new\.pin\)/,
	);
	assert.match(
		migration,
		/before insert on "public"\."member_door_pins"[\s\S]*?enforce_encrypted_sensitive_fields/,
	);
	assert.match(
		migration,
		/before update of "pin" on "public"\."member_door_pins"[\s\S]*?enforce_encrypted_sensitive_fields/,
	);
	// The re-defined guard keeps the existing tables.
	for (const table of ["members", "sepa", "reimbursements"]) {
		assert.match(migration, new RegExp(`tg_table_name = '${table}'`));
	}
});

test("member merges carry the door PIN over instead of cascading it away", () => {
	const merge = migration.slice(
		migration.indexOf(
			'create or replace function "public"."merge_duplicate_member"',
		),
	);
	assert.match(
		merge,
		/update public\.member_door_pins\s+set user_id = p_target_user_id/,
	);
	assert.match(merge, /'member_door_pins', v_count/);
	// The move happens before the source member (and its cascade) is deleted.
	assert.ok(
		merge.indexOf("update public.member_door_pins") <
			merge.indexOf("delete from public.members"),
	);
	// PINs stay out of the merge audit snapshot.
	const snapshot = merge.slice(
		merge.indexOf("v_source_snapshot := jsonb_build_object"),
		merge.indexOf("insert into public.member_merge_audit"),
	);
	assert.doesNotMatch(snapshot, /door_pin/);
	assert.match(
		merge,
		/grant execute[\s\S]*merge_duplicate_member[\s\S]*to service_role/,
	);
});

function localSupabaseEnvironment(): Record<string, string> {
	const output = execFileSync("supabase", ["status", "-o", "env"], {
		cwd: REPO_ROOT,
		encoding: "utf8",
	});
	return Object.fromEntries(
		output
			.split(/\r?\n/)
			.map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
			.filter((match): match is RegExpMatchArray => match !== null)
			.map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, "")]),
	);
}

describe("member door PINs against the local database", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, () => {
	let environment: Record<string, string>;
	let serviceClient: SupabaseClient;
	const createdUserIds: string[] = [];

	const service = (): SupabaseClient => {
		if (!serviceClient) {
			environment = localSupabaseEnvironment();
			serviceClient = createClient(
				environment.API_URL,
				environment.SERVICE_ROLE_KEY,
				{ auth: { autoRefreshToken: false, persistSession: false } },
			);
		}
		return serviceClient;
	};

	// A throwaway auth user; `handle_new_user` creates its members row.
	async function createMember(): Promise<string> {
		const { data, error } = await service().auth.admin.createUser({
			email: `door-pin-${randomUUID()}@example.com`,
			email_confirm: true,
		});
		assert.ifError(error);
		assert.ok(data.user);
		createdUserIds.push(data.user.id);
		return data.user.id;
	}

	after(async () => {
		for (const id of createdUserIds) {
			await service().auth.admin.deleteUser(id);
		}
	});

	test("refuses a plaintext PIN", async () => {
		const memberId = await createMember();
		const { error } = await service()
			.from("member_door_pins")
			.insert({ user_id: memberId, pin: "482913" });
		assert.ok(error);
		assert.match(error.message, /Door PINs must be encrypted/);
	});

	test("the anon key can't read PINs", async () => {
		const memberId = await createMember();
		const { error: insertError } = await service()
			.from("member_door_pins")
			.insert({ user_id: memberId, pin: encryptValue("482913") });
		assert.ifError(insertError);

		const anon = createClient(environment.API_URL, environment.ANON_KEY, {
			auth: { autoRefreshToken: false, persistSession: false },
		});
		const { data, error } = await anon
			.from("member_door_pins")
			.select("user_id, pin");
		assert.ok(error || (data ?? []).length === 0);
	});

	test("a merge moves the source's PIN and keeps the target's own", async () => {
		const sourceId = await createMember();
		const targetId = await createMember();
		const otherSourceId = await createMember();
		const sourcePin = encryptValue("111111");
		const { error: insertError } = await service()
			.from("member_door_pins")
			.insert([
				{ user_id: sourceId, pin: sourcePin },
				{ user_id: otherSourceId, pin: encryptValue("222222") },
			]);
		assert.ifError(insertError);

		const merge = (source: string) =>
			service().rpc("merge_duplicate_member", {
				p_source_user_id: source,
				p_target_user_id: targetId,
				p_admin_user_id: SEED_ADMIN_ID,
			});
		assert.ifError((await merge(sourceId)).error);
		// The target now has a PIN, so a second source's PIN is dropped.
		assert.ifError((await merge(otherSourceId)).error);

		const { data, error } = await service()
			.from("member_door_pins")
			.select("user_id, pin")
			.in("user_id", [sourceId, targetId, otherSourceId]);
		assert.ifError(error);
		assert.deepEqual(data, [{ user_id: targetId, pin: sourcePin }]);
	});
});
