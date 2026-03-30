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
import { mockDatabase } from "../mocks/supabase.js";

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
			// Use a token whose user is not present in the seeded members so we
			// exercise the member-creation path.
			const newUserId = testUserIds.otherUser;
			const payload = mockMemberPayload({
				user_id: newUserId,
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders(testTokens.otherUser),
					"content-type": "application/json",
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.email, "other@test.com");
			const storedMember = mockDatabase.members.find(
				(member) => member.user_id === newUserId,
			);
			assert.ok(storedMember);
			assert.match(String(storedMember?.date_of_birth), /^enc-v1:/);
			assert.match(String(storedMember?.street), /^enc-v1:/);
			assert.match(String(storedMember?.city), /^enc-v1:/);
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

		test("rejects invalid date_of_birth", async () => {
			resetDatabase();
			const payload = mockMemberPayload({
				user_id: testUserIds.user,
				date_of_birth: "1995-02-31",
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

	describe("GET /api/members", () => {
		test("authenticated user can retrieve member list", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.ok(Array.isArray(data));
			assert.strictEqual(data.length, 2);
		});

		test("rejects unauthenticated request", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members",
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("returns only active members", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.ok(data.every((member: { active: boolean }) => member.active));
		});

		test("returns correct fields", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			const member = data[0];
			assert.ok("user_id" in member);
			assert.ok("given_name" in member);
			assert.ok("surname" in member);
			assert.ok("email" in member);
			assert.ok("batch" in member);
			assert.ok("department" in member);
			assert.ok("member_role" in member);
			assert.ok("degree" in member);
			assert.ok("school" in member);
			assert.ok("active" in member);
		});

		test("members are sorted by surname ascending", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			for (let i = 0; i < data.length - 1; i++) {
				assert.ok(data[i].surname.localeCompare(data[i + 1].surname) <= 0);
			}
		});
	});

	describe("PUT /api/members/:userId", () => {
		test("owner can update own profile", async () => {
			resetDatabase();
			const updatePayload = {
				given_name: "Updated",
				surname: "Name",
				street: "Updated Street",
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
			assert.strictEqual(data.email, "user@test.com");
			assert.strictEqual(data.given_name, "Updated");
			assert.strictEqual(data.street, "Updated Street");
			const storedMember = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			assert.ok(storedMember);
			assert.match(String(storedMember?.street), /^enc-v1:/);
		});

		test("admin can update any profile", async () => {
			resetDatabase();
			const updatePayload = {
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
			assert.strictEqual(data.email, "user@test.com");
		});

		test("user cannot update other's profile", async () => {
			resetDatabase();
			const updatePayload = {
				given_name: "Hacker",
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

		test("rejects unauthenticated request", async () => {
			resetDatabase();
			const updatePayload = {
				given_name: "Test",
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
