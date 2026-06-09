import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
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

describe("Job Routes", async () => {
	let app: FastifyInstance;
	const originalFetch = globalThis.fetch;
	const originalJobsApiUrl = process.env.PARTNER_PORTAL_JOBS_API_URL;
	const originalJobsApiToken = process.env.PARTNER_PORTAL_JOBS_API_TOKEN;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		globalThis.fetch = originalFetch;
		if (originalJobsApiUrl === undefined) {
			delete process.env.PARTNER_PORTAL_JOBS_API_URL;
		} else {
			process.env.PARTNER_PORTAL_JOBS_API_URL = originalJobsApiUrl;
		}
		if (originalJobsApiToken === undefined) {
			delete process.env.PARTNER_PORTAL_JOBS_API_TOKEN;
		} else {
			process.env.PARTNER_PORTAL_JOBS_API_TOKEN = originalJobsApiToken;
		}
		await closeTestApp();
	});

	test("proxies approved partner jobs for active members", async () => {
		resetDatabase();
		process.env.PARTNER_PORTAL_JOBS_API_URL =
			"https://partnerportal.test/api/public/v1/jobs";
		process.env.PARTNER_PORTAL_JOBS_API_TOKEN = "test-mm-token";

		let requestedUrl = "";
		let authorizationHeader = "";
		globalThis.fetch = async (input, init) => {
			requestedUrl = String(input);
			authorizationHeader = String(
				new Headers(init?.headers).get("authorization") ?? "",
			);
			return new Response(
				JSON.stringify({
					data: [
						{
							id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
							title: "ML Engineer Intern",
							partner: {
								name: "Example Partner",
								logo_url: "https://cdn.example.com/logo.png",
							},
							logo_url: null,
							description_markdown: "Build useful models.",
							call_to_action: "Apply now",
							job_type: "internship",
							location: "Munich",
							contact: {
								name: "Dr. Example",
								email: "jobs@example.com",
								role: "Talent",
							},
							external_url: "https://example.com/careers/ml-intern",
							published_at: "2026-05-20T10:00:00.000Z",
							expires_at: null,
						},
					],
					next_cursor: null,
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		};

		const response = await app.inject({
			method: "GET",
			url: "/api/jobs?limit=25&job_type=internship",
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(authorizationHeader, "Bearer test-mm-token");
		assert.match(
			requestedUrl,
			/^https:\/\/partnerportal\.test\/api\/public\/v1\/jobs\?/,
		);
		assert.match(requestedUrl, /limit=25/);
		assert.match(requestedUrl, /job_type=internship/);
		assert.deepStrictEqual(JSON.parse(response.payload), {
			data: [
				{
					id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
					title: "ML Engineer Intern",
					partner: {
						name: "Example Partner",
						logo_url: "https://cdn.example.com/logo.png",
					},
					logo_url: null,
					description_markdown: "Build useful models.",
					call_to_action: "Apply now",
					job_type: "internship",
					location: "Munich",
					contact: {
						name: "Dr. Example",
						email: "jobs@example.com",
						role: "Talent",
					},
					external_url: "https://example.com/careers/ml-intern",
					published_at: "2026-05-20T10:00:00.000Z",
					expires_at: null,
				},
			],
			next_cursor: null,
		});
	});

	test("requires active membership", async () => {
		resetDatabase();
		process.env.PARTNER_PORTAL_JOBS_API_URL =
			"https://partnerportal.test/api/public/v1/jobs";
		process.env.PARTNER_PORTAL_JOBS_API_TOKEN = "test-mm-token";
		mockDatabase.members.push({
			user_id: testUserIds.otherUser,
			given_name: "Inactive",
			surname: "Member",
			active: false,
			member_status: "inactive",
		});

		const response = await app.inject({
			method: "GET",
			url: "/api/jobs",
			headers: authHeaders(testTokens.otherUser),
		});

		assert.strictEqual(response.statusCode, 403);
		assert.match(response.payload, /Only active members/);
	});

	test("requires authentication", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/api/jobs",
		});

		assert.strictEqual(response.statusCode, 401);
	});
});
