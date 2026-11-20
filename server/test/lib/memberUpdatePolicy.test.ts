import "../setup.js";
import assert from "node:assert";
import { describe, test } from "node:test";
import { ValidationError } from "../../src/lib/errors.js";
import { resolveMemberUpdate } from "../../src/lib/profile/memberUpdatePolicy.js";

const member = { existing: { member_role: "Member", department: "Research" } };

describe("resolveMemberUpdate", () => {
	test("keeps only the keys that were sent", () => {
		const patch = resolveMemberUpdate(
			{ city: "Munich", batch: undefined },
			{ isAdmin: false, ...member },
		);
		assert.deepStrictEqual(patch, { city: "Munich" });
	});

	test("never copies keys that are not profile member fields", () => {
		const hostile = JSON.parse(
			'{"city":"x","__proto__":{"polluted":true},"user_id":"someone-else","version":9,"constructor":"x"}',
		);
		const patch = resolveMemberUpdate(hostile, { isAdmin: true, ...member });
		assert.deepStrictEqual(patch, { city: "x" });
		assert.strictEqual(Object.hasOwn(patch, "user_id"), false);
		assert.strictEqual(({} as Record<string, unknown>).polluted, undefined);
	});

	test("members cannot write role or department", () => {
		const patch = resolveMemberUpdate(
			{ member_role: "President", department: "Marketing", city: "x" },
			{ isAdmin: false, ...member },
		);
		assert.deepStrictEqual(patch, { city: "x" });
	});

	test("a member keeps the research project only in the stored Research department", () => {
		assert.deepStrictEqual(
			resolveMemberUpdate(
				{ research_project_id: "rp-1" },
				{ isAdmin: false, ...member },
			),
			{ research_project_id: "rp-1" },
		);
		assert.deepStrictEqual(
			resolveMemberUpdate(
				{ research_project_id: "rp-1" },
				{
					isAdmin: false,
					existing: { member_role: "Member", department: "Venture" },
				},
			),
			{ research_project_id: null },
		);
	});

	test("admins set role and department; executives get no department", () => {
		assert.deepStrictEqual(
			resolveMemberUpdate(
				{ member_role: "Team Lead", department: "Marketing" },
				{ isAdmin: true, existing: null },
			),
			{
				member_role: "Team Lead",
				department: "Marketing",
				research_project_id: null,
			},
		);
		const president = resolveMemberUpdate(
			{ member_role: "President", department: "Marketing" },
			{ isAdmin: true, existing: null },
		);
		assert.strictEqual(president.department, null);
	});

	test("admins need a department for Member and Team Lead", () => {
		assert.throws(
			() =>
				resolveMemberUpdate(
					{ member_role: "Member", department: null },
					{ isAdmin: true, existing: null },
				),
			ValidationError,
		);
	});

	test("an admin keeps the research project when moving into Research", () => {
		assert.deepStrictEqual(
			resolveMemberUpdate(
				{ department: "Research", research_project_id: "rp-9" },
				{
					isAdmin: true,
					existing: { member_role: "Member", department: "Venture" },
				},
			),
			{
				department: "Research",
				member_role: "Member",
				research_project_id: "rp-9",
			},
		);
	});

	test("an admin edit of unrelated fields leaves role and department alone", () => {
		assert.deepStrictEqual(
			resolveMemberUpdate(
				{ city: "x" },
				{
					isAdmin: true,
					existing: { member_role: "Member", department: "Research" },
				},
			),
			{ city: "x" },
		);
	});
});
