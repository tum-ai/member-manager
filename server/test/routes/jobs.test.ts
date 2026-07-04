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

describe("Job Routes", async () => {
	let app: FastifyInstance;
	const originalFetch = globalThis.fetch;
	const originalJobsApiUrl = process.env.PARTNER_PORTAL_JOBS_API_URL;
	const originalJobsApiToken = process.env.PARTNER_PORTAL_JOBS_API_TOKEN;

	before(async () => {
		app = await getTestApp();
	});

	beforeEach(() => {
		resetDatabase();
		globalThis.fetch = originalFetch;
		delete process.env.PARTNER_PORTAL_JOBS_API_URL;
		delete process.env.PARTNER_PORTAL_JOBS_API_TOKEN;
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

	test("serves approved member jobs when partner portal config is missing", async () => {
		mockDatabase.job_posting_requests.push({
			id: "member-job-1",
			user_id: testUserIds.user,
			status: "approved",
			title: "Founding ML Engineer",
			organization_name: "Member Startup",
			logo_url: null,
			description_markdown:
				"Build production AI systems with the founding team.",
			call_to_action: "Apply by email",
			job_type: "full_time",
			location: "Munich",
			contact_name: "Test User",
			contact_email: "founders@example.com",
			contact_role: "Founder",
			external_url: null,
			expires_at: null,
			published_at: "2026-06-11T10:00:00.000Z",
			created_at: "2026-06-10T10:00:00.000Z",
		});
		globalThis.fetch = async () => {
			assert.fail("Partner Portal should not be called without config");
		};

		const response = await app.inject({
			method: "GET",
			url: "/api/jobs",
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.deepStrictEqual(JSON.parse(response.payload), {
			data: [
				{
					id: "member-job-1",
					title: "Founding ML Engineer",
					partner: {
						name: "Member Startup",
						logo_url: null,
					},
					logo_url: null,
					description_markdown:
						"Build production AI systems with the founding team.",
					call_to_action: "Apply by email",
					job_type: "full_time",
					location: "Munich",
					contact: {
						name: "Test User",
						email: "founders@example.com",
						role: "Founder",
					},
					external_url: null,
					published_at: "2026-06-11T10:00:00.000Z",
					expires_at: null,
				},
			],
			next_cursor: null,
		});
	});

	test("lists pending Partner Portal jobs in the admin job request queue", async () => {
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
				JSON.stringify([
					{
						id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
						source: "partner_portal",
						user_id: "partner-user-1",
						status: "pending",
						title: "Partner AI Intern",
						organization_name: "Example Partner",
						logo_url: null,
						description_markdown: "Support partner AI deployments.",
						call_to_action: "Apply now",
						job_type: "internship",
						location: "Munich",
						contact_name: "Dr. Example",
						contact_email: "jobs@example.com",
						contact_role: "Talent",
						external_url: "https://example.com/jobs/ai-intern",
						expires_at: null,
						published_at: null,
						review_note: null,
						created_at: "2026-06-14T15:11:19.561Z",
					},
				]),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		};

		const response = await app.inject({
			method: "GET",
			url: "/api/admin/job-requests",
			headers: authHeaders(testTokens.admin),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(authorizationHeader, "Bearer test-mm-token");
		assert.match(
			requestedUrl,
			/^https:\/\/partnerportal\.test\/api\/internal\/member-manager\/job-requests$/,
		);
		const payload = JSON.parse(response.payload);
		assert.strictEqual(
			payload[0].id,
			"partner:8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
		);
		assert.strictEqual(payload[0].source, "partner_portal");
		assert.strictEqual(payload[0].status, "pending");
	});

	test("reviews Partner Portal job requests through the internal API", async () => {
		process.env.PARTNER_PORTAL_JOBS_API_URL =
			"https://partnerportal.test/api/public/v1/jobs";
		process.env.PARTNER_PORTAL_JOBS_API_TOKEN = "test-mm-token";

		let requestedUrl = "";
		let requestedMethod = "";
		let requestedBody = "";
		globalThis.fetch = async (input, init) => {
			requestedUrl = String(input);
			requestedMethod = String(init?.method ?? "GET");
			requestedBody = String(init?.body ?? "");
			assert.strictEqual(
				new Headers(init?.headers).get("authorization"),
				"Bearer test-mm-token",
			);
			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		};

		const response = await app.inject({
			method: "PATCH",
			url: "/api/admin/job-requests/partner:8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
			headers: authHeaders(testTokens.admin),
			payload: {
				decision: "approved",
			},
		});

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(requestedMethod, "PATCH");
		assert.match(
			requestedUrl,
			/^https:\/\/partnerportal\.test\/api\/internal\/member-manager\/job-requests\/8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10$/,
		);
		assert.deepStrictEqual(JSON.parse(requestedBody), {
			decision: "approved",
		});
	});

	test("removes Partner Portal job requests through the internal API", async () => {
		process.env.PARTNER_PORTAL_JOBS_API_URL =
			"https://partnerportal.test/api/public/v1/jobs";
		process.env.PARTNER_PORTAL_JOBS_API_TOKEN = "test-mm-token";

		let requestedUrl = "";
		let requestedMethod = "";
		globalThis.fetch = async (input, init) => {
			requestedUrl = String(input);
			requestedMethod = String(init?.method ?? "GET");
			assert.strictEqual(
				new Headers(init?.headers).get("authorization"),
				"Bearer test-mm-token",
			);
			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		};

		const response = await app.inject({
			method: "DELETE",
			url: "/api/admin/job-requests/partner:8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
			headers: authHeaders(testTokens.admin),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(requestedMethod, "DELETE");
		assert.match(
			requestedUrl,
			/^https:\/\/partnerportal\.test\/api\/internal\/member-manager\/job-requests\/8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10$/,
		);
	});

	test("applies public job filters and limits to approved member jobs", async () => {
		mockDatabase.job_posting_requests.push(
			{
				id: "member-job-internship-new",
				user_id: testUserIds.user,
				status: "approved",
				title: "New ML Intern",
				organization_name: "Member Startup",
				logo_url: null,
				description_markdown: "Build production AI systems with the team.",
				call_to_action: "Apply now",
				job_type: "internship",
				location: "Munich",
				contact_name: "Test User",
				contact_email: "founders@example.com",
				contact_role: null,
				external_url: null,
				expires_at: null,
				published_at: "2026-06-11T10:00:00.000Z",
				created_at: "2026-06-10T10:00:00.000Z",
			},
			{
				id: "member-job-internship-old",
				user_id: testUserIds.user,
				status: "approved",
				title: "Old ML Intern",
				organization_name: "Member Startup",
				logo_url: null,
				description_markdown: "Build production AI systems with the team.",
				call_to_action: "Apply now",
				job_type: "internship",
				location: "Munich",
				contact_name: "Test User",
				contact_email: "founders@example.com",
				contact_role: null,
				external_url: null,
				expires_at: null,
				published_at: "2026-06-01T10:00:00.000Z",
				created_at: "2026-06-01T10:00:00.000Z",
			},
			{
				id: "member-job-full-time",
				user_id: testUserIds.user,
				status: "approved",
				title: "Full-time Engineer",
				organization_name: "Member Startup",
				logo_url: null,
				description_markdown: "Build production AI systems with the team.",
				call_to_action: "Apply now",
				job_type: "full_time",
				location: "Munich",
				contact_name: "Test User",
				contact_email: "founders@example.com",
				contact_role: null,
				external_url: null,
				expires_at: null,
				published_at: "2026-06-12T10:00:00.000Z",
				created_at: "2026-06-12T10:00:00.000Z",
			},
		);

		const response = await app.inject({
			method: "GET",
			url: "/api/jobs?job_type=internship&since=2026-06-05T00%3A00%3A00.000Z&limit=1",
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		const jobs = JSON.parse(response.payload).data;
		assert.strictEqual(jobs.length, 1);
		assert.strictEqual(jobs[0].id, "member-job-internship-new");
	});

	test("paginates member jobs without advancing past partner jobs", async () => {
		process.env.PARTNER_PORTAL_JOBS_API_URL =
			"https://partnerportal.test/api/public/v1/jobs";
		process.env.PARTNER_PORTAL_JOBS_API_TOKEN = "test-mm-token";
		mockDatabase.job_posting_requests.push({
			id: "member-job-first",
			user_id: testUserIds.user,
			status: "approved",
			title: "Member Job",
			organization_name: "Member Startup",
			logo_url: null,
			description_markdown: "Build production AI systems with the team.",
			call_to_action: "Apply now",
			job_type: "internship",
			location: "Munich",
			contact_name: "Test User",
			contact_email: "founders@example.com",
			contact_role: null,
			external_url: null,
			expires_at: null,
			published_at: "2026-06-12T10:00:00.000Z",
			created_at: "2026-06-12T10:00:00.000Z",
		});
		let fetchCount = 0;
		let requestedUrl = "";
		globalThis.fetch = async (input) => {
			fetchCount += 1;
			requestedUrl = String(input);
			return new Response(
				JSON.stringify({
					data: [
						{
							id: "partner-job-after-member",
							title: "Partner ML Intern",
							partner: {
								name: "Example Partner",
								logo_url: null,
							},
							logo_url: null,
							description_markdown: "Build useful partner models.",
							call_to_action: "Apply now",
							job_type: "internship",
							location: "Munich",
							contact: {
								name: "Dr. Example",
								email: "jobs@example.com",
								role: "Talent",
							},
							external_url: "https://example.com/jobs/ml",
							published_at: "2026-06-11T10:00:00.000Z",
							expires_at: null,
						},
					],
					next_cursor: null,
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		};

		const firstPage = await app.inject({
			method: "GET",
			url: "/api/jobs?limit=1",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(firstPage.statusCode, 200);
		const firstPayload = JSON.parse(firstPage.payload);
		assert.strictEqual(firstPayload.data.length, 1);
		assert.strictEqual(firstPayload.data[0].id, "member-job-first");
		assert.strictEqual(fetchCount, 1);
		assert.match(firstPayload.next_cursor, /^mm:1:0:0:/);

		const secondPage = await app.inject({
			method: "GET",
			url: `/api/jobs?limit=1&cursor=${encodeURIComponent(
				firstPayload.next_cursor,
			)}`,
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(secondPage.statusCode, 200);
		const secondPayload = JSON.parse(secondPage.payload);
		assert.strictEqual(secondPayload.data.length, 1);
		assert.strictEqual(secondPayload.data[0].id, "partner-job-after-member");
		assert.match(requestedUrl, /limit=1/);
		assert.doesNotMatch(requestedUrl, /cursor=/);
	});

	test("keeps newer partner jobs ahead of member jobs on limited pages", async () => {
		process.env.PARTNER_PORTAL_JOBS_API_URL =
			"https://partnerportal.test/api/public/v1/jobs";
		process.env.PARTNER_PORTAL_JOBS_API_TOKEN = "test-mm-token";
		mockDatabase.job_posting_requests.push({
			id: "member-job-older",
			user_id: testUserIds.user,
			status: "approved",
			title: "Older Member Job",
			organization_name: "Member Startup",
			logo_url: null,
			description_markdown: "Build production AI systems with the team.",
			call_to_action: "Apply now",
			job_type: "internship",
			location: "Munich",
			contact_name: "Test User",
			contact_email: "founders@example.com",
			contact_role: null,
			external_url: null,
			expires_at: null,
			published_at: "2026-06-11T10:00:00.000Z",
			created_at: "2026-06-11T10:00:00.000Z",
		});
		globalThis.fetch = async () =>
			new Response(
				JSON.stringify({
					data: [
						{
							id: "partner-job-newer",
							title: "Newer Partner Job",
							partner: {
								name: "Example Partner",
								logo_url: null,
							},
							logo_url: null,
							description_markdown: "Build useful partner models.",
							call_to_action: "Apply now",
							job_type: "internship",
							location: "Munich",
							contact: {
								name: "Dr. Example",
								email: "jobs@example.com",
								role: "Talent",
							},
							external_url: "https://example.com/jobs/ml",
							published_at: "2026-06-12T10:00:00.000Z",
							expires_at: null,
						},
					],
					next_cursor: null,
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);

		const response = await app.inject({
			method: "GET",
			url: "/api/jobs?limit=1",
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		const payload = JSON.parse(response.payload);
		assert.strictEqual(payload.data.length, 1);
		assert.strictEqual(payload.data[0].id, "partner-job-newer");
		assert.match(payload.next_cursor, /^mm:0:0:1:/);
	});

	test("does not repeat exhausted partner jobs while member jobs remain", async () => {
		process.env.PARTNER_PORTAL_JOBS_API_URL =
			"https://partnerportal.test/api/public/v1/jobs";
		process.env.PARTNER_PORTAL_JOBS_API_TOKEN = "test-mm-token";
		mockDatabase.job_posting_requests.push({
			id: "member-job-older",
			user_id: testUserIds.user,
			status: "approved",
			title: "Older Member Job",
			organization_name: "Member Startup",
			logo_url: null,
			description_markdown: "Build production AI systems with the team.",
			call_to_action: "Apply now",
			job_type: "internship",
			location: "Munich",
			contact_name: "Test User",
			contact_email: "founders@example.com",
			contact_role: null,
			external_url: null,
			expires_at: null,
			published_at: "2026-06-11T10:00:00.000Z",
			created_at: "2026-06-11T10:00:00.000Z",
		});
		let fetchCount = 0;
		globalThis.fetch = async () => {
			fetchCount += 1;
			return new Response(
				JSON.stringify({
					data: [
						{
							id: "partner-job-newer",
							title: "Newer Partner Job",
							partner: {
								name: "Example Partner",
								logo_url: null,
							},
							logo_url: null,
							description_markdown: "Build useful partner models.",
							call_to_action: "Apply now",
							job_type: "internship",
							location: "Munich",
							contact: {
								name: "Dr. Example",
								email: "jobs@example.com",
								role: "Talent",
							},
							external_url: "https://example.com/jobs/ml",
							published_at: "2026-06-12T10:00:00.000Z",
							expires_at: null,
						},
					],
					next_cursor: null,
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		};

		const firstPage = await app.inject({
			method: "GET",
			url: "/api/jobs?limit=1",
			headers: authHeaders(testTokens.user),
		});
		const firstPayload = JSON.parse(firstPage.payload);
		assert.strictEqual(firstPayload.data[0].id, "partner-job-newer");
		assert.match(firstPayload.next_cursor, /^mm:0:0:1:/);

		const secondPage = await app.inject({
			method: "GET",
			url: `/api/jobs?limit=1&cursor=${encodeURIComponent(
				firstPayload.next_cursor,
			)}`,
			headers: authHeaders(testTokens.user),
		});
		const secondPayload = JSON.parse(secondPage.payload);
		assert.strictEqual(secondPayload.data[0].id, "member-job-older");
		assert.strictEqual(secondPayload.next_cursor, null);
		assert.strictEqual(fetchCount, 1);
	});

	test("ignores malformed member-manager job cursors", async () => {
		process.env.PARTNER_PORTAL_JOBS_API_URL =
			"https://partnerportal.test/api/public/v1/jobs";
		process.env.PARTNER_PORTAL_JOBS_API_TOKEN = "test-mm-token";
		globalThis.fetch = async () =>
			new Response(JSON.stringify({ data: [], next_cursor: null }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});

		const response = await app.inject({
			method: "GET",
			url: "/api/jobs?cursor=mm%3A0%3A0%3A%25E0%25A4%25A",
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
	});

	test("keeps the job board available before the member jobs table exists", async () => {
		process.env.PARTNER_PORTAL_JOBS_API_URL =
			"https://partnerportal.test/api/public/v1/jobs";
		process.env.PARTNER_PORTAL_JOBS_API_TOKEN = "test-mm-token";
		mockSupabaseErrors.tables.job_posting_requests = {
			code: "PGRST205",
			message: "Could not find the table 'public.job_posting_requests'",
		};
		globalThis.fetch = async (input) => {
			if (String(input).includes("/api/internal/member-manager/job-requests")) {
				return new Response(JSON.stringify([]), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}

			return new Response(
				JSON.stringify({
					data: [
						{
							id: "partner-job-1",
							title: "Partner ML Intern",
							partner: {
								name: "Example Partner",
								logo_url: null,
							},
							logo_url: null,
							description_markdown: "Build useful partner models.",
							call_to_action: "Apply now",
							job_type: "internship",
							location: "Munich",
							contact: {
								name: "Dr. Example",
								email: "jobs@example.com",
								role: "Talent",
							},
							external_url: "https://example.com/jobs/ml",
							published_at: "2026-05-20T10:00:00.000Z",
							expires_at: null,
						},
					],
					next_cursor: null,
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		};

		const jobsResponse = await app.inject({
			method: "GET",
			url: "/api/jobs",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(jobsResponse.statusCode, 200);
		assert.strictEqual(JSON.parse(jobsResponse.payload).data.length, 1);

		const requestsResponse = await app.inject({
			method: "GET",
			url: "/api/jobs/requests",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(requestsResponse.statusCode, 200);
		assert.deepStrictEqual(JSON.parse(requestsResponse.payload), []);

		const adminResponse = await app.inject({
			method: "GET",
			url: "/api/admin/job-requests",
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(adminResponse.statusCode, 200);
		assert.deepStrictEqual(JSON.parse(adminResponse.payload), []);

		const createResponse = await app.inject({
			method: "POST",
			url: "/api/jobs/requests",
			headers: authHeaders(testTokens.user),
			payload: {
				title: "Robotics Working Student",
				organization_name: "Applied Robotics Lab",
				description_markdown:
					"Support model evaluation and deployment for robotics workloads.",
				job_type: "working_student",
				location: "Garching",
				contact_name: "Test User",
				contact_email: "jobs@robotics.example",
			},
		});
		assert.strictEqual(createResponse.statusCode, 503);
		assert.match(createResponse.payload, /not available yet/);
	});

	test("does not hide non-rollout job request database errors", async () => {
		mockSupabaseErrors.tables.job_posting_requests = {
			code: "42501",
			message: 'permission denied for table "public"."job_posting_requests"',
		};

		const response = await app.inject({
			method: "GET",
			url: "/api/jobs/requests",
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 500);
	});

	test("lets active members submit job requests for admin approval", async () => {
		const createResponse = await app.inject({
			method: "POST",
			url: "/api/jobs/requests",
			headers: authHeaders(testTokens.user),
			payload: {
				title: "Robotics Working Student",
				organization_name: "Applied Robotics Lab",
				description_markdown:
					"Support model evaluation and deployment for robotics workloads.",
				call_to_action: "",
				job_type: "working_student",
				location: "Garching",
				contact_name: "Test User",
				contact_email: "jobs@robotics.example",
				contact_role: "Hiring lead",
				external_url: "https://robotics.example/jobs/ws",
				expires_at: "2099-07-01",
			},
		});

		assert.strictEqual(createResponse.statusCode, 201);
		const created = JSON.parse(createResponse.payload);
		assert.strictEqual(created.status, "pending");
		assert.strictEqual(created.user_id, testUserIds.user);
		assert.strictEqual(created.call_to_action, "Apply now");
		assert.strictEqual(created.expires_at, "2099-07-01T23:59:59.000Z");

		const publicBeforeApproval = await app.inject({
			method: "GET",
			url: "/api/jobs",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(publicBeforeApproval.statusCode, 200);
		assert.deepStrictEqual(JSON.parse(publicBeforeApproval.payload).data, []);

		const ownRequests = await app.inject({
			method: "GET",
			url: "/api/jobs/requests",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(ownRequests.statusCode, 200);
		assert.strictEqual(JSON.parse(ownRequests.payload)[0].id, created.id);

		const adminRequests = await app.inject({
			method: "GET",
			url: "/api/admin/job-requests",
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(adminRequests.statusCode, 200);
		assert.strictEqual(JSON.parse(adminRequests.payload)[0].id, created.id);

		const approvalResponse = await app.inject({
			method: "PATCH",
			url: `/api/admin/job-requests/${created.id}`,
			headers: authHeaders(testTokens.admin),
			payload: {
				decision: "approved",
			},
		});
		assert.strictEqual(approvalResponse.statusCode, 200);
		assert.strictEqual(JSON.parse(approvalResponse.payload).status, "approved");
		assert.ok(JSON.parse(approvalResponse.payload).published_at);

		const publicAfterApproval = await app.inject({
			method: "GET",
			url: "/api/jobs",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(publicAfterApproval.statusCode, 200);
		const publicJobs = JSON.parse(publicAfterApproval.payload).data;
		assert.strictEqual(publicJobs.length, 1);
		assert.strictEqual(publicJobs[0].title, "Robotics Working Student");
	});

	test("requires admin access to review job requests", async () => {
		mockDatabase.job_posting_requests.push({
			id: "member-job-pending",
			user_id: testUserIds.user,
			status: "pending",
			title: "AI Product Intern",
			organization_name: "Example Lab",
			logo_url: null,
			description_markdown: "Support product research for AI tooling.",
			call_to_action: "Apply now",
			job_type: "internship",
			location: "Remote",
			contact_name: "Test User",
			contact_email: "jobs@example.com",
			contact_role: null,
			external_url: null,
			expires_at: null,
			published_at: null,
			created_at: "2026-06-10T10:00:00.000Z",
		});

		const response = await app.inject({
			method: "PATCH",
			url: "/api/admin/job-requests/member-job-pending",
			headers: authHeaders(testTokens.user),
			payload: {
				decision: "approved",
			},
		});

		assert.strictEqual(response.statusCode, 403);
	});

	test("lets admins remove member job requests", async () => {
		mockDatabase.job_posting_requests.push({
			id: "member-job-pending",
			user_id: testUserIds.user,
			status: "pending",
			title: "AI Product Intern",
			organization_name: "Example Lab",
			logo_url: null,
			description_markdown: "Support product research for AI tooling.",
			call_to_action: "Apply now",
			job_type: "internship",
			location: "Remote",
			contact_name: "Test User",
			contact_email: "jobs@example.com",
			contact_role: null,
			external_url: null,
			expires_at: null,
			published_at: null,
			created_at: "2026-06-10T10:00:00.000Z",
		});

		const response = await app.inject({
			method: "DELETE",
			url: "/api/admin/job-requests/member-job-pending",
			headers: authHeaders(testTokens.admin),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.deepStrictEqual(JSON.parse(response.payload), { ok: true });
		assert.strictEqual(mockDatabase.job_posting_requests.length, 0);
	});

	test("rejects non-http submitted job URLs", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/api/jobs/requests",
			headers: authHeaders(testTokens.user),
			payload: {
				title: "Suspicious Intern",
				organization_name: "Example Lab",
				description_markdown:
					"Support model evaluation and deployment for AI workloads.",
				job_type: "internship",
				location: "Remote",
				contact_name: "Test User",
				contact_email: "jobs@example.com",
				external_url: "javascript:alert(1)",
			},
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(response.payload, /valid HTTP or HTTPS URL/);
	});

	test("does not review an already reviewed job request", async () => {
		mockDatabase.job_posting_requests.push({
			id: "member-job-approved",
			user_id: testUserIds.user,
			status: "approved",
			title: "AI Product Intern",
			organization_name: "Example Lab",
			logo_url: null,
			description_markdown: "Support product research for AI tooling.",
			call_to_action: "Apply now",
			job_type: "internship",
			location: "Remote",
			contact_name: "Test User",
			contact_email: "jobs@example.com",
			contact_role: null,
			external_url: null,
			expires_at: null,
			published_at: "2026-06-10T10:00:00.000Z",
			reviewed_by: testUserIds.admin,
			reviewed_at: "2026-06-10T10:00:00.000Z",
			created_at: "2026-06-10T10:00:00.000Z",
		});

		const response = await app.inject({
			method: "PATCH",
			url: "/api/admin/job-requests/member-job-approved",
			headers: authHeaders(testTokens.admin),
			payload: {
				decision: "rejected",
			},
		});

		assert.strictEqual(response.statusCode, 409);
		assert.match(response.payload, /already reviewed/);
	});

	test("requires active membership", async () => {
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
