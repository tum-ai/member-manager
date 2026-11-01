import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import { SLACK_WORKSPACE_NOT_ALLOWED_ERROR } from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockSlackIdentity, mockUsers } from "../mocks/supabase.js";

const FOREIGN_TOKEN = "foreign-workspace-token";
const EMAIL_ONLY_TOKEN = "email-only-token";

// These users reuse the regular user's id, so the member row exists and the
// route would answer 200 if the workspace gate let them through.
describe("Slack workspace gate", async () => {
	let app: FastifyInstance;

	before(async () => {
		const base = mockUsers[testTokens.user];
		mockUsers[FOREIGN_TOKEN] = {
			...base,
			identities: [mockSlackIdentity(testUserIds.user, "T999FOREIGN")],
		};
		mockUsers[EMAIL_ONLY_TOKEN] = { ...base, identities: [] };
		app = await getTestApp();
	});

	after(async () => {
		delete mockUsers[FOREIGN_TOKEN];
		delete mockUsers[EMAIL_ONLY_TOKEN];
		await closeTestApp();
	});

	test("a TUM.ai workspace user is accepted", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "GET",
			url: `/api/members/${testUserIds.user}`,
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(response.statusCode, 200);
	});

	test("a user from another Slack workspace gets 401", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "GET",
			url: `/api/members/${testUserIds.user}`,
			headers: authHeaders(FOREIGN_TOKEN),
		});
		assert.strictEqual(response.statusCode, 401);
		assert.deepStrictEqual(JSON.parse(response.payload), {
			error: SLACK_WORKSPACE_NOT_ALLOWED_ERROR,
		});
	});

	test("a user without a Slack identity gets 401 outside a local stack", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "GET",
			url: `/api/members/${testUserIds.user}`,
			headers: authHeaders(EMAIL_ONLY_TOKEN),
		});
		assert.strictEqual(response.statusCode, 401);
	});
});
