import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	mockSepaPayload,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";

describe("SEPA Routes", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	describe("POST /api/sepa", () => {
		test("creates SEPA for authenticated user", async () => {
			resetDatabase();
			const payload = mockSepaPayload({
				user_id: "new-sepa-id",
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/sepa",
				headers: {
					...authHeaders(testTokens.otherUser),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					...payload,
					user_id: testUserIds.otherUser,
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.ok(data.message);
		});

		test("rejects user_id mismatch", async () => {
			resetDatabase();
			const payload = mockSepaPayload({
				user_id: testUserIds.otherUser,
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/sepa",
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

		test("rejects invalid IBAN", async () => {
			resetDatabase();
			const payload = mockSepaPayload({
				user_id: testUserIds.user,
				iban: "INVALID-IBAN",
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/sepa",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 400);
			const data = JSON.parse(response.payload);
			assert.ok(data.error);
		});

		test("accepts IBAN with spaces", async () => {
			resetDatabase();
			const payload = mockSepaPayload({
				user_id: "another-new-id",
				iban: "DE89 3704 0044 0532 0130 00",
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/sepa",
				headers: {
					...authHeaders(testTokens.otherUser),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					...payload,
					user_id: testUserIds.otherUser,
				}),
			});

			assert.strictEqual(response.statusCode, 200);
		});

		test("rejects unauthenticated request", async () => {
			resetDatabase();
			const payload = mockSepaPayload();

			const response = await app.inject({
				method: "POST",
				url: "/api/sepa",
				headers: { "content-type": "application/json" },
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 401);
		});
	});

	describe("GET /api/sepa/:userId", () => {
		test("owner can view own SEPA data", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/sepa/${testUserIds.user}`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.user_id, testUserIds.user);
			assert.strictEqual(data.iban, "DE89370400440532013000");
		});

		test("admin can view any SEPA data", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/sepa/${testUserIds.user}`,
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.user_id, testUserIds.user);
		});

		test("user cannot view other's SEPA data", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/sepa/${testUserIds.admin}`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("returns 404 for non-existent SEPA data", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/sepa/non-existent-id",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 404);
		});

		test("rejects unauthenticated request", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/sepa/${testUserIds.user}`,
			});

			assert.strictEqual(response.statusCode, 401);
		});
	});

	describe("PUT /api/sepa/:userId", () => {
		test("owner can update own SEPA data", async () => {
			resetDatabase();
			const updatePayload = {
				iban: "GB82WEST12345698765432",
				bic: "WESTNL2A",
				bank_name: "Updated Bank",
				mandate_agreed: true,
				privacy_agreed: true,
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/sepa/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.bank_name, "Updated Bank");
		});

		test("admin can update any SEPA data", async () => {
			resetDatabase();
			const updatePayload = {
				iban: "FR1420041010050500013M02606",
				bank_name: "Admin Updated Bank",
				mandate_agreed: true,
				privacy_agreed: true,
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/sepa/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.bank_name, "Admin Updated Bank");
		});

		test("user cannot update other's SEPA data", async () => {
			resetDatabase();
			const updatePayload = {
				iban: "DE89370400440532013000",
				bank_name: "Hacked Bank",
				mandate_agreed: true,
				privacy_agreed: true,
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/sepa/${testUserIds.admin}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("validates IBAN on update", async () => {
			resetDatabase();
			const updatePayload = {
				iban: "INVALID-IBAN",
				bank_name: "Test Bank",
				mandate_agreed: true,
				privacy_agreed: true,
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/sepa/${testUserIds.user}`,
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
				iban: "DE89370400440532013000",
				bank_name: "Test Bank",
				mandate_agreed: true,
				privacy_agreed: true,
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/sepa/${testUserIds.user}`,
				headers: { "content-type": "application/json" },
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 401);
		});
	});
});
