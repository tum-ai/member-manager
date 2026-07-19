import "../setup.js";
import assert from "node:assert";
import { after, before, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
} from "../helpers.js";
import { mockDatabase } from "../mocks/supabase.js";

describe("Permission Routes", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	beforeEach(() => {
		resetDatabase();
	});

	describe("GET /api/me/tool-access", () => {
		test("returns all permissions for an admin", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/me/tool-access",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.deepStrictEqual([...data.permissions].sort(), [
				"contracts.admin",
				"contracts.create",
				"finance.review",
				"partners.manage",
				"tumai_days.manage",
			]);
		});

		test("returns empty for a member whose department has no permissions", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/me/tool-access",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.deepStrictEqual(data.permissions, []);
		});

		test("inherits the department's permissions for a non-admin member", async () => {
			const member = mockDatabase.members.find(
				(row) => row.user_id === "user-123",
			);
			assert.ok(member);
			member.department = "Legal & Finance";

			const response = await app.inject({
				method: "GET",
				url: "/api/me/tool-access",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.deepStrictEqual([...data.permissions].sort(), [
				"contracts.admin",
				"finance.review",
			]);
		});

		test("returns empty for an inactive member", async () => {
			const member = mockDatabase.members.find(
				(row) => row.user_id === "user-123",
			);
			assert.ok(member);
			member.department = "Legal & Finance";
			member.member_status = "inactive";
			member.active = false;

			const response = await app.inject({
				method: "GET",
				url: "/api/me/tool-access",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.deepStrictEqual(data.permissions, []);
		});

		test("rejects an unauthenticated request", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/me/tool-access",
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("reports isBoardMember true for an admin (bypasses department checks)", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/me/tool-access",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(JSON.parse(response.payload).isBoardMember, true);
		});

		test("reports isBoardMember false for a contracts.admin who is not on the board", async () => {
			const member = mockDatabase.members.find(
				(row) => row.user_id === "user-123",
			);
			assert.ok(member);
			// contracts.admin via department, but no board_role/President/VP.
			member.department = "Legal & Finance";
			member.board_role = null;
			member.member_role = "Member";

			const response = await app.inject({
				method: "GET",
				url: "/api/me/tool-access",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.ok(data.permissions.includes("contracts.admin"));
			assert.strictEqual(data.isBoardMember, false);
		});

		test("reports isBoardMember true for a board_role member outside contracts.admin departments", async () => {
			const member = mockDatabase.members.find(
				(row) => row.user_id === "user-123",
			);
			assert.ok(member);
			member.department = "Software Development";
			member.board_role = "Board Member";
			member.member_status = "active";
			member.active = true;

			const response = await app.inject({
				method: "GET",
				url: "/api/me/tool-access",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.deepStrictEqual(data.permissions, []);
			assert.strictEqual(data.isBoardMember, true);
		});
	});

	describe("GET /api/admin/department-permissions", () => {
		test("returns the department permission map for an admin", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/department-permissions",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.deepStrictEqual(data.assignments["Legal & Finance"].sort(), [
				"contracts.admin",
				"finance.review",
			]);
		});

		test("rejects a non-admin", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/department-permissions",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});
	});

	describe("PUT /api/admin/department-permissions", () => {
		test("upserts assignments and reflects them in tool access", async () => {
			const response = await app.inject({
				method: "PUT",
				url: "/api/admin/department-permissions",
				headers: authHeaders(testTokens.admin),
				payload: {
					assignments: {
						"Software Development": ["finance.review"],
					},
				},
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.deepStrictEqual(data.assignments["Software Development"], [
				"finance.review",
			]);
			// The pre-existing Legal & Finance row is preserved by the upsert.
			assert.ok(data.assignments["Legal & Finance"]);

			const toolAccess = await app.inject({
				method: "GET",
				url: "/api/me/tool-access",
				headers: authHeaders(testTokens.user),
			});
			assert.strictEqual(toolAccess.statusCode, 200);
			assert.deepStrictEqual(JSON.parse(toolAccess.payload).permissions, [
				"finance.review",
			]);
		});

		test("rejects an unknown permission with 400", async () => {
			const response = await app.inject({
				method: "PUT",
				url: "/api/admin/department-permissions",
				headers: authHeaders(testTokens.admin),
				payload: {
					assignments: {
						"Software Development": ["finance.review", "totally.bogus"],
					},
				},
			});

			// Unknown permissions fail schema validation outright.
			assert.strictEqual(response.statusCode, 400);
		});

		test("rejects a non-admin", async () => {
			const response = await app.inject({
				method: "PUT",
				url: "/api/admin/department-permissions",
				headers: authHeaders(testTokens.user),
				payload: { assignments: {} },
			});

			assert.strictEqual(response.statusCode, 403);
		});
	});
});
