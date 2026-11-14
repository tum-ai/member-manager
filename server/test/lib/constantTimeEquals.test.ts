import assert from "node:assert/strict";
import { test } from "node:test";
import {
	constantTimeEquals,
	hasBearerToken,
} from "../../src/lib/constantTimeEquals.js";

test("constantTimeEquals compares whole values", () => {
	assert.equal(constantTimeEquals("secret", "secret"), true);
	assert.equal(constantTimeEquals("secret", "secret2"), false);
	assert.equal(constantTimeEquals("", "secret"), false);
});

test("hasBearerToken needs the Bearer scheme and the exact token", () => {
	assert.equal(hasBearerToken("Bearer secret", "secret"), true);
	assert.equal(hasBearerToken("Bearer  secret ", "secret"), true);
	assert.equal(hasBearerToken("Basic secret", "secret"), false);
	assert.equal(hasBearerToken("Bearer ", "secret"), false);
	assert.equal(hasBearerToken(undefined, "secret"), false);
	assert.equal(hasBearerToken("Bearer other", "secret"), false);
});
