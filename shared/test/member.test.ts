import assert from "node:assert";
import { describe, test } from "node:test";
import {
	MEMBER_SALUTATIONS,
	memberBatchFormFieldSchema,
	normalizeMemberBatch,
	TUMAI_DEPARTMENTS,
} from "../dist/index.js";

describe("TUMAI_DEPARTMENTS", () => {
	test("lists the operational departments in alphabetical order", () => {
		assert.deepStrictEqual(TUMAI_DEPARTMENTS, [
			"Alumni Relations",
			"Community",
			"Innovation Department",
			"Legal & Finance",
			"Makeathon",
			"Marketing",
			"Partners & Sponsors",
			"Research",
			"Software Development",
			"Venture",
		]);
	});
});

describe("member batch", () => {
	test("normalizeMemberBatch stores blanks as null and accepts valid batches", () => {
		assert.strictEqual(normalizeMemberBatch(undefined), null);
		assert.strictEqual(normalizeMemberBatch(null), null);
		assert.strictEqual(normalizeMemberBatch("   "), null);
		assert.strictEqual(normalizeMemberBatch(" WS25 "), "WS25");
	});

	test("normalizeMemberBatch rejects malformed batches", () => {
		assert.throws(() => normalizeMemberBatch("WS25/26"));
		assert.throws(() => normalizeMemberBatch("WS19"));
	});

	test("the form field accepts blank and valid batches only", () => {
		for (const ok of [undefined, null, "", "SS24", "WS30"]) {
			assert.strictEqual(
				memberBatchFormFieldSchema.safeParse(ok).success,
				true,
			);
		}
		for (const bad of ["25", "WS25/26", "ws25"]) {
			assert.strictEqual(
				memberBatchFormFieldSchema.safeParse(bad).success,
				false,
			);
		}
	});
});

describe("MEMBER_SALUTATIONS", () => {
	test("offers the salutations the profile select shows", () => {
		assert.deepStrictEqual([...MEMBER_SALUTATIONS], ["Mr.", "Ms.", "Mx."]);
	});
});
