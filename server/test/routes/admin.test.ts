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

		test("setting role=Alumni also deactivates the member", async () => {
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

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.member_role, "Alumni");
			assert.strictEqual(payload.active, false);
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

	describe("PATCH /api/admin/members/:userId/status", () => {
		test("admin can update member status", async () => {
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
			const payload = JSON.parse(response.payload);
			assert.ok(payload.message);
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
				payload: JSON.stringify({ active: false }),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("validates status is boolean", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/status`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ active: "not-a-boolean" }),
			});

			assert.strictEqual(response.statusCode, 400);
		});

		test("unauthenticated request denied", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "PATCH",
				url: `/api/admin/members/${testUserIds.user}/status`,
				headers: { "content-type": "application/json" },
				payload: JSON.stringify({ active: false }),
			});

			assert.strictEqual(response.statusCode, 401);
		});
	});
});
