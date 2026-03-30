import "./setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	mockMemberPayload,
	mockSepaPayload,
	resetDatabase,
	testTokens,
	testUserIds,
} from "./helpers.js";

describe("Error Handling", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	describe("Validation Errors (400)", () => {
		test("Zod validation error returns 400 with formatted message", async () => {
			resetDatabase();
			const invalidPayload = mockMemberPayload({
				user_id: testUserIds.user,
				date_of_birth: "not-a-date",
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(invalidPayload),
			});

			assert.strictEqual(response.statusCode, 400);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.error);
			assert.match(payload.error, /date_of_birth/i);
		});

		test("Invalid IBAN returns 400 with specific error message", async () => {
			resetDatabase();
			const invalidSepa = mockSepaPayload({
				user_id: "new-user-iban-test",
				iban: "INVALID-IBAN-123",
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/sepa",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					...invalidSepa,
					user_id: "new-user-iban-test",
				}),
			});

			assert.strictEqual(response.statusCode, 400);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.error);
			assert.match(payload.error, /iban/i);
		});

		test("Missing required fields returns 400", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					user_id: testUserIds.user,
				}),
			});

			assert.strictEqual(response.statusCode, 400);
		});

		test("Invalid query parameters return 400", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/admin/members?page=not-a-number",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 400);
		});
	});

	describe("Not Found Errors (404)", () => {
		test("Non-existent member returns 404", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members/non-existent-user-id",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 404);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.error);
			assert.match(payload.error, /not found/i);
		});

		test("Non-existent SEPA data returns 404", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/sepa/non-existent-user-id",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 404);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.error);
			assert.match(payload.error, /not found/i);
		});

		test("Non-existent route returns 404", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/non-existent-route",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 404);
		});
	});

	describe("Forbidden Errors (403)", () => {
		test("User accessing other user's resource returns 403", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.otherUser}`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.error);
		});

		test("User ID mismatch in POST returns 403", async () => {
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
			assert.ok(data.error);
		});

		test("Regular user accessing admin endpoint returns 403", async () => {
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
	});

	describe("Unauthorized Errors (401)", () => {
		test("Missing Authorization header returns 401", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}`,
			});

			assert.strictEqual(response.statusCode, 401);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.error);
		});

		test("Invalid token returns 401", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}`,
				headers: authHeaders("invalid-token"),
			});

			assert.strictEqual(response.statusCode, 401);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.error);
		});
	});

	describe("Error Response Format", () => {
		test("Error responses include error field", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members/non-existent",
				headers: authHeaders(testTokens.admin),
			});

			const payload = JSON.parse(response.payload);
			assert.ok(payload.error);
			assert.strictEqual(typeof payload.error, "string");
		});

		test("Error responses do not leak stack traces", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members/non-existent",
				headers: authHeaders(testTokens.admin),
			});

			const payload = JSON.parse(response.payload);
			assert.ok(!payload.stack);
			assert.ok(!payload.stackTrace);
		});
	});
});
