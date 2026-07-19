import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	encryptRecord,
	SENSITIVE_MEMBER_FIELDS,
	SENSITIVE_SEPA_FIELDS,
} from "../../src/lib/sensitiveData.js";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockDatabase, mockSupabaseErrors } from "../mocks/supabase.js";

const MERGE_TARGET_ID = "11111111-1111-4111-8111-111111111111";
const MERGE_SOURCE_ID = "22222222-2222-4222-8222-222222222222";

function makeMergeMember(
	userId: string,
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		user_id: userId,
		given_name: "Test",
		surname: "User",
		date_of_birth: "1990-01-01",
		street: "Test St",
		number: "7",
		postal_code: "80802",
		city: "Munich",
		country: "DE",
		phone: "+49123456789",
		active: true,
		member_status: "active",
		created_at: "2025-01-01T00:00:00Z",
		salutation: "",
		title: "",
		batch: "WS23",
		department: "Software Development",
		member_role: "Member",
		board_role: null,
		research_project_id: null,
		degree: "B.Sc.",
		school: "TUM",
		linkedin_profile_url: null,
		public_location: null,
		...overrides,
	};
}

describe("Admin Routes", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	describe("GET /api/admin/members", () => {
		test("admin can list all members", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.data);
			assert.ok(Array.isArray(payload.data));
			assert.strictEqual(payload.data.length, 2);
			assert.ok(payload.total);
			assert.strictEqual(payload.page, 1);
			assert.strictEqual(payload.limit, 10);
		});

		test("regular user denied access", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.error);
			assert.match(payload.error, /admin/i);
		});

		test("unauthenticated request denied", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members",
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("pagination works correctly", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members?page=1&limit=1",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.data.length, 1);
			assert.strictEqual(payload.total, 2);
			assert.strictEqual(payload.page, 1);
			assert.strictEqual(payload.limit, 1);
		});

		test("search filter works", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members?search=Admin",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.data.length >= 1);
			const hasAdmin = payload.data.some(
				(m: { given_name: string }) => m.given_name === "Admin",
			);
			assert.ok(hasAdmin);
		});

		test("admin list decrypts encrypted member and SEPA fields", async () => {
			resetDatabase();
			mockDatabase.members[0] = encryptRecord(
				mockDatabase.members[0],
				SENSITIVE_MEMBER_FIELDS,
			);
			mockDatabase.sepa[0] = encryptRecord(
				mockDatabase.sepa[0],
				SENSITIVE_SEPA_FIELDS,
			);

			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			const member = payload.data.find(
				(m: { user_id: string }) => m.user_id === testUserIds.user,
			);
			assert.ok(member);
			assert.strictEqual(member.city, "Test City");
			assert.strictEqual(member.sepa.iban, "DE89370400440532013000");
		});

		test("admin list blanks undecryptable fields instead of failing", async () => {
			resetDatabase();
			mockDatabase.members[0].city =
				"enc-v1:AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBBBBBBBB:CCCC";

			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			const member = payload.data.find(
				(m: { user_id: string }) => m.user_id === testUserIds.user,
			);
			assert.ok(member);
			assert.strictEqual(member.city, "");
		});

		test("active filter works", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members?active=true",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.ok(
				payload.data.every((m: { active: boolean }) => m.active === true),
			);
		});

		test("mandate_agreed=false includes members without a SEPA record", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members?mandate_agreed=false",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.deepStrictEqual(
				payload.data.map((member: { user_id: string }) => member.user_id),
				[testUserIds.admin],
			);
		});

		test("privacy_agreed=false includes members without a SEPA record", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members?privacy_agreed=false",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.deepStrictEqual(
				payload.data.map((member: { user_id: string }) => member.user_id),
				[testUserIds.admin],
			);
		});

		test("data_privacy_notice_agreed=false includes members without a SEPA record", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members?data_privacy_notice_agreed=false",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.deepStrictEqual(
				payload.data.map((member: { user_id: string }) => member.user_id),
				[testUserIds.admin],
			);
		});

		test("sorting works correctly", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members?sort_by=surname&sort_asc=true",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			const surnames = payload.data.map((m: { surname: string }) => m.surname);
			const sortedSurnames = [...surnames].sort();
			assert.deepStrictEqual(surnames, sortedSurnames);
		});
	});

	describe("GET /api/admin/member-duplicate-candidates", () => {
		test("flags likely duplicates by matching name and date of birth", async () => {
			resetDatabase();
			mockDatabase.members.push({
				user_id: testUserIds.otherUser,
				given_name: "Test",
				surname: "User",
				date_of_birth: "1990-01-01",
				street: "Other St",
				number: "7",
				postal_code: "80802",
				city: "Munich",
				country: "DE",
				phone: "+49123456789",
				active: true,
				member_status: "active",
				created_at: "2025-01-01T00:00:00Z",
				salutation: "",
				title: "",
				batch: "WS23",
				department: "Software Development",
				member_role: "Member",
				board_role: null,
				research_project_id: null,
				degree: "B.Sc.",
				school: "TUM",
				linkedin_profile_url: null,
				public_location: null,
			});

			const response = await app.inject({
				method: "GET",
				url: "/api/admin/member-duplicate-candidates",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.data.length, 1);
			assert.strictEqual(payload.data[0].confidence, "high");
			assert.match(payload.data[0].reason, /same name and date of birth/i);
			assert.deepStrictEqual(
				payload.data[0].members
					.map((member: { user_id: string }) => member.user_id)
					.sort(),
				[testUserIds.otherUser, testUserIds.user].sort(),
			);
		});

		test("returns 413 when duplicate detection would scan too many members", async () => {
			resetDatabase();
			for (let index = 0; index < 5_000; index++) {
				mockDatabase.members.push(
					makeMergeMember(`scan-member-${index}`, {
						given_name: `Scan${index}`,
						surname: "Member",
					}),
				);
			}

			const response = await app.inject({
				method: "GET",
				url: "/api/admin/member-duplicate-candidates",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 413);
			assert.match(response.payload, /limited to 5000 members/i);
		});
	});

	describe("POST /api/admin/members/merge", () => {
		test("regular user denied access", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "POST",
				url: "/api/admin/members/merge",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					source_user_id: MERGE_SOURCE_ID,
					target_user_id: MERGE_TARGET_ID,
				}),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("admin merges a duplicate member into the canonical target", async () => {
			resetDatabase();
			mockDatabase.members.push(
				makeMergeMember(MERGE_TARGET_ID, { given_name: "Target" }),
				makeMergeMember(MERGE_SOURCE_ID, { given_name: "Source" }),
			);
			mockDatabase.user_roles.push({
				user_id: MERGE_TARGET_ID,
				role: "user",
			});
			mockDatabase.user_roles.push({
				user_id: MERGE_SOURCE_ID,
				role: "user",
			});
			mockDatabase.member_agreements.push({
				user_id: MERGE_SOURCE_ID,
				sepa_mandate_agreed: false,
				privacy_policy_agreed: false,
				data_privacy_notice_agreed: true,
				created_at: "2025-01-01T00:00:00Z",
				updated_at: "2025-01-01T00:00:00Z",
			});
			mockDatabase.reimbursements.push({
				id: "duplicate-reimbursement",
				user_id: MERGE_SOURCE_ID,
				amount: 42,
				date: "2026-05-01",
				description: "Duplicate account reimbursement",
				department: "Community",
				submission_type: "reimbursement",
				payment_iban: "DE89370400440532013000",
				payment_bic: "COBADEFFXXX",
				receipt_filename: "duplicate.pdf",
				receipt_mime_type: "application/pdf",
				receipt_base64: "JVBERi0xLjQ=",
				status: "requested",
				approval_status: "pending",
				payment_status: "to_be_paid",
				rejection_reason: null,
				created_at: "2026-05-01T10:00:00Z",
				updated_at: "2026-05-01T10:00:00Z",
			});
			mockDatabase.member_role_history.push({
				id: "role-history-duplicate",
				user_id: MERGE_SOURCE_ID,
				role: "Member",
				semester: "WS23",
				started_at: null,
				ended_at: null,
				note: null,
				created_at: "2025-01-01T00:00:00Z",
				created_by: testUserIds.admin,
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/admin/members/merge",
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					source_user_id: MERGE_SOURCE_ID,
					target_user_id: MERGE_TARGET_ID,
					note: "Same real person",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.source_user_id, MERGE_SOURCE_ID);
			assert.strictEqual(payload.target_user_id, MERGE_TARGET_ID);
			assert.strictEqual(payload.transferred_counts.members, 1);
			assert.ok(payload.audit_id);
			assert.strictEqual(
				mockDatabase.members.some(
					(member) => member.user_id === MERGE_SOURCE_ID,
				),
				false,
			);
			assert.strictEqual(
				mockDatabase.reimbursements.find(
					(row) => row.id === "duplicate-reimbursement",
				)?.user_id,
				MERGE_TARGET_ID,
			);
			assert.strictEqual(
				mockDatabase.member_role_history.find(
					(row) => row.id === "role-history-duplicate",
				)?.user_id,
				MERGE_TARGET_ID,
			);
			assert.strictEqual(
				mockDatabase.user_roles.some(
					(role) => role.user_id === MERGE_SOURCE_ID,
				),
				false,
			);
			assert.strictEqual(mockDatabase.member_merge_audit.length, 1);
			assert.strictEqual(
				mockDatabase.member_merge_audit[0].source_user_id,
				MERGE_SOURCE_ID,
			);
		});

		test("rejects malformed member ids before calling the database", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "POST",
				url: "/api/admin/members/merge",
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					source_user_id: "not-a-uuid",
					target_user_id: MERGE_TARGET_ID,
				}),
			});

			assert.strictEqual(response.statusCode, 400);
			assert.match(response.payload, /invalid member merge payload/i);
		});

		test("preserves admin access when merging an admin source into a user target", async () => {
			resetDatabase();
			mockDatabase.members.push(
				makeMergeMember(MERGE_TARGET_ID, { given_name: "Target" }),
				makeMergeMember(MERGE_SOURCE_ID, { given_name: "Source" }),
			);
			mockDatabase.user_roles.push(
				{ user_id: MERGE_TARGET_ID, role: "user" },
				{ user_id: MERGE_SOURCE_ID, role: "admin" },
			);

			const response = await app.inject({
				method: "POST",
				url: "/api/admin/members/merge",
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					source_user_id: MERGE_SOURCE_ID,
					target_user_id: MERGE_TARGET_ID,
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(
				mockDatabase.user_roles.find((role) => role.user_id === MERGE_TARGET_ID)
					?.role,
				"admin",
			);
		});

		test("blocks unresolved TUM.ai Day response conflicts", async () => {
			resetDatabase();
			mockDatabase.members.push(
				makeMergeMember(MERGE_TARGET_ID, { given_name: "Target" }),
				makeMergeMember(MERGE_SOURCE_ID, { given_name: "Source" }),
			);
			mockDatabase.user_roles.push(
				{ user_id: MERGE_TARGET_ID, role: "user" },
				{ user_id: MERGE_SOURCE_ID, role: "user" },
			);
			mockDatabase.tumai_day_responses.push(
				{
					id: "target-response",
					tumai_day_id: "day-1",
					user_id: MERGE_TARGET_ID,
					status: "yes",
					reason: null,
				},
				{
					id: "source-response",
					tumai_day_id: "day-1",
					user_id: MERGE_SOURCE_ID,
					status: "no",
					reason: "Unavailable",
				},
			);

			const response = await app.inject({
				method: "POST",
				url: "/api/admin/members/merge",
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					source_user_id: MERGE_SOURCE_ID,
					target_user_id: MERGE_TARGET_ID,
				}),
			});

			assert.strictEqual(response.statusCode, 409);
			assert.match(response.payload, /TUM.ai Day response conflicts/i);
			assert.ok(
				mockDatabase.members.some(
					(member) => member.user_id === MERGE_SOURCE_ID,
				),
			);
			assert.strictEqual(mockDatabase.member_merge_audit.length, 0);
		});
	});

	describe("PATCH /api/admin/members/:userId/role", () => {
		// Admin role assignment is the only legitimate path to mutate
		// `members.member_role`. Regular users must not be able to change their
		// own role (or anyone else's) via the member profile PUT. See also the
		// assertions in members.test.ts.

		test("admin can set a canonical role", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/role`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ member_role: "Team Lead" }),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.member_role, "Team Lead");
		});

		test("president and vice-president clear their operational department", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/role`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ member_role: "President" }),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.member_role, "President");
			assert.strictEqual(payload.department, null);
		});

		test("rejects role=Alumni because alumni is a member status", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/role`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ member_role: "Alumni" }),
			});

			assert.strictEqual(response.statusCode, 400);
		});

		test("rejects roles outside the canonical 5", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/role`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ member_role: "Chief Wizard" }),
			});

			assert.strictEqual(response.statusCode, 400);
		});

		test("regular user denied access", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/role`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ member_role: "President" }),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("unknown member returns 404", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: "/api/admin/members/missing-user/role",
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ member_role: "President" }),
			});

			assert.strictEqual(response.statusCode, 404);
			assert.deepStrictEqual(JSON.parse(response.payload), {
				error: "Member not found",
			});
		});

		test("unauthenticated request denied", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/role`,
				headers: { "content-type": "application/json" },
				payload: JSON.stringify({ member_role: "President" }),
			});

			assert.strictEqual(response.statusCode, 401);
		});
	});

	describe("PATCH /api/admin/members/:userId/department", () => {
		test("admin can update a member department", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/department`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ department: "Community" }),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.department, "Community");
		});

		test("accepts Research as a member department", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/department`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ department: "Research" }),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.department, "Research");
		});

		test("rejects Board as a department for roles that require one", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/department`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ department: "Board" }),
			});

			assert.strictEqual(response.statusCode, 400);
			assert.match(response.payload, /department is required/i);
		});

		test("regular user denied access", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/department`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ department: "Research" }),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("board leadership cannot be assigned to operational departments", async () => {
			resetDatabase();
			const member = mockDatabase.members.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			if (!member) throw new Error("Expected test member to exist");
			member.member_role = "Vice-President";

			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/department`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ department: "Legal & Finance" }),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.department, null);
		});

		test("rejects department updates when the department field is omitted", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/department`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({}),
			});

			assert.strictEqual(response.statusCode, 400);
		});
	});

	describe("PATCH /api/admin/members/:userId/access-role", () => {
		test("admin can grant admin access to another member", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/access-role`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ access_role: "admin" }),
			});

			assert.strictEqual(response.statusCode, 200);
			const updatedRole = mockDatabase.user_roles.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			assert.strictEqual(updatedRole?.role, "admin");
		});

		test("admin can revoke admin access back to user when another admin remains", async () => {
			resetDatabase();
			mockDatabase.user_roles.push({
				user_id: testUserIds.user,
				role: "admin",
			});
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.admin}/access-role`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ access_role: "user" }),
			});

			assert.strictEqual(response.statusCode, 200);
			const updatedRole = mockDatabase.user_roles.find(
				(entry) => entry.user_id === testUserIds.admin,
			);
			assert.strictEqual(updatedRole?.role, "user");
		});

		test("cannot revoke the last remaining admin", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.admin}/access-role`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ access_role: "user" }),
			});

			assert.strictEqual(response.statusCode, 409);
			assert.match(response.payload, /at least one admin/i);
		});
	});

	describe("PATCH /api/admin/members/:userId", () => {
		test("admin can save member edits through one combined endpoint", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					department: "Legal & Finance",
					member_role: "President",
					board_role: "Board Member",
					member_status: "inactive",
					access_role: "admin",
					batch: "SS25",
					linkedin_profile_url: "https://linkedin.com/in/example-profile",
					public_location: "Munich, Germany",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const updatedMember = mockDatabase.members.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			assert.strictEqual(updatedMember?.member_role, "President");
			assert.strictEqual(updatedMember?.department, null);
			assert.strictEqual(updatedMember?.board_role, "Board Member");
			assert.strictEqual(updatedMember?.member_status, "inactive");
			assert.strictEqual(updatedMember?.active, false);
			assert.strictEqual(updatedMember?.batch, "SS25");
			assert.strictEqual(
				updatedMember?.linkedin_profile_url,
				"https://linkedin.com/in/example-profile",
			);
			assert.strictEqual(updatedMember?.public_location, "Munich, Germany");
			const updatedRole = mockDatabase.user_roles.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			assert.strictEqual(updatedRole?.role, "admin");
		});

		test("admin can assign a research member to a research project", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					department: "Research",
					member_role: "Member",
					board_role: null,
					member_status: "active",
					access_role: "user",
					batch: "WS23",
					research_project_id: "project-a",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const updatedMember = mockDatabase.members.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			assert.strictEqual(updatedMember?.department, "Research");
			assert.strictEqual(updatedMember?.research_project_id, "project-a");
		});

		test("admin can update batch for a member with no department when the role is unchanged", async () => {
			resetDatabase();
			const member = mockDatabase.members.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			assert.ok(member);
			member.department = null;
			member.member_role = "Member";
			member.board_role = null;
			member.member_status = "active";
			member.active = true;
			member.batch = null;

			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					department: null,
					member_role: "Member",
					board_role: null,
					member_status: "active",
					access_role: "user",
					batch: "WS23",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const updatedMember = mockDatabase.members.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			assert.strictEqual(updatedMember?.department, null);
			assert.strictEqual(updatedMember?.member_role, "Member");
			assert.strictEqual(updatedMember?.batch, "WS23");
		});

		test("admin cannot change a member role that requires a department without setting one", async () => {
			resetDatabase();
			const member = mockDatabase.members.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			assert.ok(member);
			member.department = null;
			member.member_role = "Member";

			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					department: null,
					member_role: "Team Lead",
					board_role: null,
					member_status: "active",
					access_role: "user",
					batch: "WS23",
				}),
			});

			assert.strictEqual(response.statusCode, 400);
			assert.match(response.payload, /department is required/i);
			const unchangedMember = mockDatabase.members.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			assert.strictEqual(unchangedMember?.department, null);
			assert.strictEqual(unchangedMember?.member_role, "Member");
		});

		test("rolls back LinkedIn fields when access-role persistence fails", async () => {
			resetDatabase();
			const memberBefore = mockDatabase.members.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			assert.ok(memberBefore);
			Object.assign(memberBefore, {
				department: "Software Development",
				member_role: "Member",
				board_role: null,
				member_status: "active",
				active: true,
				batch: "WS23",
				research_project_id: null,
				linkedin_profile_url: "https://linkedin.com/in/original-profile",
				public_location: "Munich",
			});
			mockSupabaseErrors.userRolesUpsert = {
				message: "forced user role failure",
			};

			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					department: "Legal & Finance",
					member_role: "Team Lead",
					board_role: "Board Member",
					member_status: "inactive",
					access_role: "admin",
					batch: "SS25",
					research_project_id: null,
					linkedin_profile_url: "https://linkedin.com/in/partial-save",
					public_location: "Berlin",
				}),
			});

			assert.strictEqual(response.statusCode, 500);
			const memberAfter = mockDatabase.members.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			assert.strictEqual(memberAfter?.department, "Software Development");
			assert.strictEqual(memberAfter?.member_role, "Member");
			assert.strictEqual(memberAfter?.board_role, null);
			assert.strictEqual(memberAfter?.member_status, "active");
			assert.strictEqual(memberAfter?.active, true);
			assert.strictEqual(memberAfter?.batch, "WS23");
			assert.strictEqual(memberAfter?.research_project_id, null);
			assert.strictEqual(
				memberAfter?.linkedin_profile_url,
				"https://linkedin.com/in/original-profile",
			);
			assert.strictEqual(memberAfter?.public_location, "Munich");
		});

		test("admin member edit rejects non-LinkedIn profile URLs", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					department: "Research",
					member_role: "Member",
					board_role: null,
					member_status: "active",
					access_role: "user",
					batch: "WS23",
					research_project_id: "project-a",
					linkedin_profile_url: "https://example.com/in/example-profile",
				}),
			});

			assert.strictEqual(response.statusCode, 400);
		});

		test("admin can save member edits for an unclaimed member without writing a default access role", async () => {
			resetDatabase();
			const unclaimedUserId = "unclaimed-user-123";
			mockDatabase.members.push({
				...mockDatabase.members[0],
				user_id: unclaimedUserId,
				given_name: "Unclaimed",
				surname: "Member",
				department: null,
				member_role: "Member",
				board_role: null,
				member_status: "active",
				active: true,
			});

			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${unclaimedUserId}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					department: "Community",
					member_role: "Team Lead",
					board_role: null,
					member_status: "inactive",
					access_role: "user",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const updatedMember = mockDatabase.members.find(
				(entry) => entry.user_id === unclaimedUserId,
			);
			assert.strictEqual(updatedMember?.member_role, "Team Lead");
			assert.strictEqual(updatedMember?.department, "Community");
			assert.strictEqual(updatedMember?.member_status, "inactive");
			assert.strictEqual(updatedMember?.active, false);
			assert.strictEqual(
				mockDatabase.user_roles.some(
					(entry) => entry.user_id === unclaimedUserId,
				),
				false,
			);
		});

		test("admin cannot grant access roles to members before they have signed in", async () => {
			resetDatabase();
			const unclaimedUserId = "unclaimed-user-456";
			mockDatabase.members.push({
				...mockDatabase.members[0],
				user_id: unclaimedUserId,
				given_name: "No Auth",
				surname: "Member",
				department: null,
				member_role: "Member",
				board_role: null,
				member_status: "active",
				active: true,
			});

			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${unclaimedUserId}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					department: "Community",
					member_role: "Team Lead",
					board_role: null,
					member_status: "inactive",
					access_role: "admin",
				}),
			});

			assert.strictEqual(response.statusCode, 409);
			assert.match(response.payload, /sign in/i);
			const unchangedMember = mockDatabase.members.find(
				(entry) => entry.user_id === unclaimedUserId,
			);
			assert.strictEqual(unchangedMember?.member_role, "Member");
			assert.strictEqual(unchangedMember?.department, null);
			assert.strictEqual(unchangedMember?.member_status, "active");
			assert.strictEqual(unchangedMember?.active, true);
		});
	});

	describe("Admin member_role_history CRUD", () => {
		// Past-role terms live in a separate `member_role_history` table so that
		// the current role (members.member_role) remains the authoritative "now"
		// snapshot while admins can curate the full trajectory per member.

		test("admin can list a member's role history (empty initially)", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/admin/members/${testUserIds.user}/role-history`,
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.ok(Array.isArray(payload));
		});

		test("admin can add a past role term", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "POST",
				url: `/api/admin/members/${testUserIds.user}/role-history`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					role: "Team Lead",
					semester: "WS25/26",
					started_at: "2025-10-01",
					ended_at: "2026-03-31",
					note: "Department X",
				}),
			});

			assert.strictEqual(response.statusCode, 201);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.role, "Team Lead");
			assert.strictEqual(payload.semester, "WS25/26");
			assert.strictEqual(payload.user_id, testUserIds.user);
		});

		test("rejects role outside canonical 5 in history", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "POST",
				url: `/api/admin/members/${testUserIds.user}/role-history`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ role: "Chief Wizard" }),
			});

			assert.strictEqual(response.statusCode, 400);
		});

		test("rejects invalid date formats in history", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "POST",
				url: `/api/admin/members/${testUserIds.user}/role-history`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					role: "Team Lead",
					started_at: "2025-02-30",
				}),
			});

			assert.strictEqual(response.statusCode, 400);
		});

		test("rejects ended_at earlier than started_at", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "POST",
				url: `/api/admin/members/${testUserIds.user}/role-history`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					role: "Team Lead",
					started_at: "2026-04-01",
					ended_at: "2026-03-31",
				}),
			});

			assert.strictEqual(response.statusCode, 400);
		});

		test("regular user denied from reading someone else's history", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/admin/members/${testUserIds.admin}/role-history`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("admin can delete a past role entry", async () => {
			resetDatabase();
			const createResponse = await app.inject({
				method: "POST",
				url: `/api/admin/members/${testUserIds.user}/role-history`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ role: "Member", semester: "SS25" }),
			});
			const { id } = JSON.parse(createResponse.payload);

			const response = await app.inject({
				method: "DELETE",
				url: `/api/admin/members/${testUserIds.user}/role-history/${id}`,
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 204);
		});
	});

	describe("PATCH /api/admin/members/:userId/status", () => {
		test("admin can set member status to inactive", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/status`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ member_status: "inactive" }),
			});

			assert.strictEqual(response.statusCode, 200);
			const updatedMember = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			assert.strictEqual(updatedMember?.member_status, "inactive");
			assert.strictEqual(updatedMember?.active, false);
			assert.strictEqual(updatedMember?.member_role, "Member");
		});

		test("admin can set member status to alumni without changing role", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/status`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ member_status: "alumni" }),
			});

			assert.strictEqual(response.statusCode, 200);
			const updatedMember = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			assert.strictEqual(updatedMember?.member_status, "alumni");
			assert.strictEqual(updatedMember?.active, false);
			assert.strictEqual(updatedMember?.member_role, "Member");
		});

		test("regular user denied access", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.otherUser}/status`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ member_status: "inactive" }),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("validates status is one of active/inactive/alumni", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/status`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ member_status: "paused" }),
			});

			assert.strictEqual(response.statusCode, 400);
		});

		test("unauthenticated request denied", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/status`,
				headers: { "content-type": "application/json" },
				payload: JSON.stringify({ member_status: "inactive" }),
			});

			assert.strictEqual(response.statusCode, 401);
		});
	});
});
