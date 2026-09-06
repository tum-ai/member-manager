import assert from "node:assert";
import { describe, test } from "node:test";
import {
	assistantEventSchema,
	beaconMemberBasicSchema,
	CLAIM_STATUS_LABELS,
	expertiseQueryRequestSchema,
	searchRequestSchema,
} from "../dist/index.js";

describe("Beacon shared contracts", () => {
	test("labels pending claims as unverified", () => {
		assert.strictEqual(CLAIM_STATUS_LABELS.pending, "Unverified");
	});

	test("accepts a profile member without an avatar", () => {
		const result = beaconMemberBasicSchema.safeParse({
			user_id: "00000000-0000-4000-8000-000000000001",
			given_name: "Ada",
			surname: "Lovelace",
			department: "Research",
			batch: "WS22",
			member_role: "Member",
			board_role: null,
			linkedin_profile_url: null,
			linkedin_url: null,
			public_location: null,
			member_status: "active",
		});
		assert.strictEqual(result.success, true);
	});

	test("validates graph query and Beacon search request bounds", () => {
		assert.strictEqual(
			expertiseQueryRequestSchema.safeParse({ question: "ML" }).success,
			false,
		);
		assert.strictEqual(
			searchRequestSchema.safeParse({
				text: "find ML members",
				mentions: [],
			}).success,
			true,
		);
	});

	test("parses a streamed assistant people event", () => {
		const result = assistantEventSchema.safeParse({
			type: "people",
			people: [
				{
					user_id: "00000000-0000-4000-8000-000000000001",
					name: "Ada Lovelace",
					avatar_url: null,
					best_chunk: "machine learning",
					score: 0.9,
				},
			],
		});
		assert.strictEqual(result.success, true);
	});
});
