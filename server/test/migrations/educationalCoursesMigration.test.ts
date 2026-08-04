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
