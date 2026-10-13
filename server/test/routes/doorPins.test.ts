import "../setup.js";
import assert from "node:assert";
import { after, before, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { encryptValue, isEncryptedValue } from "../../src/lib/sensitiveData.js";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockDatabase } from "../mocks/supabase.js";

function storePin(userId: string, pin: string): void {
	mockDatabase.member_door_pins.push({
		user_id: userId,
		pin: encryptValue(pin),
		updated_by: testUserIds.admin,
		created_at: "2026-10-01T00:00:00Z",
		updated_at: "2026-10-01T00:00:00Z",
	});
}

function storedPinRow(userId: string) {
	return mockDatabase.member_door_pins.find((row) => row.user_id === userId);
}

describe("Door PIN routes", () => {
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

	describe("GET /api/members/:userId/door-pin", () => {
		const get = (userId: string, token?: string) =>
			app.inject({
				method: "GET",
				url: `/api/members/${userId}/door-pin`,
				headers: token ? authHeaders(token) : {},
			});

		test("returns the owner's PIN once /welcome is saved, never cached", async () => {
			storePin(testUserIds.user, "482913");

			const response = await get(testUserIds.user, testTokens.user);

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(
				response.headers["cache-control"],
				"private, no-store",
			);
			assert.deepStrictEqual(JSON.parse(response.payload), {
				status: "available",
				pin: "482913",
				updated_at: "2026-10-01T00:00:00Z",
			});
		});

		test("asks the owner to finish /welcome first, without revealing whether a PIN exists", async () => {
			storePin(testUserIds.user, "482913");
			mockDatabase.member_agreements[0].consents_decided_at = null;

			const response = await get(testUserIds.user, testTokens.user);

			assert.strictEqual(response.statusCode, 200);
			assert.deepStrictEqual(JSON.parse(response.payload), {
				status: "welcome_required",
			});
		});

		test("treats a member without an agreements row as not onboarded", async () => {
			mockDatabase.member_agreements = [];

			const response = await get(testUserIds.user, testTokens.user);

			assert.deepStrictEqual(JSON.parse(response.payload), {
				status: "welcome_required",
			});
		});

		test("reports a member without a PIN as not assigned", async () => {
			const response = await get(testUserIds.user, testTokens.user);

			assert.strictEqual(response.statusCode, 200);
			assert.deepStrictEqual(JSON.parse(response.payload), {
				status: "not_assigned",
			});
		});

		test("treats an unreadable PIN as not assigned", async () => {
			mockDatabase.member_door_pins.push({
				user_id: testUserIds.user,
				pin: "enc-v1:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA:AAAA",
				updated_at: "2026-10-01T00:00:00Z",
			});

			const response = await get(testUserIds.user, testTokens.user);

			assert.deepStrictEqual(JSON.parse(response.payload), {
				status: "not_assigned",
			});
		});

		test("lets an admin read another member's PIN without the /welcome gate", async () => {
			storePin(testUserIds.user, "482913");
			mockDatabase.member_agreements[0].consents_decided_at = null;

			const response = await get(testUserIds.user, testTokens.admin);

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(JSON.parse(response.payload).pin, "482913");
		});

		test("forbids reading another member's PIN", async () => {
			storePin(testUserIds.admin, "482913");

			const response = await get(testUserIds.admin, testTokens.otherUser);

			assert.strictEqual(response.statusCode, 403);
			assert.doesNotMatch(response.payload, /482913/);
		});

		test("requires authentication", async () => {
			const response = await get(testUserIds.user);

			assert.strictEqual(response.statusCode, 401);
			assert.strictEqual(
				response.headers["cache-control"],
				"private, no-store",
			);
		});
	});

	describe("PUT /api/admin/members/:userId/door-pin", () => {
		const put = (userId: string, body: unknown, token = testTokens.admin) =>
			app.inject({
				method: "PUT",
				url: `/api/admin/members/${userId}/door-pin`,
				headers: {
					...authHeaders(token),
					"content-type": "application/json",
				},
				payload: JSON.stringify(body),
			});

		test("stores the PIN encrypted and records the admin", async () => {
			const response = await put(testUserIds.user, { pin: " 482913 " });

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.status, "available");
			assert.strictEqual(data.pin, "482913");
			const row = storedPinRow(testUserIds.user);
			assert.ok(row);
			assert.ok(isEncryptedValue(row.pin));
			assert.doesNotMatch(String(row.pin), /482913/);
			assert.strictEqual(row.updated_by, testUserIds.admin);
		});

		test("replaces an existing PIN", async () => {
			storePin(testUserIds.user, "111111");

			const response = await put(testUserIds.user, { pin: "222222" });

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(mockDatabase.member_door_pins.length, 1);
			const check = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}/door-pin`,
				headers: authHeaders(testTokens.user),
			});
			assert.strictEqual(JSON.parse(check.payload).pin, "222222");
		});

		test("keeping the member's own PIN is not a conflict", async () => {
			storePin(testUserIds.user, "111111");

			const response = await put(testUserIds.user, { pin: "111111" });

			assert.strictEqual(response.statusCode, 200);
		});

		test("rejects a PIN another member already has", async () => {
			storePin(testUserIds.admin, "482913");

			const response = await put(testUserIds.user, { pin: "482913" });

			assert.strictEqual(response.statusCode, 409);
			assert.strictEqual(storedPinRow(testUserIds.user), undefined);
			assert.doesNotMatch(response.payload, /482913/);
		});

		test("rejects an invalid PIN with a readable message", async () => {
			const response = await put(testUserIds.user, { pin: "12ab" });

			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(
				JSON.parse(response.payload).error,
				"A door PIN has 4 to 10 digits",
			);
		});

		test("returns 404 for an account without a member row", async () => {
			const response = await put(testUserIds.otherUser, { pin: "482913" });

			assert.strictEqual(response.statusCode, 404);
		});

		test("is admin only", async () => {
			const response = await put(
				testUserIds.user,
				{ pin: "482913" },
				testTokens.user,
			);

			assert.strictEqual(response.statusCode, 403);
			assert.strictEqual(storedPinRow(testUserIds.user), undefined);
		});
	});

	describe("DELETE /api/admin/members/:userId/door-pin", () => {
		test("clears the member's PIN", async () => {
			storePin(testUserIds.user, "482913");
			storePin(testUserIds.admin, "654321");

			const response = await app.inject({
				method: "DELETE",
				url: `/api/admin/members/${testUserIds.user}/door-pin`,
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 204);
			assert.strictEqual(storedPinRow(testUserIds.user), undefined);
			assert.ok(storedPinRow(testUserIds.admin));
		});

		test("is admin only", async () => {
			storePin(testUserIds.user, "482913");

			const response = await app.inject({
				method: "DELETE",
				url: `/api/admin/members/${testUserIds.user}/door-pin`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
			assert.ok(storedPinRow(testUserIds.user));
		});
	});

	describe("POST /api/admin/door-pins/import", () => {
		const importSheet = (
			rows: unknown[],
			dryRun: boolean,
			token = testTokens.admin,
		) =>
			app.inject({
				method: "POST",
				url: "/api/admin/door-pins/import",
				headers: {
					...authHeaders(token),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ dry_run: dryRun, rows }),
			});

		const sheet = [
			{
				row_number: 9,
				email: "USER@test.com",
				pin: "482913",
				given_name: "Test",
				surname: "User",
			},
			{
				row_number: 10,
				email: "someone-else@example.com",
				pin: "111222",
				given_name: "Some",
				surname: "One",
			},
			{
				row_number: 11,
				email: "other@test.com",
				pin: "333444",
				given_name: "No",
				surname: "Member",
			},
			{ row_number: 12, email: "admin@test.com", pin: "12" },
		];

		test("a dry run reports what would happen and writes nothing", async () => {
			const response = await importSheet(sheet, true);

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(
				response.headers["cache-control"],
				"private, no-store",
			);
			const result = JSON.parse(response.payload);
			assert.strictEqual(result.dry_run, true);
			assert.strictEqual(result.total, 4);
			assert.strictEqual(result.matched, 1);
			assert.strictEqual(result.created, 1);
			// An auth account without a member row is unmatched, like an
			// unknown email.
			assert.deepStrictEqual(
				result.unmatched.map((row: { row_number: number }) => row.row_number),
				[10, 11],
			);
			assert.deepStrictEqual(result.rejected, [
				{
					row_number: 12,
					email: "admin@test.com",
					name: "",
					reason: "invalid_pin",
				},
			]);
			assert.deepStrictEqual(result.members_without_pin, [
				{
					user_id: testUserIds.admin,
					name: "Admin User",
					email: "admin@test.com",
				},
			]);
			assert.strictEqual(mockDatabase.member_door_pins.length, 0);
			for (const pin of ["482913", "111222", "333444"]) {
				assert.doesNotMatch(response.payload, new RegExp(pin));
			}
		});

		test("applying stores matched PINs encrypted", async () => {
			const response = await importSheet(sheet, false);

			assert.strictEqual(response.statusCode, 200);
			const result = JSON.parse(response.payload);
			assert.strictEqual(result.dry_run, false);
			assert.strictEqual(result.created, 1);
			assert.strictEqual(mockDatabase.member_door_pins.length, 1);
			const row = storedPinRow(testUserIds.user);
			assert.ok(row && isEncryptedValue(row.pin));
			assert.strictEqual(row?.updated_by, testUserIds.admin);

			const check = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}/door-pin`,
				headers: authHeaders(testTokens.user),
			});
			assert.strictEqual(JSON.parse(check.payload).pin, "482913");
		});

		test("re-importing the same sheet changes nothing", async () => {
			await importSheet(sheet, false);
			const before = { ...storedPinRow(testUserIds.user) };

			const response = await importSheet(sheet, false);

			const result = JSON.parse(response.payload);
			assert.strictEqual(result.unchanged, 1);
			assert.strictEqual(result.created, 0);
			assert.deepStrictEqual(storedPinRow(testUserIds.user), before);
		});

		test("rejects a PIN another member keeps", async () => {
			storePin(testUserIds.admin, "482913");

			const response = await importSheet([sheet[0]], false);

			const result = JSON.parse(response.payload);
			assert.strictEqual(result.matched, 0);
			assert.strictEqual(result.rejected[0].reason, "pin_in_use");
			assert.strictEqual(storedPinRow(testUserIds.user), undefined);
		});

		test("is admin only", async () => {
			const response = await importSheet(sheet, false, testTokens.user);

			assert.strictEqual(response.statusCode, 403);
			assert.strictEqual(mockDatabase.member_door_pins.length, 0);
		});

		test("rejects a malformed request", async () => {
			const response = await importSheet([], true);

			assert.strictEqual(response.statusCode, 400);
		});
	});
});
