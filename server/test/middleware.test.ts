import "./setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

describe("Server Middleware", async () => {
	let app: FastifyInstance;

	before(async () => {
		// Set predictable CORS origin for tests
		process.env.CORS_ORIGIN = "http://localhost:5173";
		app = await buildApp();
	});

	after(async () => {
		await app.close();
	});

	test("Health check returns 200", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/health",
		});
		assert.strictEqual(response.statusCode, 200);
		const payload = JSON.parse(response.payload);
		assert.deepStrictEqual(payload, { status: "ok" });
	});

	test("Security headers are present (Helmet)", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/health",
		});

		const headers = response.headers;
		assert.ok(headers["content-security-policy"], "CSP header missing");
		assert.ok(headers["strict-transport-security"], "HSTS header missing");
		assert.strictEqual(headers["x-content-type-options"], "nosniff");
		assert.strictEqual(headers["x-frame-options"], "SAMEORIGIN");
	});

	test("Rate limiting headers are present", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/health",
		});

		const headers = response.headers;
		assert.ok(headers["x-ratelimit-limit"], "Rate limit header missing");
		assert.ok(
			headers["x-ratelimit-remaining"],
			"Rate limit remaining header missing",
		);
	});

	test("CORS allows configured origin", async () => {
		const allowedOrigin = "http://localhost:5173";
		const response = await app.inject({
			method: "OPTIONS",
			url: "/health",
			headers: {
				Origin: allowedOrigin,
				"Access-Control-Request-Method": "GET",
			},
		});

		const originHeader = response.headers["access-control-allow-origin"];

		// Should match exactly since we set the env var in before()
		assert.strictEqual(originHeader, allowedOrigin);
	});

	test("CORS rejects disallowed origin", async () => {
		const disallowedOrigin = "http://evil.com";
		const response = await app.inject({
			method: "OPTIONS",
			url: "/health",
			headers: {
				Origin: disallowedOrigin,
				"Access-Control-Request-Method": "GET",
			},
		});

		const originHeader = response.headers["access-control-allow-origin"];
		assert.notStrictEqual(originHeader, disallowedOrigin);
	});
});
