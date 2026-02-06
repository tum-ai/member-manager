import "../setup.js";
import assert from "node:assert";
import { describe, test } from "node:test";
import { checkAdminRole, ensureOwnerOrAdmin } from "../../src/lib/auth.js";
import { ForbiddenError } from "../../src/lib/errors.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";
import {
	createMockSupabaseClient,
	MOCK_ADMIN_ID,
	MOCK_OTHER_USER_ID,
	MOCK_USER_ID,
	resetMockDatabase,
} from "../mocks/supabase.js";

describe("Auth Helpers", () => {
	setSupabaseClient(createMockSupabaseClient());

	test("checkAdminRole returns true for admin user", async () => {
		resetMockDatabase();
		const isAdmin = await checkAdminRole(MOCK_ADMIN_ID);
		assert.strictEqual(isAdmin, true);
	});

	test("checkAdminRole returns false for regular user", async () => {
		resetMockDatabase();
		const isAdmin = await checkAdminRole(MOCK_USER_ID);
		assert.strictEqual(isAdmin, false);
	});

	test("checkAdminRole returns false when no role exists", async () => {
		resetMockDatabase();
		const isAdmin = await checkAdminRole("non-existent-user");
		assert.strictEqual(isAdmin, false);
	});

	test("ensureOwnerOrAdmin allows owner to access own resource", async () => {
		resetMockDatabase();
		await assert.doesNotReject(
			async () => await ensureOwnerOrAdmin(MOCK_USER_ID, MOCK_USER_ID),
		);
	});

	test("ensureOwnerOrAdmin allows admin to access other user's resource", async () => {
		resetMockDatabase();
		await assert.doesNotReject(
			async () => await ensureOwnerOrAdmin(MOCK_ADMIN_ID, MOCK_USER_ID),
		);
	});

	test("ensureOwnerOrAdmin throws ForbiddenError for non-admin accessing other user", async () => {
		resetMockDatabase();
		await assert.rejects(
			async () => await ensureOwnerOrAdmin(MOCK_USER_ID, MOCK_OTHER_USER_ID),
			(error: Error) => {
				assert.ok(error instanceof ForbiddenError);
				assert.strictEqual(error.message, "Access denied");
				return true;
			},
		);
	});

	test("ensureOwnerOrAdmin throws ForbiddenError with custom message", async () => {
		resetMockDatabase();
		await assert.rejects(
			async () =>
				await ensureOwnerOrAdmin(
					MOCK_USER_ID,
					MOCK_OTHER_USER_ID,
					"Custom error message",
				),
			(error: Error) => {
				assert.ok(error instanceof ForbiddenError);
				assert.strictEqual(error.message, "Custom error message");
				return true;
			},
		);
	});
});
