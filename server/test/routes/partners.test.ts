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
} from "../helpers.js";
import { MOCK_USER_ID, mockDatabase } from "../mocks/supabase.js";

const partnerId = "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10";
const tierId = "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c11";
const bronzeTierId = "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c13";
const jobId = "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c12";
const originalFetch = globalThis.fetch;

const partnerJobInput = {
	title: "AI Engineer",
	jobType: "full_time",
	location: "Munich",
	description:
		"Build reliable production AI systems with our engineering team.",
	callToAction: "Apply now",
	contactName: "Taylor Example",
	contactEmail: "jobs@example.com",
	contactRole: "Talent",
	externalUrl: "https://example.com/jobs",
	logoUrl: "",
};

function partnerJobPayload() {
	return {
		id: jobId,
		partnerId,
		...partnerJobInput,
		logoUrl: null,
		status: "approved",
		submittedAt: "2026-07-16T17:00:00+00:00",
		publishedAt: "2026-07-16T17:00:00+00:00",
		expiresAt: null,
		createdAt: "2026-07-16T17:00:00+00:00",
		updatedAt: "2026-07-16T17:00:00+00:00",
	};
}

function partnerManagementPayload() {
	return {
		data: {
			partners: [
				{
					id: partnerId,
					companyName: "Example Partner",
					primaryEmail: "partner@example.com",
					status: "active",
					partnerKind: "tier_subscriber",
					tierId,
					tier: {
						id: tierId,
						slug: "gold",
						displayName: "Gold",
						hasCvAccess: true,
						jobQuota: 4,
						eventQuota: {},
					},
					contractStart: "2026-01-01",
					contractEnd: "2026-12-31",
					websiteUrl: "https://example.com",
					notes: null,
					invitedAt: "2026-01-01T00:00:00+00:00",
					acceptedAt: "2026-01-02T00:00:00+00:00",
					createdAt: "2026-01-01T00:00:00+00:00",
					updatedAt: "2026-01-02T00:00:00+00:00",
				},
			],
			tiers: [
				{
					id: bronzeTierId,
					slug: "bronze",
					displayName: "Bronze",
					hasCvAccess: false,
					jobQuota: 1,
					eventQuota: {},
					displayOrder: 1,
				},
				{
					id: tierId,
					slug: "gold",
					displayName: "Gold",
					hasCvAccess: true,
					jobQuota: 4,
					eventQuota: {},
					displayOrder: 3,
				},
			],
		},
	};
}

function grantPartnerManagementToUser(): void {
	const member = mockDatabase.members.find(
		(row) => row.user_id === MOCK_USER_ID,
	);
	assert.ok(member);
	member.department = "Partners & Sponsors";
}

describe("Partner management routes", async () => {
	let app: FastifyInstance;
	let originalApiUrl: string | undefined;
	let originalApiToken: string | undefined;

	before(async () => {
		originalApiUrl = process.env.PARTNER_PORTAL_API_URL;
		originalApiToken = process.env.PARTNER_PORTAL_API_TOKEN;
		process.env.PARTNER_PORTAL_API_URL = "https://partnerportal.test";
		process.env.PARTNER_PORTAL_API_TOKEN = "test-mm-token";
		app = await getTestApp();
	});

	after(async () => {
		globalThis.fetch = originalFetch;
		process.env.PARTNER_PORTAL_API_URL = originalApiUrl;
		process.env.PARTNER_PORTAL_API_TOKEN = originalApiToken;
		await closeTestApp();
	});

	beforeEach(() => {
		resetDatabase();
		globalThis.fetch = async () => Response.json(partnerManagementPayload());
	});

	test("requires authentication and partners.manage access", async () => {
		const anonymous = await app.inject({ method: "GET", url: "/api/partners" });
		assert.strictEqual(anonymous.statusCode, 401);

		const regular = await app.inject({
			method: "GET",
			url: "/api/partners",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(regular.statusCode, 403);
	});

	test("allows Partners & Sponsors members to list partners", async () => {
		grantPartnerManagementToUser();
		let requestedUrl = "";
		let authorization = "";
		globalThis.fetch = async (input, init) => {
			requestedUrl = String(input);
			authorization = new Headers(init?.headers).get("authorization") ?? "";
			return Response.json(partnerManagementPayload());
		};

		const response = await app.inject({
			method: "GET",
			url: "/api/partners",
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(
			requestedUrl,
			"https://partnerportal.test/api/internal/member-manager/partners",
		);
		assert.strictEqual(authorization, "Bearer test-mm-token");
		assert.strictEqual(JSON.parse(response.payload).partners[0].id, partnerId);
	});

	test("creates a partner with the authenticated actor id", async () => {
		grantPartnerManagementToUser();
		let requestHeaders = new Headers();
		let requestBody: unknown;
		globalThis.fetch = async (_input, init) => {
			requestHeaders = new Headers(init?.headers);
			requestBody = JSON.parse(String(init?.body));
			return Response.json({
				data: {
					partnerId,
					activationLink: "https://partnerportal.test/invite",
					activationEmailSent: true,
				},
			});
		};

		const response = await app.inject({
			method: "POST",
			url: "/api/partners",
			headers: authHeaders(testTokens.user),
			body: {
				companyName: "Example Partner",
				primaryEmail: "partner@example.com",
				tierId,
				contractStart: "2026-01-01",
				contractEnd: "2026-12-31",
				partnerKind: "tier_subscriber",
				websiteUrl: "https://example.com",
				notes: "",
			},
		});

		assert.strictEqual(response.statusCode, 201);
		assert.strictEqual(
			requestHeaders.get("x-member-manager-user-id"),
			MOCK_USER_ID,
		);
		assert.deepStrictEqual(requestBody, {
			companyName: "Example Partner",
			primaryEmail: "partner@example.com",
			tierId,
			contractStart: "2026-01-01",
			contractEnd: "2026-12-31",
			partnerKind: "tier_subscriber",
			websiteUrl: "https://example.com",
			notes: "",
		});
	});

	test("normalizes single-job creation to the Bronze compatibility tier", async () => {
		grantPartnerManagementToUser();
		let requestBody: Record<string, unknown> | null = null;
		globalThis.fetch = async (_input, init) => {
			if (!init?.method || init.method === "GET") {
				return Response.json(partnerManagementPayload());
			}
			requestBody = JSON.parse(String(init.body));
			return Response.json({
				data: {
					partnerId,
					activationLink: "https://partnerportal.test/invite",
					activationEmailSent: true,
				},
			});
		};

		const response = await app.inject({
			method: "POST",
			url: "/api/partners",
			headers: authHeaders(testTokens.user),
			body: {
				companyName: "Single Job Buyer",
				primaryEmail: "single@example.com",
				tierId,
				contractStart: "2026-01-01",
				contractEnd: "2026-12-31",
				partnerKind: "single_job_buyer",
				websiteUrl: "",
				notes: "",
			},
		});

		assert.strictEqual(response.statusCode, 201);
		assert.strictEqual(requestBody?.tierId, bronzeTierId);
	});

	test("normalizes single-job updates to the Bronze compatibility tier", async () => {
		grantPartnerManagementToUser();
		let requestBody: Record<string, unknown> | null = null;
		globalThis.fetch = async (_input, init) => {
			if (!init?.method || init.method === "GET") {
				return Response.json(partnerManagementPayload());
			}
			requestBody = JSON.parse(String(init.body));
			return Response.json({ data: { ok: true } });
		};

		const response = await app.inject({
			method: "PATCH",
			url: `/api/partners/${partnerId}`,
			headers: authHeaders(testTokens.user),
			body: {
				companyName: "Single Job Buyer",
				tierId,
				contractStart: "2026-01-01",
				contractEnd: "2026-12-31",
				partnerKind: "single_job_buyer",
				websiteUrl: "",
				notes: "",
			},
		});

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(requestBody?.tierId, bronzeTierId);
	});

	test("restores a partner with the authenticated actor id", async () => {
		grantPartnerManagementToUser();
		let requestedUrl = "";
		let requestMethod = "";
		let requestHeaders = new Headers();
		globalThis.fetch = async (input, init) => {
			requestedUrl = String(input);
			requestMethod = init?.method ?? "";
			requestHeaders = new Headers(init?.headers);
			return Response.json({ data: { ok: true } });
		};

		const response = await app.inject({
			method: "POST",
			url: `/api/partners/${partnerId}/unarchive`,
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(
			requestedUrl,
			`https://partnerportal.test/api/internal/member-manager/partners/${partnerId}/unarchive`,
		);
		assert.strictEqual(requestMethod, "POST");
		assert.strictEqual(
			requestHeaders.get("x-member-manager-user-id"),
			MOCK_USER_ID,
		);
	});

	test("falls back to legacy jobs credentials when generic values are blank", async () => {
		grantPartnerManagementToUser();
		const apiUrl = process.env.PARTNER_PORTAL_API_URL;
		const apiToken = process.env.PARTNER_PORTAL_API_TOKEN;
		const jobsUrl = process.env.PARTNER_PORTAL_JOBS_API_URL;
		const jobsToken = process.env.PARTNER_PORTAL_JOBS_API_TOKEN;
		process.env.PARTNER_PORTAL_API_URL = " ";
		process.env.PARTNER_PORTAL_API_TOKEN = "";
		process.env.PARTNER_PORTAL_JOBS_API_URL =
			"https://legacy-partnerportal.test/api/public/v1/jobs";
		process.env.PARTNER_PORTAL_JOBS_API_TOKEN = "legacy-token";
		let requestedUrl = "";
		let authorization = "";
		globalThis.fetch = async (input, init) => {
			requestedUrl = String(input);
			authorization = new Headers(init?.headers).get("authorization") ?? "";
			return Response.json(partnerManagementPayload());
		};

		try {
			const response = await app.inject({
				method: "GET",
				url: "/api/partners",
				headers: authHeaders(testTokens.user),
			});
			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(
				requestedUrl,
				"https://legacy-partnerportal.test/api/internal/member-manager/partners",
			);
			assert.strictEqual(authorization, "Bearer legacy-token");
		} finally {
			process.env.PARTNER_PORTAL_API_URL = apiUrl;
			process.env.PARTNER_PORTAL_API_TOKEN = apiToken;
			process.env.PARTNER_PORTAL_JOBS_API_URL = jobsUrl;
			process.env.PARTNER_PORTAL_JOBS_API_TOKEN = jobsToken;
		}
	});

	test("maps Partner Portal validation errors", async () => {
		grantPartnerManagementToUser();
		globalThis.fetch = async () =>
			Response.json(
				{
					error: {
						code: "invalid_input",
						message: "Select a valid tier.",
					},
				},
				{ status: 400 },
			);

		const response = await app.inject({
			method: "POST",
			url: "/api/partners",
			headers: authHeaders(testTokens.user),
			body: {
				companyName: "Example Partner",
				primaryEmail: "partner@example.com",
				tierId,
				contractStart: "2026-01-01",
				contractEnd: "2026-12-31",
				partnerKind: "tier_subscriber",
			},
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(response.payload, /Select a valid tier/);
	});

	test("lists jobs for a managed partner", async () => {
		grantPartnerManagementToUser();
		let requestedUrl = "";
		globalThis.fetch = async (input) => {
			requestedUrl = String(input);
			return Response.json({ data: { jobs: [partnerJobPayload()] } });
		};

		const response = await app.inject({
			method: "GET",
			url: `/api/partners/${partnerId}/jobs`,
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(
			requestedUrl,
			`https://partnerportal.test/api/internal/member-manager/partners/${partnerId}/jobs`,
		);
		assert.strictEqual(JSON.parse(response.payload).jobs[0].id, jobId);
	});

	test("creates a partner job with the authenticated actor id", async () => {
		grantPartnerManagementToUser();
		let requestHeaders = new Headers();
		let requestBody: unknown;
		globalThis.fetch = async (_input, init) => {
			requestHeaders = new Headers(init?.headers);
			requestBody = JSON.parse(String(init?.body));
			return Response.json({ data: { job: partnerJobPayload() } });
		};

		const response = await app.inject({
			method: "POST",
			url: `/api/partners/${partnerId}/jobs`,
			headers: authHeaders(testTokens.user),
			body: partnerJobInput,
		});

		assert.strictEqual(response.statusCode, 201);
		assert.strictEqual(
			requestHeaders.get("x-member-manager-user-id"),
			MOCK_USER_ID,
		);
		assert.deepStrictEqual(requestBody, partnerJobInput);
	});

	test("updates and archives partner jobs", async () => {
		grantPartnerManagementToUser();
		const requests: Array<{ method: string; url: string }> = [];
		globalThis.fetch = async (input, init) => {
			requests.push({
				method: init?.method ?? "GET",
				url: String(input),
			});
			return init?.method === "DELETE"
				? Response.json({ data: { ok: true } })
				: Response.json({ data: { job: partnerJobPayload() } });
		};

		const update = await app.inject({
			method: "PATCH",
			url: `/api/partners/${partnerId}/jobs/${jobId}`,
			headers: authHeaders(testTokens.user),
			body: partnerJobInput,
		});
		const archive = await app.inject({
			method: "DELETE",
			url: `/api/partners/${partnerId}/jobs/${jobId}`,
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(update.statusCode, 200);
		assert.strictEqual(archive.statusCode, 200);
		assert.deepStrictEqual(requests, [
			{
				method: "PATCH",
				url: `https://partnerportal.test/api/internal/member-manager/partners/${partnerId}/jobs/${jobId}`,
			},
			{
				method: "DELETE",
				url: `https://partnerportal.test/api/internal/member-manager/partners/${partnerId}/jobs/${jobId}`,
			},
		]);
	});

	test("returns service unavailable when Partner Portal is not configured", async () => {
		const apiUrl = process.env.PARTNER_PORTAL_API_URL;
		const apiToken = process.env.PARTNER_PORTAL_API_TOKEN;
		const jobsUrl = process.env.PARTNER_PORTAL_JOBS_API_URL;
		const jobsToken = process.env.PARTNER_PORTAL_JOBS_API_TOKEN;
		delete process.env.PARTNER_PORTAL_API_URL;
		delete process.env.PARTNER_PORTAL_API_TOKEN;
		delete process.env.PARTNER_PORTAL_JOBS_API_URL;
		delete process.env.PARTNER_PORTAL_JOBS_API_TOKEN;
		try {
			const response = await app.inject({
				method: "GET",
				url: "/api/partners",
				headers: authHeaders(testTokens.admin),
			});
			assert.strictEqual(response.statusCode, 503);
		} finally {
			process.env.PARTNER_PORTAL_API_URL = apiUrl;
			process.env.PARTNER_PORTAL_API_TOKEN = apiToken;
			process.env.PARTNER_PORTAL_JOBS_API_URL = jobsUrl;
			process.env.PARTNER_PORTAL_JOBS_API_TOKEN = jobsToken;
		}
	});
});
