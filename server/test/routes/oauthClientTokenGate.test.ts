import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { OAUTH_CLIENT_TOKEN_ERROR } from "../../src/lib/oauthClientTokens.js";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockUsers } from "../mocks/supabase.js";

function unsignedJwt(payload: Record<string, unknown>): string {
	const encode = (value: object) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.c2lnbmF0dXJl`;
}

const SESSION_JWT = unsignedJwt({
	sub: testUserIds.user,
	role: "authenticated",
	session_id: "session-1",
});
const OAUTH_APP_JWT = unsignedJwt({
	sub: testUserIds.user,
	role: "authenticated",
	session_id: "session-2",
	client_id: "9f2c4a1e-mcp-client",
});
const MALFORMED_JWT = "not.a-jwt.payload!";

// All three tokens belong to the regular user and the mock `getUser` accepts
// them, as Supabase accepts OAuth app tokens. Only the claims differ, so a
// 401 comes from `authenticate`'s claim check.
describe("OAuth app token gate", async () => {
	let app: FastifyInstance;

	before(async () => {
		const base = mockUsers[testTokens.user];
		mockUsers[SESSION_JWT] = base;
		mockUsers[OAUTH_APP_JWT] = base;
		mockUsers[MALFORMED_JWT] = base;
		app = await getTestApp();
	});

	after(async () => {
		delete mockUsers[SESSION_JWT];
		delete mockUsers[OAUTH_APP_JWT];
		delete mockUsers[MALFORMED_JWT];
		await closeTestApp();
	});

	test("a browser session JWT is accepted", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "GET",
			url: `/api/members/${testUserIds.user}`,
			headers: authHeaders(SESSION_JWT),
		});
		assert.strictEqual(response.statusCode, 200);
	});

	test("a token issued to an OAuth app gets 401", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "GET",
			url: `/api/members/${testUserIds.user}`,
			headers: authHeaders(OAUTH_APP_JWT),
		});
		assert.strictEqual(response.statusCode, 401);
		assert.deepStrictEqual(JSON.parse(response.payload), {
			error: OAUTH_CLIENT_TOKEN_ERROR,
		});
	});

	test("a token that looks like a JWT but can't be read gets 401", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "GET",
			url: `/api/members/${testUserIds.user}`,
			headers: authHeaders(MALFORMED_JWT),
		});
		assert.strictEqual(response.statusCode, 401);
		assert.deepStrictEqual(JSON.parse(response.payload), {
			error: "Invalid token",
		});
	});

	test("the cron-or-manager route rejects an OAuth app token too", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "POST",
			url: "/api/tum-ai-days/send-pending",
			headers: authHeaders(OAUTH_APP_JWT),
		});
		assert.strictEqual(response.statusCode, 401);
		assert.deepStrictEqual(JSON.parse(response.payload), {
			error: OAUTH_CLIENT_TOKEN_ERROR,
		});
	});
});
