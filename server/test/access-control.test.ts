import "./setup.js";
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
} from "./helpers.js";

describe("Access Control Matrix", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	describe("Public endpoints", () => {
		test("GET /health is accessible without authentication", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/health",
			});

			assert.strictEqual(response.statusCode, 200);
		});
	});

	describe("Authenticated endpoints - Members (own)", () => {
		test("unauthenticated - GET /api/members/:userId returns 401", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}`,
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("regular user - GET /api/members/:userId (own) returns 200", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
		});

		test("admin - GET /api/members/:userId (own) returns 200", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.admin}`,
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
		});
	});

	describe("Authenticated endpoints - Members (other)", () => {
		test("unauthenticated - GET /api/members/:userId (other) returns 401", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.otherUser}`,
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("regular user - GET /api/members/:userId (other) returns 403", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.otherUser}`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("admin - GET /api/members/:userId (other) returns 200", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}`,
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
		});
	});

	describe("Authenticated endpoints - SEPA (own)", () => {
		test("unauthenticated - GET /api/sepa/:userId returns 401", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/sepa/${testUserIds.user}`,
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("regular user - GET /api/sepa/:userId (own) returns 200", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/sepa/${testUserIds.user}`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
		});

		test("admin - GET /api/sepa/:userId (own) returns 200", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/sepa/${testUserIds.user}`,
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
		});
	});

	describe("Authenticated endpoints - SEPA (other)", () => {
		test("unauthenticated - GET /api/sepa/:userId (other) returns 401", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/sepa/${testUserIds.admin}`,
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("regular user - GET /api/sepa/:userId (other) returns 403", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/sepa/${testUserIds.admin}`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("admin - GET /api/sepa/:userId (other) returns 200", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/sepa/${testUserIds.user}`,
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
		});
	});

	describe("Admin-only endpoints", () => {
		test("unauthenticated - GET /api/admin/members returns 401", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members",
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("regular user - GET /api/admin/members returns 403", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("admin - GET /api/admin/members returns 200", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
		});

		test("unauthenticated - PATCH /api/admin/members/:userId/status returns 401", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/status`,
				headers: { "content-type": "application/json" },
				payload: JSON.stringify({ active: false }),
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("regular user - PATCH /api/admin/members/:userId/status returns 403", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/status`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ active: false }),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("admin - PATCH /api/admin/members/:userId/status returns 200", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/status`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ active: false }),
			});

			assert.strictEqual(response.statusCode, 200);
		});
	});

	describe("Write operations access control", () => {
		test("regular user can PUT /api/members/:userId (own)", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					email: "updated@test.com",
					given_name: "Updated",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
		});

		test("regular user cannot PUT /api/members/:userId (other)", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.otherUser}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					email: "hacked@test.com",
				}),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("admin can PUT /api/members/:userId (other)", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					email: "admin-updated@test.com",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
		});
	});
});
