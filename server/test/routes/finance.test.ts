import "../setup.js";
import assert from "node:assert";
import { after, before, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { getDefaultBuchhaltungsButlerDateTo } from "../../src/lib/buchhaltungsbutlerPostings.js";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
} from "../helpers.js";

describe("Finance Routes", async () => {
	let app: FastifyInstance;
	let originalFetch: typeof fetch;
	let originalPostingsUseRealApi: string | undefined;
	let originalBbUseRealApi: string | undefined;
	let originalApiClient: string | undefined;
	let originalApiSecret: string | undefined;
	let originalApiKey: string | undefined;
	let originalApiBaseUrl: string | undefined;
	let originalNodeEnv: string | undefined;

	before(async () => {
		originalFetch = globalThis.fetch;
		originalPostingsUseRealApi =
			process.env.BUCHHALTUNGSBUTLER_POSTINGS_USE_REAL_API;
		originalBbUseRealApi = process.env.BB_USE_REAL_API;
		originalApiClient = process.env.BUCHHALTUNGSBUTLER_API_CLIENT;
		originalApiSecret = process.env.BUCHHALTUNGSBUTLER_API_SECRET;
		originalApiKey = process.env.BUCHHALTUNGSBUTLER_API_KEY;
		originalApiBaseUrl = process.env.BUCHHALTUNGSBUTLER_API_BASE_URL;
		originalNodeEnv = process.env.NODE_ENV;
		app = await getTestApp();
	});

	after(async () => {
		globalThis.fetch = originalFetch;
		restoreEnv(
			"BUCHHALTUNGSBUTLER_POSTINGS_USE_REAL_API",
			originalPostingsUseRealApi,
		);
		restoreEnv("BB_USE_REAL_API", originalBbUseRealApi);
		restoreEnv("BUCHHALTUNGSBUTLER_API_CLIENT", originalApiClient);
		restoreEnv("BUCHHALTUNGSBUTLER_API_SECRET", originalApiSecret);
		restoreEnv("BUCHHALTUNGSBUTLER_API_KEY", originalApiKey);
		restoreEnv("BUCHHALTUNGSBUTLER_API_BASE_URL", originalApiBaseUrl);
		restoreEnv("NODE_ENV", originalNodeEnv);
		await closeTestApp();
	});

	beforeEach(() => {
		resetDatabase();
		globalThis.fetch = originalFetch;
		delete process.env.BUCHHALTUNGSBUTLER_POSTINGS_USE_REAL_API;
		delete process.env.BB_USE_REAL_API;
		delete process.env.BUCHHALTUNGSBUTLER_API_CLIENT;
		delete process.env.BUCHHALTUNGSBUTLER_API_SECRET;
		delete process.env.BUCHHALTUNGSBUTLER_API_KEY;
		delete process.env.BUCHHALTUNGSBUTLER_API_BASE_URL;
		process.env.NODE_ENV = "test";
	});

	test("formats the default BuchhaltungsButler date_to as a local civil date", () => {
		const localDate = new Date(2026, 6, 8, 0, 30);

		assert.strictEqual(
			getDefaultBuchhaltungsButlerDateTo(localDate),
			"2026-07-08",
		);
	});

	test("requires authentication", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/api/finance/buchhaltungsbutler/transactions",
		});

		assert.strictEqual(response.statusCode, 401);
	});

	test("requires finance review permission", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/api/finance/buchhaltungsbutler/transactions",
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 403);
	});

	test("returns mock transactions filtered by date for finance reviewers", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/api/finance/buchhaltungsbutler/transactions?date_from=2026-02-01&date_to=2026-02-28",
			headers: authHeaders(testTokens.admin),
		});

		assert.strictEqual(response.statusCode, 200);
		const payload = JSON.parse(response.payload);
		assert.strictEqual(payload.source, "mock");
		assert.match(payload.generated_at, /^\d{4}-\d{2}-\d{2}T/);
		assert.ok(payload.transactions.length > 0);
		assert.ok(
			payload.transactions.every(
				(row: { date: string }) =>
					row.date >= "2026-02-01" && row.date <= "2026-02-28",
			),
		);
		assert.ok(
			payload.transactions.some(
				(row: { postingtext: string }) =>
					row.postingtext === "Sponsoring JetBrains",
			),
		);
	});

	test("rejects an invalid date range", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/api/finance/buchhaltungsbutler/transactions?date_from=2026-03-01&date_to=2026-02-01",
			headers: authHeaders(testTokens.admin),
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(JSON.parse(response.payload).error, /invalid query/i);
	});

	test("refuses to serve mock postings in production", async () => {
		process.env.NODE_ENV = "production";

		const response = await app.inject({
			method: "GET",
			url: "/api/finance/buchhaltungsbutler/transactions",
			headers: authHeaders(testTokens.admin),
		});

		assert.strictEqual(response.statusCode, 503);
		assert.match(JSON.parse(response.payload).error, /enabled in production/i);
	});

	test("fetches real postings when explicitly enabled", async () => {
		process.env.BUCHHALTUNGSBUTLER_POSTINGS_USE_REAL_API = "true";
		process.env.BUCHHALTUNGSBUTLER_API_CLIENT = "client-id";
		process.env.BUCHHALTUNGSBUTLER_API_SECRET = "client-secret";
		process.env.BUCHHALTUNGSBUTLER_API_KEY = "customer-key";
		process.env.BUCHHALTUNGSBUTLER_API_BASE_URL = "https://bb.test/api/v1";

		const requests: Array<{
			url: string;
			body: Record<string, unknown>;
			auth: string | null;
		}> = [];
		globalThis.fetch = (async (input, init) => {
			requests.push({
				url: String(input),
				body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
				auth:
					init?.headers &&
					"Authorization" in (init.headers as Record<string, string>)
						? (init.headers as Record<string, string>).Authorization
						: null,
			});

			return new Response(
				JSON.stringify({
					success: true,
					data: [
						{
							id_by_customer: 123,
							date: "2026-02-14 01:00:00",
							postingtext: "Sponsoring JetBrains",
							amount: "7500.00",
							currency: "EUR",
							vat: "0",
							credit_type: "credit",
							debit_postingaccount_number: 8450,
							credit_postingaccount_number: 1200,
							cost_location: 120,
							cost_location_two: 0,
							transaction_amount: "7500.00",
							transaction_purpose: "JetBrains partnership tranche 1",
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}) as typeof fetch;

		const response = await app.inject({
			method: "GET",
			url: "/api/finance/buchhaltungsbutler/transactions?date_from=2026-02-01&date_to=2026-02-28",
			headers: authHeaders(testTokens.admin),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(requests.length, 1);
		assert.strictEqual(requests[0].url, "https://bb.test/api/v1/postings/get");
		assert.strictEqual(
			requests[0].auth,
			`Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
		);
		assert.deepStrictEqual(requests[0].body, {
			api_key: "customer-key",
			limit: 500,
			offset: 0,
			date_from: "2026-02-01",
			date_to: "2026-02-28",
		});

		const payload = JSON.parse(response.payload);
		assert.strictEqual(payload.source, "real");
		assert.deepStrictEqual(payload.transactions[0], {
			external_id: "123",
			date: "2026-02-14",
			postingtext: "Sponsoring JetBrains",
			amount: 7500,
			currency: "EUR",
			vat: 0,
			credit_type: "credit",
			debit_postingaccount_number: "8450",
			credit_postingaccount_number: "1200",
			cost_location: "120",
			cost_location_two: "0",
			transaction_amount: 7500,
			transaction_purpose: "JetBrains partnership tranche 1",
		});
	});

	describe("analytics", () => {
		test("requires finance review permission", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/analytics",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("buckets unmapped postings and reports totals", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/analytics?date_from=2026-02-01&date_to=2026-02-28",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.source, "mock");
			// No mappings seeded in the mock DB → every posting is unmapped.
			assert.ok(payload.totals.count > 0);
			assert.strictEqual(payload.totals.unmapped_count, payload.totals.count);
			assert.ok(
				payload.by_department.some(
					(d: { unmapped: boolean }) => d.unmapped === true,
				),
			);
			assert.match(payload.generated_at, /^\d{4}-\d{2}-\d{2}T/);
		});

		test("reflects a stored mapping in the department rollup", async () => {
			await app.inject({
				method: "PUT",
				url: "/api/finance/department-mappings/120",
				headers: authHeaders(testTokens.admin),
				payload: { department: "Partnerships", bereich: "ideell" },
			});

			const response = await app.inject({
				method: "GET",
				url: "/api/finance/analytics?date_from=2026-02-01&date_to=2026-02-28",
				headers: authHeaders(testTokens.admin),
			});

			const payload = JSON.parse(response.payload);
			const partnerships = payload.by_department.find(
				(d: { department: string }) => d.department === "Partnerships",
			);
			assert.ok(partnerships);
			assert.strictEqual(partnerships.unmapped, false);
			assert.strictEqual(partnerships.bereich, "ideell");
		});

		test("reflects a stored category label in the by_category rollup", async () => {
			await app.inject({
				method: "PUT",
				url: "/api/finance/category-mappings/1",
				headers: authHeaders(testTokens.admin),
				payload: { label: "Catering" },
			});

			const response = await app.inject({
				method: "GET",
				url: "/api/finance/analytics?date_from=2026-04-01&date_to=2026-06-30",
				headers: authHeaders(testTokens.admin),
			});

			const payload = JSON.parse(response.payload);
			assert.ok(Array.isArray(payload.by_category));
			const catering = payload.by_category.find(
				(c: { category: string }) => c.category === "Catering",
			);
			assert.ok(catering);
			assert.strictEqual(catering.unmapped, false);
			assert.ok(catering.expenses > 0);
		});
	});

	describe("category mappings", () => {
		test("requires finance review permission", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/category-mappings",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("lists discovered second cost locations as unlabelled rows", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/category-mappings?date_from=2026-02-01&date_to=2026-02-28",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.rows.length > 0);
			assert.ok(
				payload.rows.every(
					(row: { label: string | null }) => row.label === null,
				),
			);
		});

		test("upserts a label and normalizes the second cost location", async () => {
			const response = await app.inject({
				method: "PUT",
				url: "/api/finance/category-mappings/003",
				headers: authHeaders(testTokens.admin),
				payload: { label: "Venue" },
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.cost_location_two, "3");
			assert.strictEqual(payload.label, "Venue");
		});

		test("rejects an empty category label", async () => {
			const response = await app.inject({
				method: "PUT",
				url: "/api/finance/category-mappings/003",
				headers: authHeaders(testTokens.admin),
				payload: { label: "" },
			});

			assert.strictEqual(response.statusCode, 400);
		});
	});

	describe("account labels", () => {
		test("requires finance review permission", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/account-labels",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("lists discovered ledger accounts as unlabelled rows", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/account-labels?date_from=2026-02-01&date_to=2026-02-28",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.rows.length > 0);
			assert.ok(
				payload.rows.every(
					(row: { label: string | null }) => row.label === null,
				),
			);
		});

		test("upserts a label and reflects it in the by_account rollup", async () => {
			const put = await app.inject({
				method: "PUT",
				url: "/api/finance/account-labels/6840",
				headers: authHeaders(testTokens.admin),
				payload: { label: "Software & Tools" },
			});
			assert.strictEqual(put.statusCode, 200);
			assert.strictEqual(JSON.parse(put.payload).account, "6840");

			const response = await app.inject({
				method: "GET",
				url: "/api/finance/analytics?date_from=2026-01-01&date_to=2026-03-31",
				headers: authHeaders(testTokens.admin),
			});

			const payload = JSON.parse(response.payload);
			assert.ok(Array.isArray(payload.by_account));
			const software = payload.by_account.find(
				(a: { account: string }) => a.account === "6840",
			);
			assert.ok(software);
			assert.strictEqual(software.label, "Software & Tools");
			assert.ok(software.expenses > 0);
		});

		test("rejects an empty account label", async () => {
			const response = await app.inject({
				method: "PUT",
				url: "/api/finance/account-labels/6840",
				headers: authHeaders(testTokens.admin),
				payload: { label: "" },
			});

			assert.strictEqual(response.statusCode, 400);
		});
	});

	describe("department mappings", () => {
		test("requires finance review permission", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/department-mappings",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("lists discovered cost locations as unassigned rows", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/department-mappings?date_from=2026-02-01&date_to=2026-02-28",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.rows.length > 0);
			assert.ok(
				payload.rows.every(
					(row: { department: string | null }) => row.department === null,
				),
			);
			assert.ok(
				payload.rows.every(
					(row: { posting_count: number }) => row.posting_count >= 0,
				),
			);
		});

		test("upserts a mapping and normalizes the cost location", async () => {
			const response = await app.inject({
				method: "PUT",
				url: "/api/finance/department-mappings/082",
				headers: authHeaders(testTokens.admin),
				payload: { department: "Membership", bereich: "ideell" },
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.cost_location, "82");
			assert.strictEqual(payload.department, "Membership");
			assert.strictEqual(payload.bereich, "ideell");
		});

		test("rejects an empty department assignment", async () => {
			const response = await app.inject({
				method: "PUT",
				url: "/api/finance/department-mappings/082",
				headers: authHeaders(testTokens.admin),
				payload: { department: "", bereich: "ideell" },
			});

			assert.strictEqual(response.statusCode, 400);
		});
	});
});

function restoreEnv(key: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[key];
		return;
	}

	process.env[key] = value;
}
