import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockDatabase } from "../mocks/supabase.js";

describe("Member Change Request Routes", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	test("member can submit an admin-managed profile change request", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "POST",
			url: "/api/member-change-requests",
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				changes: {
					department: "Board",
					member_role: "President",
					degree: "M.Sc. Computer Science",
				},
				reason: "Changed responsibilities",
			}),
		});

		assert.strictEqual(response.statusCode, 201);
		const payload = JSON.parse(response.payload);
		assert.strictEqual(payload.user_id, testUserIds.user);
		assert.strictEqual(payload.status, "pending");
		assert.strictEqual(payload.changes.department, "Board");
		assert.strictEqual(mockDatabase.member_change_requests.length, 1);
	});

	test("admin can list pending member change requests", async () => {
		resetDatabase();
		mockDatabase.member_change_requests.push({
			id: "request-1",
			user_id: testUserIds.user,
			status: "pending",
			changes: { department: "Board" },
			reason: "Changed responsibilities",
			created_at: "2026-04-24T10:00:00Z",
		});

		const response = await app.inject({
			method: "GET",
			url: "/api/admin/member-change-requests",
			headers: authHeaders(testTokens.admin),
		});

		assert.strictEqual(response.statusCode, 200);
		const payload = JSON.parse(response.payload);
		assert.strictEqual(payload.length, 1);
		assert.strictEqual(payload[0].id, "request-1");
	});

	test("admin can approve a member change request and apply the changes", async () => {
		resetDatabase();
		mockDatabase.member_change_requests.push({
			id: "request-approve",
			user_id: testUserIds.user,
			status: "pending",
			changes: {
				department: "Board",
				member_role: "Vice-President",
				degree: "M.Sc. Computer Science",
			},
			reason: "New responsibilities",
			created_at: "2026-04-24T10:00:00Z",
		});

		const response = await app.inject({
			method: "PATCH",
			url: "/api/admin/member-change-requests/request-approve",
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				decision: "approved",
				review_note: "Looks good",
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const updatedMember = mockDatabase.members.find(
			(member) => member.user_id === testUserIds.user,
		);
		assert.strictEqual(updatedMember?.department, "Board");
		assert.strictEqual(updatedMember?.member_role, "Vice-President");
		assert.strictEqual(updatedMember?.degree, "M.Sc. Computer Science");

		const updatedRequest = mockDatabase.member_change_requests.find(
			(request) => request.id === "request-approve",
		);
		assert.strictEqual(updatedRequest?.status, "approved");
		assert.strictEqual(updatedRequest?.review_note, "Looks good");
	});

	test("executive change requests always resolve to the Board department", async () => {
		resetDatabase();
		mockDatabase.member_change_requests.push({
			id: "request-board-role",
			user_id: testUserIds.user,
			status: "pending",
			changes: {
				department: "Legal & Finance",
				member_role: "President",
			},
			reason: "abc",
			created_at: "2026-04-24T10:00:00Z",
		});

		const response = await app.inject({
			method: "PATCH",
			url: "/api/admin/member-change-requests/request-board-role",
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				decision: "approved",
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const updatedMember = mockDatabase.members.find(
			(member) => member.user_id === testUserIds.user,
		);
		assert.strictEqual(updatedMember?.member_role, "President");
		assert.strictEqual(updatedMember?.department, "Board");
	});

	test("admin can reject a member change request without mutating the member", async () => {
		resetDatabase();
		mockDatabase.member_change_requests.push({
			id: "request-reject",
			user_id: testUserIds.user,
			status: "pending",
			changes: {
				department: "Board",
				member_role: "President",
			},
			reason: "Wanted to test",
			created_at: "2026-04-24T10:00:00Z",
		});

		const originalMember = mockDatabase.members.find(
			(member) => member.user_id === testUserIds.user,
		);

		const response = await app.inject({
			method: "PATCH",
			url: "/api/admin/member-change-requests/request-reject",
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				decision: "rejected",
				review_note: "Not enough context",
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const updatedMember = mockDatabase.members.find(
			(member) => member.user_id === testUserIds.user,
		);
		assert.deepStrictEqual(updatedMember, originalMember);

		const updatedRequest = mockDatabase.member_change_requests.find(
			(request) => request.id === "request-reject",
		);
		assert.strictEqual(updatedRequest?.status, "rejected");
		assert.strictEqual(updatedRequest?.review_note, "Not enough context");
	});
});
