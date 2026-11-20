import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { encryptValue } from "../../src/lib/sensitiveData.js";
import "../setup.js";

const migration = readFileSync(
	new URL(
		"../../../supabase/migrations/20261120120000_member_profile_version_and_save.sql",
		import.meta.url,
	),
	"utf8",
);
const RUN_LOCAL_RLS_TESTS = process.env.RUN_LOCAL_SUPABASE_RLS_TESTS === "true";
const REPO_ROOT =
	process.env.SUPABASE_TEST_PROJECT_DIR ??
	fileURLToPath(new URL("../../..", import.meta.url));

test("the save function is service-role only and raises 40001 on a stale version", () => {
	assert.match(
		migration,
		/revoke all on function "public"\."save_member_profile"\(uuid, bigint, jsonb, jsonb, jsonb\) from public, anon, authenticated/,
	);
	assert.match(
		migration,
		/grant execute on function "public"\."save_member_profile"\(uuid, bigint, jsonb, jsonb, jsonb\) to service_role/,
	);
	assert.match(migration, /errcode = '40001'/);
});

test("member, sepa and agreement writes all bump the profile version", () => {
	assert.match(migration, /before update on "public"\."members"/);
	assert.match(migration, /after insert or update on "public"\."sepa"/);
	assert.match(
		migration,
		/after insert or update on "public"\."member_agreements"/,
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

describe("save_member_profile against the local database", {
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
			email: `profile-${randomUUID()}@example.com`,
			email_confirm: true,
		});
		assert.ifError(error);
		assert.ok(data.user);
		createdUserIds.push(data.user.id);
		return data.user.id;
	}

	async function versionOf(userId: string): Promise<number> {
		const { data, error } = await service()
			.from("members")
			.select("version")
			.eq("user_id", userId)
			.single();
		assert.ifError(error);
		return Number(data?.version);
	}

	function save(
		userId: string,
		expected: number,
		member: Record<string, unknown>,
		sepa: Record<string, unknown> | null = null,
		agreements: Record<string, unknown> | null = null,
	) {
		return service().rpc("save_member_profile", {
			p_user_id: userId,
			p_expected_version: expected,
			p_member: member,
			p_sepa: sepa,
			p_agreements: agreements,
		});
	}

	after(async () => {
		for (const id of createdUserIds) {
			await service().auth.admin.deleteUser(id);
		}
	});

	test("merges the member row, keeps omitted columns and bumps the version", async () => {
		const userId = await createMember();
		const before = await versionOf(userId);

		const first = await save(userId, before, {
			given_name: "Ada",
			batch: "WS25",
			salutation: "Mrs",
		});
		assert.ifError(first.error);
		const second = await save(userId, Number(first.data), {
			city: encryptValue("Munich"),
			batch: null,
		});
		assert.ifError(second.error);

		const { data } = await service()
			.from("members")
			.select("given_name, salutation, batch, version")
			.eq("user_id", userId)
			.single();
		assert.equal(data?.given_name, "Ada");
		assert.equal(data?.salutation, "Mrs");
		assert.equal(data?.batch, null);
		assert.ok(Number(second.data) > Number(first.data));
		assert.equal(Number(data?.version), Number(second.data));
	});

	test("rejects a stale version with 40001 and writes nothing", async () => {
		const userId = await createMember();
		const stale = await versionOf(userId);
		assert.ifError((await save(userId, stale, { given_name: "First" })).error);

		const result = await save(userId, stale, { given_name: "Stale" });
		assert.equal(result.error?.code, "40001");
		const { data } = await service()
			.from("members")
			.select("given_name")
			.eq("user_id", userId)
			.single();
		assert.equal(data?.given_name, "First");
	});

	test("a failing sepa write rolls the member write back", async () => {
		const userId = await createMember();
		const version = await versionOf(userId);

		const result = await save(
			userId,
			version,
			{ given_name: "Rolled Back" },
			// Plaintext: the encryption guard refuses it.
			{ iban: "DE89370400440532013000", bic: "", bank_name: "Bank" },
		);
		assert.ok(result.error);
		const { data } = await service()
			.from("members")
			.select("given_name")
			.eq("user_id", userId)
			.single();
		assert.notEqual(data?.given_name, "Rolled Back");
	});

	test("writes encrypted bank details and agreements, and the sync trigger grants consents", async () => {
		const userId = await createMember();
		const version = await versionOf(userId);

		const result = await save(
			userId,
			version,
			{},
			{
				iban: encryptValue("DE89370400440532013000"),
				bic: "",
				bank_name: encryptValue("Test Bank"),
				mandate_agreed: true,
				privacy_agreed: true,
			},
			{
				sepa_mandate_agreed: true,
				privacy_policy_agreed: true,
				data_privacy_notice_agreed: true,
			},
		);
		assert.ifError(result.error);

		const { data: agreements } = await service()
			.from("member_agreements")
			.select("website_profile_consent, data_privacy_notice_agreed")
			.eq("user_id", userId)
			.single();
		assert.equal(agreements?.website_profile_consent, true);
		const { data: sepa } = await service()
			.from("sepa")
			.select("iban")
			.eq("user_id", userId)
			.single();
		assert.match(String(sepa?.iban), /^enc-v1:/);
	});

	test("an agreements-only save without the notice leaves consents alone", async () => {
		const userId = await createMember();
		let version = await versionOf(userId);
		const granted = await save(userId, version, {}, null, {
			sepa_mandate_agreed: false,
			privacy_policy_agreed: true,
			data_privacy_notice_agreed: true,
		});
		assert.ifError(granted.error);
		version = Number(granted.data);

		assert.ifError(
			(
				await save(userId, version, {}, null, {
					sepa_mandate_agreed: false,
					privacy_policy_agreed: true,
				})
			).error,
		);
		const { data } = await service()
			.from("member_agreements")
			.select("data_privacy_notice_agreed")
			.eq("user_id", userId)
			.single();
		assert.equal(data?.data_privacy_notice_agreed, true);
	});

	test("other writers bump the version too (a satellite row write)", async () => {
		const userId = await createMember();
		const before = await versionOf(userId);
		const { error } = await service()
			.from("member_agreements")
			.upsert(
				{ user_id: userId, sepa_mandate_agreed: true },
				{ onConflict: "user_id" },
			);
		assert.ifError(error);
		assert.ok((await versionOf(userId)) > before);
	});

	test("version 0 creates the member row, and a second version-0 save conflicts", async () => {
		const userId = await createMember();
		// A legacy account without a member row (signup normally creates it).
		for (const table of ["sepa", "member_agreements", "members"]) {
			assert.ifError(
				(await service().from(table).delete().eq("user_id", userId)).error,
			);
		}

		const created = await save(userId, 0, {
			given_name: "Legacy",
			city: encryptValue("Munich"),
		});
		assert.ifError(created.error);
		const { data } = await service()
			.from("members")
			.select("given_name, version")
			.eq("user_id", userId)
			.single();
		assert.equal(data?.given_name, "Legacy");
		assert.equal(Number(data?.version), Number(created.data));

		const again = await save(userId, 0, { given_name: "Twice" });
		assert.equal(again.error?.code, "40001");
	});

	test("anon and authenticated roles cannot execute the function", async () => {
		const userId = await createMember();
		environment = environment ?? localSupabaseEnvironment();
		const anon = createClient(environment.API_URL, environment.ANON_KEY);
		const result = await anon.rpc("save_member_profile", {
			p_user_id: userId,
			p_expected_version: 1,
			p_member: { given_name: "Hacked" },
			p_sepa: null,
			p_agreements: null,
		});
		assert.ok(result.error);
	});
});
