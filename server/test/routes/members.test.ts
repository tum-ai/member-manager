import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	mockMemberPayload,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";

describe("Members Routes", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	describe("POST /api/members", () => {
		test("creates member for authenticated user", async () => {
			resetDatabase();
			const newUserId = "new-user-123";
			const payload = mockMemberPayload({
				user_id: newUserId,
				email: "newuser@test.com",
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					...payload,
					user_id: testUserIds.user,
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.email, "user@test.com");
		});

		test("returns existing member if already exists", async () => {
			resetDatabase();
			const payload = mockMemberPayload({
				user_id: testUserIds.user,
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.user_id, testUserIds.user);
		});

		test("rejects missing auth header", async () => {
			resetDatabase();
			const payload = mockMemberPayload();

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: { "content-type": "application/json" },
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("rejects invalid token", async () => {
			resetDatabase();
			const payload = mockMemberPayload();

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders("invalid-token"),
					"content-type": "application/json",
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("rejects user_id mismatch", async () => {
			resetDatabase();
			const payload = mockMemberPayload({
				user_id: testUserIds.otherUser,
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 403);
			const data = JSON.parse(response.payload);
			assert.match(data.error, /mismatch/i);
		});

		test("rejects invalid email format", async () => {
			resetDatabase();
			const payload = mockMemberPayload({
				user_id: testUserIds.user,
				email: "not-an-email",
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 400);
		});
	});

	describe("GET /api/members/:userId", () => {
		test("owner can view own profile", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.user_id, testUserIds.user);
			assert.strictEqual(data.email, "user@test.com");
		});

		test("admin can view any profile", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}`,
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.user_id, testUserIds.user);
		});

		test("user cannot view other's profile", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.otherUser}`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("returns 404 for non-existent member", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members/non-existent-id",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 404);
		});

		test("rejects unauthenticated request", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}`,
			});

			assert.strictEqual(response.statusCode, 401);
		});
	});

	describe("PUT /api/members/:userId", () => {
		test("owner can update own profile", async () => {
			resetDatabase();
			const updatePayload = {
				email: "updated@test.com",
				given_name: "Updated",
				surname: "Name",
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.email, "updated@test.com");
			assert.strictEqual(data.given_name, "Updated");
		});

		test("admin can update any profile", async () => {
			resetDatabase();
			const updatePayload = {
				email: "admin-updated@test.com",
				given_name: "AdminUpdated",
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.email, "admin-updated@test.com");
		});

		test("user cannot update other's profile", async () => {
			resetDatabase();
			const updatePayload = {
				email: "hacker@test.com",
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.otherUser}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("rejects invalid email in update", async () => {
			resetDatabase();
			const updatePayload = {
				email: "not-an-email",
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 400);
		});

		test("rejects unauthenticated request", async () => {
			resetDatabase();
			const updatePayload = {
				email: "test@test.com",
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: { "content-type": "application/json" },
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 401);
		});
	});
});
