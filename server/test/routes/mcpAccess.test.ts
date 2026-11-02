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
	testUserIds,
} from "../helpers.js";
import { mockDatabase, mockSupabaseErrors } from "../mocks/supabase.js";

function storeAccess(overrides: Record<string, unknown> = {}): void {
	mockDatabase.mcp_access.push({
		user_id: testUserIds.user,
		status: "pending",
		role: null,
		requested_at: "2026-11-02T10:00:00Z",
		decided_at: null,
		decided_by: null,
		decision_note: null,
		last_seen_at: "2026-11-02T10:00:00Z",
		last_client_id: "client-1",
		last_client_name: "Claude Code",
		...overrides,
	});
}

const storedRow = (userId = testUserIds.user) =>
	mockDatabase.mcp_access.find((row) => row.user_id === userId);

describe("nomcp access routes", () => {
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

	const list = (token?: string) =>
		app.inject({
			method: "GET",
			url: "/api/admin/mcp-access",
			headers: token ? authHeaders(token) : {},
		});

	const decide = (body: unknown, token = testTokens.admin) =>
		app.inject({
			method: "PATCH",
			url: `/api/admin/mcp-access/${testUserIds.user}`,
			headers: authHeaders(token),
			payload: body as Record<string, unknown>,
		});

	describe("GET /api/admin/mcp-access", () => {
		test("lists requests with the member and the deciding admin", async () => {
			storeAccess({
				status: "approved",
				role: "reader",
				decided_at: "2026-11-02T11:00:00Z",
				decided_by: testUserIds.admin,
			});

			const response = await list(testTokens.admin);

			assert.strictEqual(response.statusCode, 200);
			assert.deepStrictEqual(JSON.parse(response.payload), [
				{
					user_id: testUserIds.user,
					name: "Test User",
					department: "Software Development",
					member_status: "active",
					status: "approved",
					role: "reader",
					requested_at: "2026-11-02T10:00:00Z",
					decided_at: "2026-11-02T11:00:00Z",
					decided_by: testUserIds.admin,
					decided_by_name: "Admin User",
					decision_note: null,
					last_seen_at: "2026-11-02T10:00:00Z",
					last_client_id: "client-1",
					last_client_name: "Claude Code",
				},
			]);
		});

		test("names a request whose member row is gone", async () => {
			storeAccess({ user_id: "gone-user" });

			const [entry] = JSON.parse((await list(testTokens.admin)).payload);

			assert.strictEqual(entry.name, "Unknown member");
			assert.strictEqual(entry.department, null);
		});

		test("is for admins only", async () => {
			assert.strictEqual((await list()).statusCode, 401);
			assert.strictEqual((await list(testTokens.user)).statusCode, 403);
		});

		test("reports a database failure", async () => {
			mockSupabaseErrors.tables.mcp_access = { message: "boom" };
			try {
				assert.strictEqual((await list(testTokens.admin)).statusCode, 500);
			} finally {
				delete mockSupabaseErrors.tables.mcp_access;
			}
		});
	});

	describe("PATCH /api/admin/mcp-access/:userId", () => {
		test("approves a pending request with a role", async () => {
			storeAccess();

			const response = await decide({ action: "approve", role: "editor" });

			assert.strictEqual(response.statusCode, 200);
			const entry = JSON.parse(response.payload);
			assert.strictEqual(entry.status, "approved");
			assert.strictEqual(entry.role, "editor");
			assert.strictEqual(entry.decided_by, testUserIds.admin);
			assert.strictEqual(entry.decided_by_name, "Admin User");
			assert.ok(entry.decided_at);
			assert.strictEqual(storedRow()?.status, "approved");
		});

		test("changes an approved member's role", async () => {
			storeAccess({ status: "approved", role: "editor" });

			const response = await decide({ action: "set_role", role: "reader" });

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(storedRow()?.role, "reader");
		});

		test("denies a pending request with a note", async () => {
			storeAccess();

			const response = await decide({ action: "deny", note: " Not yet " });

			assert.strictEqual(response.statusCode, 200);
			assert.deepStrictEqual(
				{
					status: storedRow()?.status,
					role: storedRow()?.role,
					note: storedRow()?.decision_note,
				},
				{ status: "denied", role: null, note: "Not yet" },
			);
		});

		test("revokes an approved member, and approves them again later", async () => {
			storeAccess({ status: "approved", role: "editor" });

			const revoked = await decide({ action: "revoke" });
			assert.strictEqual(revoked.statusCode, 200);
			assert.strictEqual(storedRow()?.status, "denied");
			assert.strictEqual(storedRow()?.role, null);

			const approved = await decide({ action: "approve", role: "reader" });
			assert.strictEqual(approved.statusCode, 200);
			assert.strictEqual(storedRow()?.status, "approved");
			assert.strictEqual(storedRow()?.role, "reader");
			assert.strictEqual(storedRow()?.decision_note, null);
		});

		test("refuses a decision that doesn't fit the current status", async () => {
			for (const [status, body] of [
				["approved", { action: "approve", role: "editor" }],
				["approved", { action: "deny" }],
				["pending", { action: "revoke" }],
				["pending", { action: "set_role", role: "reader" }],
				["denied", { action: "deny" }],
			] as const) {
				resetDatabase();
				storeAccess({
					status,
					role: status === "approved" ? "editor" : null,
				});
				const response = await decide(body);
				assert.strictEqual(
					response.statusCode,
					409,
					`${status} ${body.action}`,
				);
				assert.strictEqual(storedRow()?.status, status);
			}
		});

		test("rejects an invalid decision", async () => {
			storeAccess();

			for (const body of [
				{ action: "approve" },
				{ action: "approve", role: "admin" },
				{ action: "delete" },
				{ action: "deny", note: "x".repeat(501) },
			]) {
				assert.strictEqual((await decide(body)).statusCode, 400);
			}
			assert.strictEqual(storedRow()?.status, "pending");
		});

		test("404s for a member without a request", async () => {
			const response = await decide({ action: "approve", role: "reader" });
			assert.strictEqual(response.statusCode, 404);
		});

		test("is for admins only", async () => {
			storeAccess();

			const response = await decide(
				{ action: "approve", role: "editor" },
				testTokens.user,
			);

			assert.strictEqual(response.statusCode, 403);
			assert.strictEqual(storedRow()?.status, "pending");
		});
	});

	describe("GET /api/mcp-access/me", () => {
		const me = (token: string) =>
			app.inject({
				method: "GET",
				url: "/api/mcp-access/me",
				headers: authHeaders(token),
			});

		test("says when the member hasn't asked yet", async () => {
			const response = await me(testTokens.user);

			assert.strictEqual(response.statusCode, 200);
			assert.deepStrictEqual(JSON.parse(response.payload), {
				status: "none",
				role: null,
			});
		});

		test("returns the member's own status and role, nothing else", async () => {
			storeAccess({
				status: "approved",
				role: "editor",
				decision_note: "admin only",
			});
			storeAccess({ user_id: testUserIds.admin, status: "denied" });

			assert.deepStrictEqual(JSON.parse((await me(testTokens.user)).payload), {
				status: "approved",
				role: "editor",
			});
			assert.deepStrictEqual(JSON.parse((await me(testTokens.admin)).payload), {
				status: "denied",
				role: null,
			});
		});

		test("needs a session", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/mcp-access/me",
			});
			assert.strictEqual(response.statusCode, 401);
		});
	});
});
