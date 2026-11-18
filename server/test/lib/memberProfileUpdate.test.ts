import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildMemberProfileUpdate } from "../../src/lib/memberProfileUpdate.js";

describe("buildMemberProfileUpdate", () => {
	test("drops admin-managed fields for self-service updates", () => {
		const result = buildMemberProfileUpdate({
			body: {
				given_name: "Ada",
				member_role: "Team Lead",
				department: "Venture",
				batch: "SS25",
			},
			isAdmin: false,
			existingMember: { member_role: "Member", department: "Community" },
			userId: "user-1",
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.payload.given_name, "Ada");
		assert.equal(result.payload.batch, "SS25");
		assert.equal(result.payload.user_id, "user-1");
		assert.equal("member_role" in result.payload, false);
		assert.equal("department" in result.payload, false);
	});

	test("omits undefined keys so a partial body does not null other columns", () => {
		const result = buildMemberProfileUpdate({
			body: {
				given_name: "Ada",
				batch: undefined,
				salutation: undefined,
			},
			isAdmin: false,
			existingMember: null,
			userId: "user-1",
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.deepEqual(result.payload, {
			given_name: "Ada",
			user_id: "user-1",
		});
	});

	test("resolves research_project_id against the existing department for members", () => {
		const inResearch = buildMemberProfileUpdate({
			body: { research_project_id: "rp-1" },
			isAdmin: false,
			existingMember: { member_role: "Member", department: "Research" },
			userId: "user-1",
		});
		assert.equal(inResearch.ok, true);
		if (inResearch.ok) {
			assert.equal(inResearch.payload.research_project_id, "rp-1");
		}

		const outside = buildMemberProfileUpdate({
			body: { research_project_id: "rp-1" },
			isAdmin: false,
			existingMember: { member_role: "Member", department: "Venture" },
			userId: "user-1",
		});
		assert.equal(outside.ok, true);
		if (outside.ok) {
			assert.equal(outside.payload.research_project_id, null);
		}
	});

	test("requires a department for Member and Team Lead admin updates", () => {
		const result = buildMemberProfileUpdate({
			body: { member_role: "Member", department: null },
			isAdmin: true,
			existingMember: { member_role: "Member", department: "Venture" },
			userId: "admin-1",
		});

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.match(result.error, /Department is required/);
	});

	test("lets admins set role, department and research project together", () => {
		const result = buildMemberProfileUpdate({
			body: {
				member_role: "Member",
				department: "Research",
				research_project_id: "rp-9",
			},
			isAdmin: true,
			existingMember: { member_role: "Member", department: "Venture" },
			userId: "admin-1",
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.payload.member_role, "Member");
		assert.equal(result.payload.department, "Research");
		assert.equal(result.payload.research_project_id, "rp-9");
	});
});
