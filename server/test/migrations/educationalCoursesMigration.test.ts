import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const migration = readFileSync(
	new URL(
		"../../../supabase/migrations/20260804120000_educational_courses.sql",
		import.meta.url,
	),
	"utf8",
);

describe("educational course migration", () => {
	test("keeps education roles out of authenticated member directory grants", () => {
		assert.match(
			migration,
			/revoke select \("educational_course_role"\)[\s\S]*?from anon, authenticated/i,
		);
		assert.doesNotMatch(
			migration,
			/grant select \("educational_course_role"\)[\s\S]*?to authenticated/i,
		);
	});

	test("checks only the authenticated caller role through a hardened helper", () => {
		assert.match(
			migration,
			/create or replace function "public"\."has_educational_course_role"\([\s\S]*?security definer[\s\S]*?stable[\s\S]*?set search_path = ''[\s\S]*?member_row\.user_id = auth\.uid\(\)/i,
		);
		assert.match(
			migration,
			/revoke all[\s\S]*?has_educational_course_role"\(text\)[\s\S]*?from public, anon, authenticated, service_role/i,
		);
		assert.match(
			migration,
			/grant execute[\s\S]*?has_educational_course_role"\(text\)[\s\S]*?to authenticated/i,
		);
	});

	test("revalidates the applicant before a review is recorded", () => {
		const reviewFunction = migration.slice(
			migration.indexOf(
				'create or replace function "public"."review_educational_course_application"',
			),
			migration.indexOf(
				'create or replace function "private"."reconcile_educational_course_applications"',
			),
		);
		assert.match(
			reviewFunction,
			/v_application\.applicant_user_id = p_reviewer_user_id[\s\S]*?errcode = '42501'/i,
		);
		assert.match(
			reviewFunction,
			/member_row\.user_id = v_application\.applicant_user_id[\s\S]*?educational_course_role = 'participant'[\s\S]*?errcode = '55000'/i,
		);
	});

	test("drops pending applications when education roles or membership change", () => {
		assert.match(
			migration,
			/create or replace function "private"\."reconcile_educational_course_applications"[\s\S]*?delete from public\.educational_course_applications[\s\S]*?status = 'pending'/i,
		);
		assert.match(
			migration,
			/create trigger "members_reconcile_educational_course_applications"[\s\S]*?after update of "educational_course_role", "member_status", "active"[\s\S]*?on "public"\."members"/i,
		);
	});

	test("uses the caller scoped helper in every education read policy", () => {
		for (const policy of [
			"Education members read course periods",
			"Applicants read own course applications",
			"Education administrators read course applications",
		]) {
			assert.match(
				migration,
				new RegExp(
					`create policy "${policy}"[\\s\\S]*?has_educational_course_role`,
					"i",
				),
			);
		}
	});
});
