import "../setup.js";
import assert from "node:assert";
import { describe, test } from "node:test";
import { inspectBearerToken } from "../../src/lib/oauthClientTokens.js";

function jwtWith(payloadSegment: string): string {
	const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString(
		"base64url",
	);
	return `${header}.${payloadSegment}.c2lnbmF0dXJl`;
}

function jwt(payload: unknown): string {
	return jwtWith(Buffer.from(JSON.stringify(payload)).toString("base64url"));
}

describe("inspectBearerToken", () => {
	test("a session JWT without client_id passes", () => {
		assert.deepStrictEqual(
			inspectBearerToken(jwt({ sub: "user-1", role: "authenticated" })),
			{ kind: "session" },
		);
	});

	test("a JWT with client_id is an OAuth app token", () => {
		assert.deepStrictEqual(
			inspectBearerToken(jwt({ sub: "user-1", client_id: "client-1" })),
			{ kind: "oauth_client", clientId: "client-1" },
		);
	});

	test("an empty client_id still counts, like the RLS check", () => {
		assert.deepStrictEqual(inspectBearerToken(jwt({ client_id: "" })), {
			kind: "oauth_client",
			clientId: "",
		});
	});

	test("a null client_id is no client, like the RLS check", () => {
		assert.deepStrictEqual(inspectBearerToken(jwt({ client_id: null })), {
			kind: "session",
		});
	});

	test("a token without a dot is left to getUser", () => {
		assert.deepStrictEqual(inspectBearerToken("valid-user-token"), {
			kind: "session",
		});
	});

	test("JWT-like tokens that can't be read are malformed", () => {
		for (const token of [
			"a.b",
			"a.b.c.d",
			jwtWith("not base64!"),
			jwtWith(Buffer.from("not json").toString("base64url")),
			jwt(["client_id"]),
			jwt("client_id"),
			jwt(null),
			"..",
		]) {
			assert.deepStrictEqual(
				inspectBearerToken(token),
				{ kind: "malformed" },
				token,
			);
		}
	});
});
