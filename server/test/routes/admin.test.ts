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
import { mockDatabase } from "../mocks/supabase.js";

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

		test("president and vice-president keep their operational department", async () => {
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
			assert.strictEqual(payload.department, "Software Development");
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
				payload: JSON.stringify({ department: "Board" }),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.department, "Board");
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
				payload: JSON.stringify({ department: "Board" }),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("board leadership can update operational departments", async () => {
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
			assert.strictEqual(payload.department, "Legal & Finance");
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
					member_status: "inactive",
					access_role: "admin",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const updatedMember = mockDatabase.members.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			assert.strictEqual(updatedMember?.member_role, "President");
			assert.strictEqual(updatedMember?.department, "Legal & Finance");
			assert.strictEqual(updatedMember?.member_status, "inactive");
			assert.strictEqual(updatedMember?.active, false);
			const updatedRole = mockDatabase.user_roles.find(
				(entry) => entry.user_id === testUserIds.user,
			);
			assert.strictEqual(updatedRole?.role, "admin");
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
