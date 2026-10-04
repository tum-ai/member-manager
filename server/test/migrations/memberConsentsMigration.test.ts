import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const MIGRATION_PATH = new URL(
	"../../../supabase/migrations/20261004120000_member_agreements_granular_consent.sql",
	import.meta.url,
);
const migration = readFileSync(MIGRATION_PATH, "utf8");
const RUN_LOCAL_RLS_TESTS = process.env.RUN_LOCAL_SUPABASE_RLS_TESTS === "true";
const REPO_ROOT =
	process.env.SUPABASE_TEST_PROJECT_DIR ??
	fileURLToPath(new URL("../../..", import.meta.url));
// Seeded admin (supabase/seed.sql); merge_duplicate_member requires an admin.
const SEED_ADMIN_ID = "00000000-0000-0000-0000-000000000001";

test("granular consent migration carries consents through member merges", () => {
	const merge = migration.slice(
		migration.indexOf(
			'create or replace function "public"."merge_duplicate_member"',
		),
	);
	for (const column of [
		"website_profile_consent",
		"event_photos_consent",
		"partner_sharing_consent",
		"consents_decided_at",
	]) {
		assert.match(
			merge,
			new RegExp(`insert into public\\.member_agreements[\\s\\S]*${column}`),
		);
		assert.match(merge, new RegExp(`do update set[\\s\\S]*${column} =`));
	}
	// The summary is derived by the trigger; OR-ing it in the merge could
	// re-grant purposes the member withdrew.
	assert.doesNotMatch(merge, /data_privacy_notice_agreed\s*=/);
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

type Consents = {
	website_profile_consent: boolean;
	event_photos_consent: boolean;
	partner_sharing_consent: boolean;
	consents_decided_at: string | null;
};

const PARTNER_ONLY = {
	website_profile_consent: false,
	event_photos_consent: false,
	partner_sharing_consent: true,
};
const ALL_GRANTED = {
	website_profile_consent: true,
	event_photos_consent: true,
	partner_sharing_consent: true,
};

describe("member consents against the local database", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, () => {
	let supabase: SupabaseClient;
	const createdUserIds: string[] = [];

	const client = (): SupabaseClient => {
		if (!supabase) {
			const environment = localSupabaseEnvironment();
			supabase = createClient(
				environment.API_URL,
				environment.SERVICE_ROLE_KEY,
				{ auth: { autoRefreshToken: false, persistSession: false } },
			);
		}
		return supabase;
	};

	// A throwaway auth user; `handle_new_user` creates its members row.
	async function createMember(): Promise<string> {
		const { data, error } = await client().auth.admin.createUser({
			email: `consent-${randomUUID()}@example.com`,
			email_confirm: true,
		});
		assert.ifError(error);
		assert.ok(data.user);
		createdUserIds.push(data.user.id);
		return data.user.id;
	}

	async function setConsents(
		userId: string,
		consents: Partial<Consents>,
	): Promise<void> {
		const { error } = await client()
			.from("member_agreements")
			.upsert({ user_id: userId, ...consents }, { onConflict: "user_id" });
		assert.ifError(error);
	}

	async function readAgreements(userId: string) {
		const { data, error } = await client()
			.from("member_agreements")
			.select(
				"data_privacy_notice_agreed, website_profile_consent, event_photos_consent, partner_sharing_consent, consents_decided_at",
			)
			.eq("user_id", userId)
			.maybeSingle();
		assert.ifError(error);
		return data;
	}

	async function merge(sourceId: string, targetId: string): Promise<void> {
		const { error } = await client().rpc("merge_duplicate_member", {
			p_source_user_id: sourceId,
			p_target_user_id: targetId,
			p_admin_user_id: SEED_ADMIN_ID,
		});
		assert.ifError(error);
	}

	after(async () => {
		for (const id of createdUserIds) {
			await client().auth.admin.deleteUser(id);
		}
	});

	test("withdrawing a partner-only consent clears it and the summary", async () => {
		const memberId = await createMember();
		await setConsents(memberId, {
			...PARTNER_ONLY,
			consents_decided_at: "2026-10-01T00:00:00Z",
		});
		await setConsents(memberId, {
			...PARTNER_ONLY,
			partner_sharing_consent: false,
			consents_decided_at: "2026-10-02T00:00:00Z",
		});

		const stored = await readAgreements(memberId);
		assert.equal(stored?.partner_sharing_consent, false);
		assert.equal(stored?.data_privacy_notice_agreed, false);
	});

	test("a merge into a target without agreements keeps a partial decision", async () => {
		const sourceId = await createMember();
		const targetId = await createMember();
		await setConsents(sourceId, {
			...PARTNER_ONLY,
			consents_decided_at: "2026-10-01T00:00:00Z",
		});

		await merge(sourceId, targetId);

		const stored = await readAgreements(targetId);
		assert.equal(stored?.partner_sharing_consent, true);
		assert.equal(stored?.website_profile_consent, false);
		assert.equal(stored?.event_photos_consent, false);
		assert.equal(stored?.data_privacy_notice_agreed, false);
		assert.equal(
			Date.parse(String(stored?.consents_decided_at)),
			Date.parse("2026-10-01T00:00:00Z"),
		);
	});

	test("a newer partial decision on the source replaces an older one on the target", async () => {
		const sourceId = await createMember();
		const targetId = await createMember();
		await setConsents(targetId, {
			...ALL_GRANTED,
			consents_decided_at: "2026-09-01T00:00:00Z",
		});
		await setConsents(sourceId, {
			...PARTNER_ONLY,
			consents_decided_at: "2026-10-01T00:00:00Z",
		});

		await merge(sourceId, targetId);

		const stored = await readAgreements(targetId);
		assert.equal(stored?.partner_sharing_consent, true);
		assert.equal(stored?.event_photos_consent, false);
		assert.equal(stored?.data_privacy_notice_agreed, false);
	});

	test("an older or missing decision on the source never re-grants a purpose", async () => {
		const olderSourceId = await createMember();
		const undecidedSourceId = await createMember();
		const targetId = await createMember();
		await setConsents(targetId, {
			...PARTNER_ONLY,
			consents_decided_at: "2026-10-01T00:00:00Z",
		});
		await setConsents(olderSourceId, {
			...ALL_GRANTED,
			consents_decided_at: "2026-09-01T00:00:00Z",
		});
		await setConsents(undecidedSourceId, {
			sepa_mandate_agreed: true,
		} as never);

		await merge(olderSourceId, targetId);
		await merge(undecidedSourceId, targetId);

		const stored = await readAgreements(targetId);
		assert.equal(stored?.website_profile_consent, false);
		assert.equal(stored?.event_photos_consent, false);
		assert.equal(stored?.partner_sharing_consent, true);
		assert.equal(stored?.data_privacy_notice_agreed, false);
	});
});
