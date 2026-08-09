import assert from "node:assert";
import { describe, test } from "node:test";
import {
	educationalCourseParticipantCandidateListSchema,
	educationalCourseParticipantListSchema,
	getEducationalCourseDateOnly,
	searchEducationalCourseParticipantCandidatesSchema,
} from "../dist/index.js";

describe("educational course business dates", () => {
	test("uses Europe Berlin across standard and daylight saving time", () => {
		assert.strictEqual(
			getEducationalCourseDateOnly(new Date("2026-03-28T23:30:00.000Z")),
			"2026-03-29",
		);
		assert.strictEqual(
			getEducationalCourseDateOnly(new Date("2026-06-01T22:30:00.000Z")),
			"2026-06-02",
		);
	});
});

describe("educational course member identifiers", () => {
	test("accepts PostgreSQL GUIDs independently of UUID version", () => {
		const versionlessMemberId = "00000000-0000-0000-0000-000000000006";
		const parsed = educationalCourseParticipantListSchema.safeParse({
			participants: [
				{
					userId: versionlessMemberId,
					givenName: "Course",
					surname: "Participant",
					active: true,
				},
			],
		});
		const parsedCandidates =
			educationalCourseParticipantCandidateListSchema.safeParse({
				candidates: [
					{
						userId: versionlessMemberId,
						givenName: "Course",
						surname: "Candidate",
						email: "course@example.com",
					},
				],
			});

		assert.strictEqual(parsed.success, true);
		assert.strictEqual(parsedCandidates.success, true);
	});

	test("requires a bounded participant candidate search", () => {
		assert.strictEqual(
			searchEducationalCourseParticipantCandidatesSchema.safeParse({
				search: "Ada",
			}).success,
			true,
		);
		assert.strictEqual(
			searchEducationalCourseParticipantCandidatesSchema.safeParse({
				search: "A",
			}).success,
			false,
		);
	});
});
