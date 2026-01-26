import assert from "node:assert";
import { describe, test, before, after } from "node:test";
import { buildApp } from "../src/app.js";
import dotenv from "dotenv";

dotenv.config();

describe("Server Middleware", async () => {
	let app: any;

	before(async () => {
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
		assert.ok(headers["x-ratelimit-remaining"], "Rate limit remaining header missing");
	});

	test("CORS allows configured origin", async () => {
		// Simulate a request from an allowed origin
		const allowedOrigin = "http://localhost:5173";
		const response = await app.inject({
			method: "OPTIONS",
			url: "/health",
			headers: {
				"Origin": allowedOrigin,
				"Access-Control-Request-Method": "GET"
			}
		});

		// Fastify CORS usually responds with 204 or 200 for OPTIONS
		// and sets the Access-Control-Allow-Origin header
		const originHeader = response.headers["access-control-allow-origin"];
		
		// If the env var is set, it might return that specific origin or * or reflect the request
		// Based on our config: origin: allowedOrigins (which is split from env)
		// If strict, it should match.
		if (process.env.CORS_ORIGIN?.includes(allowedOrigin)) {
			assert.strictEqual(originHeader, allowedOrigin);
		}
	});

	test("CORS rejects disallowed origin", async () => {
		const disallowedOrigin = "http://evil.com";
		const response = await app.inject({
			method: "OPTIONS",
			url: "/health",
			headers: {
				"Origin": disallowedOrigin,
				"Access-Control-Request-Method": "GET"
			}
		});

		// Should NOT have the Access-Control-Allow-Origin header matching the evil domain
		const originHeader = response.headers["access-control-allow-origin"];
		assert.notStrictEqual(originHeader, disallowedOrigin);
	});
});
