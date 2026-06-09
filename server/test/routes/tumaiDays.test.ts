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
import { mockDatabase } from "../mocks/supabase.js";

describe("TUM.ai Days Routes", async () => {
	let app: FastifyInstance;
	let originalCronSecret: string | undefined;

	before(async () => {
		originalCronSecret = process.env.CRON_SECRET;
		process.env.CRON_SECRET = "test-cron-secret-123";
		app = await getTestApp();
	});

	after(async () => {
		process.env.CRON_SECRET = originalCronSecret;
		await closeTestApp();
	});

	beforeEach(() => {
		resetDatabase();
	});

	test("requires authentication for all routes", async () => {
		const resGet = await app.inject({
			method: "GET",
			url: "/api/tum-ai-days",
		});
		assert.strictEqual(resGet.statusCode, 401);

		const resPost = await app.inject({
			method: "POST",
			url: "/api/tum-ai-days",
			body: { agenda: "Test", scheduledAt: new Date().toISOString() },
		});
		assert.strictEqual(resPost.statusCode, 401);
	});

	test("requires admin or community role for GET /api/tum-ai-days", async () => {
		// Non-admin / Non-community user gets 403
		const resUser = await app.inject({
			method: "GET",
			url: "/api/tum-ai-days",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(resUser.statusCode, 403);

		// Admin user gets 200
		const resAdmin = await app.inject({
			method: "GET",
			url: "/api/tum-ai-days",
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(resAdmin.statusCode, 200);
		const payload = JSON.parse(resAdmin.payload);
		assert.ok(Array.isArray(payload.events));
	});

	test("allows creating, updating, and deleting TUM.ai Days as Admin", async () => {
		const scheduledAt = new Date(Date.now() + 60000).toISOString();
		
		// 1. Create event
		const createRes = await app.inject({
			method: "POST",
			url: "/api/tum-ai-days",
			headers: authHeaders(testTokens.admin),
			body: {
				agenda: "TUM.ai Days Spring 2026",
				scheduledAt,
			},
		});
		assert.strictEqual(createRes.statusCode, 201);
		const event = JSON.parse(createRes.payload);
		assert.ok(event.id);
		assert.strictEqual(event.agenda, "TUM.ai Days Spring 2026");

		// 2. Update event
		const updateRes = await app.inject({
			method: "PUT",
			url: `/api/tum-ai-days/${event.id}`,
			headers: authHeaders(testTokens.admin),
			body: {
				agenda: "Updated Agenda",
			},
		});
		assert.strictEqual(updateRes.statusCode, 200);
		const updatedEvent = JSON.parse(updateRes.payload);
		assert.strictEqual(updatedEvent.agenda, "Updated Agenda");

		// 3. Get responses
		const responsesRes = await app.inject({
			method: "GET",
			url: `/api/tum-ai-days/${event.id}/responses`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(responsesRes.statusCode, 200);
		const responsesPayload = JSON.parse(responsesRes.payload);
		assert.strictEqual(responsesPayload.event.id, event.id);
		assert.ok(responsesPayload.stats);
		assert.ok(Array.isArray(responsesPayload.responses));

		// 4. Delete event
		const deleteRes = await app.inject({
			method: "DELETE",
			url: `/api/tum-ai-days/${event.id}`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(deleteRes.statusCode, 204);
	});

	test("allows checking scheduler for pending messages with admin token", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/tum-ai-days/send-pending",
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(res.statusCode, 200);
		const payload = JSON.parse(res.payload);
		assert.strictEqual(payload.status, "success");
		assert.strictEqual(typeof payload.sentCount, "number");
	});

	test("allows checking scheduler for pending messages with cron secret Bearer token", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/tum-ai-days/send-pending",
			headers: {
				authorization: "Bearer test-cron-secret-123",
			},
		});
		assert.strictEqual(res.statusCode, 200);
		const payload = JSON.parse(res.payload);
		assert.strictEqual(payload.status, "success");
		assert.strictEqual(typeof payload.sentCount, "number");
	});

	test("rejects checking scheduler for pending messages with invalid cron secret or missing auth", async () => {
		// Invalid cron secret
		const resInvalid = await app.inject({
			method: "POST",
			url: "/api/tum-ai-days/send-pending",
			headers: {
				authorization: "Bearer invalid-cron-secret",
			},
		});
		assert.strictEqual(resInvalid.statusCode, 401);

		// Missing token / no headers
		const resMissing = await app.inject({
			method: "POST",
			url: "/api/tum-ai-days/send-pending",
		});
		assert.strictEqual(resMissing.statusCode, 401);
	});
});
