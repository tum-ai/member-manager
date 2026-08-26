import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// The integration case is opt-in because it writes isolated, random rows to the
// local database. CI can enable it after `supabase db reset`; ordinary unit and
// migration-text runs remain non-destructive.
const RUN_LOCAL_MERGE_TESTS =
	process.env.RUN_LOCAL_SUPABASE_BEACON_MERGE_TESTS === "true";
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const MIGRATION = readFileSync(
	new URL(
		"../../../supabase/migrations/20260826100500_preserve_beacon_on_member_merge.sql",
		import.meta.url,
	),
	"utf8",
);

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

const authOptions = {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
};

test("Beacon merge migration states the preservation contract", () => {
	assert.match(MIGRATION, /merge_beacon_member_data/i);
	assert.match(
		MIGRATION,
		/opted_out\s*=\s*public\.beacon_person\.opted_out\s+or/i,
	);
	assert.match(
		MIGRATION,
		/status = case[\s\S]*?source_claim\.status in \('confirmed', 'rejected'\)/i,
	);
	assert.match(MIGRATION, /delete from public\.beacon_search_chunk/i);
	assert.match(MIGRATION, /set user_id = p_target_user_id/i);
	assert.match(MIGRATION, /delete from public\.beacon_person/i);
});

test("member merge preserves and deduplicates Beacon data", {
	skip: !RUN_LOCAL_MERGE_TESTS,
}, async () => {
	const environment = localSupabaseEnvironment();
	const service = createClient(
		environment.API_URL,
		environment.SERVICE_ROLE_KEY,
		authOptions,
	);
	const sourceUserId = randomUUID();
	const targetUserId = randomUUID();
	const suffix = randomUUID();
	const organizationId = randomUUID();
	const schoolId = randomUUID();
	const skillId = randomUUID();
	const migratedSkillId = randomUUID();
	const projectId = randomUUID();
	const tag = `merge-test-${suffix}`;
	const chatId = randomUUID();
	const turnId = randomUUID();
	const searchLogId = randomUUID();
	const agentLogId = randomUUID();
	let auditId: string | null = null;

	const encryptedPlaceholder =
		"enc-v1:aaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbb:cc";
	const member = (userId: string, givenName: string) => ({
		user_id: userId,
		given_name: givenName,
		surname: "Merge Test",
		date_of_birth: encryptedPlaceholder,
		street: encryptedPlaceholder,
		number: encryptedPlaceholder,
		postal_code: encryptedPlaceholder,
		city: encryptedPlaceholder,
		country: encryptedPlaceholder,
		phone: encryptedPlaceholder,
		member_role: "Member",
		member_status: "active",
		active: true,
	});

	const insert = async (
		table: string,
		rows: Record<string, unknown> | Array<Record<string, unknown>>,
	): Promise<void> => {
		const { error } = await service.from(table).insert(rows);
		assert.ifError(error);
	};

	try {
		const { data: admin, error: adminError } = await service
			.from("user_roles")
			.select("user_id")
			.eq("role", "admin")
			.limit(1)
			.single();
		assert.ifError(adminError);
		assert.ok(admin?.user_id, "expected a seeded admin actor");

		await insert("members", [
			member(sourceUserId, "Beacon Source"),
			member(targetUserId, "Beacon Target"),
		]);
		await insert("beacon_organization", {
			id: organizationId,
			name: `Merge Organization ${suffix}`,
			canonical_key: `merge-organization-${suffix}`,
		});
		await insert("beacon_school", {
			id: schoolId,
			name: `Merge School ${suffix}`,
			canonical_key: `merge-school-${suffix}`,
		});
		await insert("beacon_skill", [
			{
				id: skillId,
				name: `Merge Skill ${suffix}`,
				canonical_key: `merge-skill-${suffix}`,
			},
			{
				id: migratedSkillId,
				name: `Migrated Skill ${suffix}`,
				canonical_key: `migrated-skill-${suffix}`,
			},
		]);
		await insert("beacon_project", {
			id: projectId,
			name: `Merge Project ${suffix}`,
			canonical_key: `merge-project-${suffix}`,
		});
		await insert("beacon_tag_vocabulary", {
			tag,
			label: `Merge Test ${suffix}`,
			category: "test",
		});

		await insert("beacon_person", [
			{
				user_id: targetUserId,
				headline: "Target headline wins",
				summary: null,
				opted_out: false,
			},
			{
				user_id: sourceUserId,
				headline: "Source headline loses",
				summary: "Source summary fills target gap",
				opted_out: true,
			},
		]);

		await insert("beacon_employment", [
			{
				user_id: targetUserId,
				organization_id: organizationId,
				title: "Engineer",
				status: "pending",
				confidence: 0.4,
			},
			{
				user_id: sourceUserId,
				organization_id: organizationId,
				title: "Engineer",
				status: "confirmed",
				confidence: 0.9,
			},
		]);
		await insert("beacon_education", [
			{
				user_id: targetUserId,
				school_id: schoolId,
				degree: "MSc",
				status: "confirmed",
			},
			{
				user_id: sourceUserId,
				school_id: schoolId,
				degree: "MSc",
				status: "rejected",
			},
		]);
		await insert("beacon_person_skill", [
			{
				user_id: targetUserId,
				skill_id: skillId,
				status: "confirmed",
			},
			{
				user_id: sourceUserId,
				skill_id: skillId,
				status: "pending",
			},
			{
				user_id: sourceUserId,
				skill_id: migratedSkillId,
				status: "pending",
			},
		]);
		await insert("beacon_person_project", [
			{
				user_id: targetUserId,
				project_id: projectId,
				status: "pending",
			},
			{
				user_id: sourceUserId,
				project_id: projectId,
				status: "confirmed",
			},
		]);
		await insert("beacon_person_tag", [
			{
				user_id: targetUserId,
				tag,
				status: "pending",
			},
			{
				user_id: sourceUserId,
				tag,
				status: "confirmed",
			},
		]);

		await insert("beacon_search_chunk", [
			{
				user_id: sourceUserId,
				kind: "bio",
				content: "source chunk",
			},
			{
				user_id: targetUserId,
				kind: "bio",
				content: "target chunk",
			},
		]);
		await insert("beacon_search_log", {
			id: searchLogId,
			user_id: sourceUserId,
			query: "merge test query",
			result_count: 1,
		});
		await insert("beacon_agent_log", {
			id: agentLogId,
			chat_id: chatId,
			turn_id: turnId,
			user_id: sourceUserId,
			query: "merge test query",
			trace: { test: true },
		});

		const { data, error } = await service
			.rpc("merge_duplicate_member", {
				p_source_user_id: sourceUserId,
				p_target_user_id: targetUserId,
				p_admin_user_id: admin.user_id,
				p_note: "Beacon migration integration test",
			})
			.single();
		assert.ifError(error);
		const result = data as {
			audit_id: string;
			transferred_counts: Record<string, number>;
		};
		auditId = result.audit_id;
		assert.equal(result.transferred_counts.beacon_person, 1);
		assert.equal(result.transferred_counts.beacon_employment_deduped, 1);
		assert.equal(result.transferred_counts.beacon_education_deduped, 1);
		assert.equal(result.transferred_counts.beacon_person_skill_deduped, 1);
		assert.equal(result.transferred_counts.beacon_person_project_deduped, 1);
		assert.equal(result.transferred_counts.beacon_person_tag_deduped, 1);

		const { data: mergedPerson, error: personError } = await service
			.from("beacon_person")
			.select("headline, summary, opted_out")
			.eq("user_id", targetUserId)
			.single();
		assert.ifError(personError);
		assert.deepEqual(mergedPerson, {
			headline: "Target headline wins",
			summary: "Source summary fills target gap",
			opted_out: true,
		});

		for (const [table, expectedCount, expectedStatus] of [
			["beacon_employment", 1, "confirmed"],
			["beacon_education", 1, "confirmed"],
			["beacon_person_project", 1, "confirmed"],
			["beacon_person_tag", 1, "confirmed"],
		] as const) {
			const { data: rows, error: readError } = await service
				.from(table)
				.select("user_id, status")
				.eq("user_id", targetUserId);
			assert.ifError(readError);
			assert.equal(rows?.length, expectedCount, `${table} target count`);
			assert.equal(rows?.[0]?.status, expectedStatus, `${table} decision`);
		}

		const { data: skills, error: skillsError } = await service
			.from("beacon_person_skill")
			.select("skill_id, status")
			.eq("user_id", targetUserId);
		assert.ifError(skillsError);
		assert.equal(skills?.length, 2);
		assert.equal(
			skills?.find((row) => row.skill_id === skillId)?.status,
			"confirmed",
		);
		assert.equal(
			skills?.find((row) => row.skill_id === migratedSkillId)?.status,
			"pending",
		);

		for (const table of [
			"beacon_employment",
			"beacon_education",
			"beacon_person_skill",
			"beacon_person_project",
			"beacon_person_tag",
		]) {
			const { data: sourceRows, error: sourceError } = await service
				.from(table)
				.select("user_id")
				.eq("user_id", sourceUserId);
			assert.ifError(sourceError);
			assert.deepEqual(sourceRows, [], `${table} source rows removed`);
		}

		const { data: chunks, error: chunksError } = await service
			.from("beacon_search_chunk")
			.select("user_id")
			.in("user_id", [sourceUserId, targetUserId]);
		assert.ifError(chunksError);
		assert.deepEqual(chunks, []);

		const { data: searchLog, error: searchLogError } = await service
			.from("beacon_search_log")
			.select("user_id")
			.eq("id", searchLogId)
			.single();
		assert.ifError(searchLogError);
		assert.equal(searchLog.user_id, targetUserId);

		const { data: agentLog, error: agentLogError } = await service
			.from("beacon_agent_log")
			.select("user_id")
			.eq("id", agentLogId)
			.single();
		assert.ifError(agentLogError);
		assert.equal(agentLog.user_id, targetUserId);

		const { data: sourceMember, error: sourceMemberError } = await service
			.from("members")
			.select("user_id")
			.eq("user_id", sourceUserId)
			.maybeSingle();
		assert.ifError(sourceMemberError);
		assert.equal(sourceMember, null);
	} finally {
		if (auditId)
			await service.from("member_merge_audit").delete().eq("id", auditId);
		await service.from("beacon_search_log").delete().eq("id", searchLogId);
		await service.from("beacon_agent_log").delete().eq("id", agentLogId);
		await service
			.from("members")
			.delete()
			.in("user_id", [sourceUserId, targetUserId]);
		await service.from("beacon_organization").delete().eq("id", organizationId);
		await service.from("beacon_school").delete().eq("id", schoolId);
		await service
			.from("beacon_skill")
			.delete()
			.in("id", [skillId, migratedSkillId]);
		await service.from("beacon_project").delete().eq("id", projectId);
		await service.from("beacon_tag_vocabulary").delete().eq("tag", tag);
	}
});
