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
import { MOCK_OTHER_USER_ID, mockDatabase } from "../mocks/supabase.js";

// Register the "other" test user as a department-scoped finance viewer: an
// active member of Makeathon, whose department grants only `finance.department`.
function seedDepartmentFinanceMember(department = "Makeathon"): void {
	mockDatabase.members.push({
		user_id: MOCK_OTHER_USER_ID,
		department,
		member_status: "active",
		active: true,
	});
	mockDatabase.department_permissions.push({
		department,
		permissions: ["finance.department"],
	});
}

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
		assert.ok(
			payload.transactions.every(
				(row: {
					booking_number?: string;
					receipts_assigned_invoice_numbers?: string;
				}) =>
					Boolean(row.booking_number) &&
					Boolean(row.receipts_assigned_invoice_numbers),
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
							booking_number: "2123",
							cost_location: 120,
							cost_location_two: 0,
							transaction_amount: "7500.00",
							transaction_purpose: "JetBrains partnership tranche 1",
							receipts_assigned_invoice_numbers: "INV-2123",
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
			booking_number: "2123",
			cost_location: "120",
			cost_location_two: "0",
			transaction_amount: 7500,
			transaction_purpose: "JetBrains partnership tranche 1",
			receipts_assigned_invoice_numbers: "INV-2123",
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

		test("reports unmapped postings without any digit-based department fallback", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/analytics?date_from=2026-02-01&date_to=2026-02-28",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.source, "mock");
			assert.ok(payload.totals.count > 0);
			// No cost-location mappings exist yet, so every posting is unmapped —
			// the automatic booking/invoice-digit fallback has been removed.
			assert.strictEqual(payload.totals.unmapped_count, payload.totals.count);
			assert.ok(
				payload.by_department.every(
					(d: { unmapped: boolean }) => d.unmapped === true,
				),
			);
			assert.ok(
				!payload.by_department.some((d: { department: string }) =>
					["Partners & Sponsors", "Software Development"].includes(
						d.department,
					),
				),
			);
			assert.ok(
				payload.by_department.some(
					(d: { unmapped: boolean }) => d.unmapped === true,
				),
			);
			// VAT: the tool subscriptions in Feb are booked at 19 %, so both the
			// per-rate breakdown and the totals VAT figure are populated.
			assert.ok(Array.isArray(payload.by_vat_rate));
			assert.ok(typeof payload.totals.vat === "number");
			assert.ok(payload.totals.vat >= 0);
			const nineteen = payload.by_vat_rate.find(
				(r: { rate: number }) => r.rate === 19,
			);
			assert.ok(nineteen);
			assert.ok(nineteen.vat > 0);
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
			assert.strictEqual(partnerships.bereich, null);
		});

		test("applies saved allocations across analytics, budgets, plans, and scope", async () => {
			await app.inject({
				method: "PUT",
				url: "/api/finance/department-mappings/161",
				headers: authHeaders(testTokens.admin),
				payload: { department: "Marketing", bereich: "wirtschaftlich" },
			});

			const postingsResponse = await app.inject({
				method: "GET",
				url: "/api/finance/buchhaltungsbutler/transactions?date_from=2026-05-04&date_to=2026-05-04",
				headers: authHeaders(testTokens.admin),
			});
			const postings = JSON.parse(postingsResponse.payload).transactions;
			const venue = postings.find(
				(posting: { postingtext: string }) =>
					posting.postingtext === "Makeathon venue",
			);
			assert.ok(venue);
			mockDatabase.finance_posting_allocations.push({
				id: "10000000-0000-4000-8000-000000000099",
				posting_external_id: venue.external_id,
				department: "Research",
				project_id: null,
				tax_area: "ideell",
				allocated_amount: -4800,
				allocated_percentage: 100,
				note: null,
				created_by: MOCK_OTHER_USER_ID,
				created_at: "2026-07-21T12:00:00.000Z",
				updated_at: "2026-07-21T12:00:00.000Z",
			});

			const analyticsResponse = await app.inject({
				method: "GET",
				url: "/api/finance/analytics?date_from=2026-05-04&date_to=2026-05-04",
				headers: authHeaders(testTokens.admin),
			});
			assert.strictEqual(analyticsResponse.statusCode, 200);
			const analytics = JSON.parse(analyticsResponse.payload);
			assert.strictEqual(
				analytics.by_department.find(
					(row: { department: string }) => row.department === "Research",
				)?.expenses,
				4800,
			);
			assert.strictEqual(
				analytics.by_department.find(
					(row: { department: string }) => row.department === "Marketing",
				)?.expenses,
				3900,
			);
			assert.strictEqual(
				analytics.by_account.find(
					(row: { account: string }) => row.account === "6850",
				)?.expenses,
				8700,
			);
			assert.strictEqual(
				analytics.by_category.reduce(
					(sum: number, row: { expenses: number }) => sum + row.expenses,
					0,
				),
				8700,
			);
			assert.strictEqual(
				analytics.by_vat_rate.find((row: { rate: number }) => row.rate === 0)
					?.expenses,
				8700,
			);

			const budgetsResponse = await app.inject({
				method: "GET",
				url: "/api/finance/budgets?period_type=year&period_key=2026&department=Research",
				headers: authHeaders(testTokens.admin),
			});
			assert.strictEqual(budgetsResponse.statusCode, 200);
			const budgets = JSON.parse(budgetsResponse.payload);
			assert.strictEqual(budgets.rows[0].department, "Research");
			assert.strictEqual(budgets.rows[0].actual_expenses, 4800);

			const plansResponse = await app.inject({
				method: "GET",
				url: "/api/finance/plan-items?period_type=year&period_key=2026&department=Research",
				headers: authHeaders(testTokens.admin),
			});
			assert.strictEqual(plansResponse.statusCode, 200);
			assert.strictEqual(JSON.parse(plansResponse.payload).totals.actual, 4800);

			seedDepartmentFinanceMember("Research");
			const scopedResponse = await app.inject({
				method: "GET",
				url: "/api/finance/analytics?date_from=2026-05-04&date_to=2026-05-04",
				headers: authHeaders(testTokens.otherUser),
			});
			assert.strictEqual(scopedResponse.statusCode, 200);
			const scoped = JSON.parse(scopedResponse.payload);
			assert.strictEqual(scoped.totals.expenses, 4800);
			assert.ok(
				scoped.by_department.every(
					(row: { department: string }) => row.department === "Research",
				),
			);
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

	describe("budgets", () => {
		test("requires finance review permission", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/budgets?period_type=year&period_key=2026",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("rejects a period key that does not match its type", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/budgets?period_type=year&period_key=WS26",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 400);
		});

		test("upserts a budget and reflects it in budget-vs-actual", async () => {
			// Map cost location 161 to Makeathon so its postings become actuals.
			await app.inject({
				method: "PUT",
				url: "/api/finance/department-mappings/161",
				headers: authHeaders(testTokens.admin),
				payload: { department: "Makeathon", bereich: "wirtschaftlich" },
			});

			const put = await app.inject({
				method: "PUT",
				url: "/api/finance/budgets",
				headers: authHeaders(testTokens.admin),
				payload: {
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
					amount_planned: 5000,
				},
			});
			assert.strictEqual(put.statusCode, 200);
			assert.strictEqual(JSON.parse(put.payload).amount_planned, 5000);

			const response = await app.inject({
				method: "GET",
				url: "/api/finance/budgets?period_type=year&period_key=2026",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.period_key, "2026");
			const makeathon = payload.rows.find(
				(r: { department: string }) => r.department === "Makeathon",
			);
			assert.ok(makeathon);
			assert.strictEqual(makeathon.amount_planned, 5000);
			// Makeathon's mock spend in 2026 exceeds 5k → over budget.
			assert.ok(makeathon.actual_expenses > 5000);
			assert.strictEqual(makeathon.over_budget, true);
			assert.ok(payload.totals.amount_planned >= 5000);
		});

		test("rejects a negative planned amount", async () => {
			const response = await app.inject({
				method: "PUT",
				url: "/api/finance/budgets",
				headers: authHeaders(testTokens.admin),
				payload: {
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
					amount_planned: -100,
				},
			});

			assert.strictEqual(response.statusCode, 400);
		});
	});

	describe("department scoping", () => {
		test("a department viewer sees only their own department's analytics", async () => {
			seedDepartmentFinanceMember();
			// Map 161 → Makeathon (as admin) and 120 → Partnerships so the viewer
			// should see Makeathon rows only.
			await app.inject({
				method: "PUT",
				url: "/api/finance/department-mappings/161",
				headers: authHeaders(testTokens.admin),
				payload: { department: "Makeathon", bereich: "wirtschaftlich" },
			});
			await app.inject({
				method: "PUT",
				url: "/api/finance/department-mappings/120",
				headers: authHeaders(testTokens.admin),
				payload: { department: "Partnerships", bereich: "ideell" },
			});

			const response = await app.inject({
				method: "GET",
				url: "/api/finance/analytics?date_from=2026-01-01&date_to=2026-12-31",
				headers: authHeaders(testTokens.otherUser),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.ok(payload.by_department.length > 0);
			// Every returned department bucket is the viewer's own; nothing leaks.
			assert.ok(
				payload.by_department.every(
					(d: { department: string }) => d.department === "Makeathon",
				),
			);
		});

		test("a department viewer cannot request another department", async () => {
			seedDepartmentFinanceMember();
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/analytics?department=Partnerships",
				headers: authHeaders(testTokens.otherUser),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("a department viewer sees only their own budget row", async () => {
			seedDepartmentFinanceMember();
			await app.inject({
				method: "PUT",
				url: "/api/finance/department-mappings/161",
				headers: authHeaders(testTokens.admin),
				payload: { department: "Makeathon", bereich: "wirtschaftlich" },
			});
			await app.inject({
				method: "PUT",
				url: "/api/finance/budgets",
				headers: authHeaders(testTokens.admin),
				payload: {
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
					amount_planned: 5000,
				},
			});
			await app.inject({
				method: "PUT",
				url: "/api/finance/budgets",
				headers: authHeaders(testTokens.admin),
				payload: {
					department: "Partnerships",
					period_type: "year",
					period_key: "2026",
					amount_planned: 9000,
				},
			});

			const response = await app.inject({
				method: "GET",
				url: "/api/finance/budgets?period_type=year&period_key=2026",
				headers: authHeaders(testTokens.otherUser),
			});

			assert.strictEqual(response.statusCode, 200);
			const payload = JSON.parse(response.payload);
			assert.ok(
				payload.rows.every(
					(r: { department: string }) => r.department === "Makeathon",
				),
			);
			assert.ok(payload.rows.some((r: { department: string }) => r.department));
		});

		test("a department viewer cannot reach the editors or set budgets", async () => {
			seedDepartmentFinanceMember();

			const mappings = await app.inject({
				method: "GET",
				url: "/api/finance/department-mappings",
				headers: authHeaders(testTokens.otherUser),
			});
			assert.strictEqual(mappings.statusCode, 403);

			const budgetPut = await app.inject({
				method: "PUT",
				url: "/api/finance/budgets",
				headers: authHeaders(testTokens.otherUser),
				payload: {
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
					amount_planned: 1000,
				},
			});
			assert.strictEqual(budgetPut.statusCode, 403);
		});

		test("a user with no finance permission is refused", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/api/finance/analytics",
				headers: authHeaders(testTokens.user),
			});
			assert.strictEqual(response.statusCode, 403);
		});
	});

	describe("plan items", () => {
		async function createItem(
			token: string,
			overrides: Record<string, unknown> = {},
		) {
			return app.inject({
				method: "POST",
				url: "/api/finance/plan-items",
				headers: authHeaders(token),
				payload: {
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
					label: "Venue deposit",
					planned_amount: 3000,
					...overrides,
				},
			});
		}

		test("a reviewer creates, lists, updates and deletes a plan item", async () => {
			const created = await createItem(testTokens.admin);
			assert.strictEqual(created.statusCode, 201);
			const item = JSON.parse(created.payload);
			assert.strictEqual(item.department, "Makeathon");
			assert.strictEqual(item.status, "planned");

			const list = await app.inject({
				method: "GET",
				url: "/api/finance/plan-items?period_type=year&period_key=2026",
				headers: authHeaders(testTokens.admin),
			});
			assert.strictEqual(list.statusCode, 200);
			const payload = JSON.parse(list.payload);
			assert.strictEqual(payload.items.length, 1);
			assert.strictEqual(payload.totals.planned, 3000);

			const updated = await app.inject({
				method: "PUT",
				url: `/api/finance/plan-items/${item.id}`,
				headers: authHeaders(testTokens.admin),
				payload: {
					label: "Venue deposit",
					planned_amount: 4200,
					status: "committed",
				},
			});
			assert.strictEqual(updated.statusCode, 200);
			assert.strictEqual(JSON.parse(updated.payload).planned_amount, 4200);
			assert.strictEqual(JSON.parse(updated.payload).status, "committed");

			const removed = await app.inject({
				method: "DELETE",
				url: `/api/finance/plan-items/${item.id}`,
				headers: authHeaders(testTokens.admin),
			});
			assert.strictEqual(removed.statusCode, 204);
		});

		test("an update without direction preserves an income plan item", async () => {
			const created = await createItem(testTokens.admin, {
				direction: "income",
			});
			assert.strictEqual(created.statusCode, 201);
			const item = JSON.parse(created.payload);
			assert.strictEqual(item.direction, "income");

			const updated = await app.inject({
				method: "PUT",
				url: `/api/finance/plan-items/${item.id}`,
				headers: authHeaders(testTokens.admin),
				payload: {
					label: "Sponsoring income",
					planned_amount: 4200,
					status: "committed",
				},
			});

			assert.strictEqual(updated.statusCode, 200);
			assert.strictEqual(JSON.parse(updated.payload).direction, "income");
		});

		test("a department member manages only their own department's items", async () => {
			seedDepartmentFinanceMember();

			// Can create for own department (Makeathon).
			const own = await createItem(testTokens.otherUser);
			assert.strictEqual(own.statusCode, 201);

			// Cannot create for another department.
			const other = await createItem(testTokens.otherUser, {
				department: "Partnerships",
			});
			assert.strictEqual(other.statusCode, 403);
		});

		test("a department member cannot edit another department's item", async () => {
			seedDepartmentFinanceMember();
			// Reviewer creates an item for Partnerships.
			const created = await createItem(testTokens.admin, {
				department: "Partnerships",
			});
			const item = JSON.parse(created.payload);

			const update = await app.inject({
				method: "PUT",
				url: `/api/finance/plan-items/${item.id}`,
				headers: authHeaders(testTokens.otherUser),
				payload: {
					label: "Hijack",
					planned_amount: 1,
					status: "planned",
				},
			});
			assert.strictEqual(update.statusCode, 403);
		});

		test("a user with no finance permission cannot create a plan item", async () => {
			const response = await createItem(testTokens.user);
			assert.strictEqual(response.statusCode, 403);
		});

		test("rejects an invalid plan item and a missing one", async () => {
			const invalid = await createItem(testTokens.admin, { label: "" });
			assert.strictEqual(invalid.statusCode, 400);

			const missing = await app.inject({
				method: "PUT",
				url: "/api/finance/plan-items/00000000-0000-4000-8000-000000000000",
				headers: authHeaders(testTokens.admin),
				payload: { label: "x", planned_amount: 1, status: "planned" },
			});
			assert.strictEqual(missing.statusCode, 404);
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
