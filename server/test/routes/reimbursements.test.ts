import "../setup.js";
import assert from "node:assert";
import { after, afterEach, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	resetSlackNotifier,
	setReimbursementSlackNotifier,
} from "../../src/lib/slackNotifier.js";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockDatabase } from "../mocks/supabase.js";

describe("Reimbursement Routes", async () => {
	let app: FastifyInstance;
	const originalFetch = globalThis.fetch;
	const originalOpenAiApiKey = process.env.OPENAI_API_KEY;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		resetSlackNotifier();
		await closeTestApp();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (originalOpenAiApiKey === undefined) {
			delete process.env.OPENAI_API_KEY;
		} else {
			process.env.OPENAI_API_KEY = originalOpenAiApiKey;
		}
	});

	describe("GET /api/reimbursements", () => {
		test("lists only the authenticated user's reimbursements", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "GET",
				url: "/api/reimbursements",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.deepStrictEqual(
				data.map((row: { id: string }) => row.id),
				["reimbursement-newer", "reimbursement-older"],
			);
		});

		test("rejects unauthenticated requests", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "GET",
				url: "/api/reimbursements",
			});

			assert.strictEqual(response.statusCode, 401);
		});
	});

	describe("POST /api/reimbursements", () => {
		test("creates an authenticated reimbursement request", async () => {
			resetDatabase();
			const notifications: Array<Record<string, unknown>> = [];
			setReimbursementSlackNotifier(async (payload) => {
				notifications.push(payload);
			});

			try {
				const response = await app.inject({
					method: "POST",
					url: "/api/reimbursements",
					headers: {
						...authHeaders(testTokens.user),
						"content-type": "application/json",
					},
					payload: JSON.stringify({
						amount: 42.5,
						date: "2026-04-12",
						description: "Snacks for the onboarding workshop",
						department: "Community",
						submission_type: "reimbursement",
						payment_iban: "DE89370400440532013000",
						payment_bic: "COBADEFFXXX",
						receipt_filename: "receipt.pdf",
						receipt_mime_type: "application/pdf",
						receipt_base64: "JVBERi0xLjQ=",
					}),
				});

				assert.strictEqual(response.statusCode, 201);
				const data = JSON.parse(response.payload);
				assert.strictEqual(data.user_id, testUserIds.user);
				assert.strictEqual(data.status, "requested");
				assert.strictEqual(data.approval_status, "pending");
				assert.strictEqual(data.payment_status, "to_be_paid");

				const stored = mockDatabase.reimbursements.find(
					(row) => row.id === data.id,
				);
				assert.ok(stored);
				assert.strictEqual(stored?.user_id, testUserIds.user);
				assert.match(String(stored?.payment_iban), /^enc-v1:/);
				assert.match(String(stored?.payment_bic), /^enc-v1:/);
				assert.strictEqual(stored?.receipt_base64, "JVBERi0xLjQ=");
				assert.strictEqual(notifications.length, 1);
				assert.strictEqual(notifications[0].requestId, data.id);
				assert.strictEqual(notifications[0].department, "Community");
			} finally {
				resetSlackNotifier();
			}
		});

		test("allows invoices without payout bank details", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "POST",
				url: "/api/reimbursements",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					amount: 120,
					date: "2026-04-14",
					description: "External vendor invoice for workshop catering",
					department: "Legal & Finance",
					submission_type: "invoice",
					receipt_filename: "invoice.pdf",
					receipt_mime_type: "application/pdf",
					receipt_base64: "JVBERi0xLjQ=",
				}),
			});

			assert.strictEqual(response.statusCode, 201);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.submission_type, "invoice");
		});

		test("rejects reimbursement requests without payout bank details", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "POST",
				url: "/api/reimbursements",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					amount: 30,
					date: "2026-04-14",
					description: "Workshop supplies",
					department: "Community",
					submission_type: "reimbursement",
				}),
			});

			assert.strictEqual(response.statusCode, 400);
			const data = JSON.parse(response.payload);
			assert.match(data.error, /iban/i);
		});

		test("rejects requests without a receipt", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "POST",
				url: "/api/reimbursements",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					amount: 30,
					date: "2026-04-14",
					description: "Workshop supplies",
					department: "Community",
					submission_type: "invoice",
				}),
			});

			assert.strictEqual(response.statusCode, 400);
			const data = JSON.parse(response.payload);
			assert.match(data.error, /receipt/i);
		});
	});

	describe("POST /api/reimbursements/parse-receipt", () => {
		test("extracts editable reimbursement fields from a receipt", async () => {
			resetDatabase();
			process.env.OPENAI_API_KEY = "test-openai-key";

			globalThis.fetch = (async (_input, init) => {
				const headers = init?.headers as Record<string, string>;
				assert.strictEqual(headers.Authorization, "Bearer test-openai-key");
				return new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									content: JSON.stringify({
										amount: "42,50",
										date: "2026-04-12",
										description: "Workshop snacks",
										payment_iban: "DE89 3704 0044 0532 0130 00",
										payment_bic: "cobadeffxxx",
									}),
								},
							},
						],
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}) as typeof fetch;

			const response = await app.inject({
				method: "POST",
				url: "/api/reimbursements/parse-receipt",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					receipt_filename: "receipt.pdf",
					receipt_mime_type: "application/pdf",
					receipt_base64: "JVBERi0xLjQ=",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.amount, 42.5);
			assert.strictEqual(data.date, "2026-04-12");
			assert.strictEqual(data.description, "Workshop snacks");
			assert.strictEqual(data.payment_iban, "DE89370400440532013000");
			assert.strictEqual(data.payment_bic, "COBADEFFXXX");
		});

		test("requires receipt extraction to be configured", async () => {
			resetDatabase();
			delete process.env.OPENAI_API_KEY;

			const response = await app.inject({
				method: "POST",
				url: "/api/reimbursements/parse-receipt",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					receipt_filename: "receipt.pdf",
					receipt_mime_type: "application/pdf",
					receipt_base64: "JVBERi0xLjQ=",
				}),
			});

			assert.strictEqual(response.statusCode, 503);
			const data = JSON.parse(response.payload);
			assert.match(data.error, /OPENAI_API_KEY/i);
		});

		test("rejects unauthenticated parse requests", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "POST",
				url: "/api/reimbursements/parse-receipt",
				headers: { "content-type": "application/json" },
				payload: JSON.stringify({
					receipt_filename: "receipt.pdf",
					receipt_mime_type: "application/pdf",
					receipt_base64: "JVBERi0xLjQ=",
				}),
			});

			assert.strictEqual(response.statusCode, 401);
		});
	});

	describe("finance reimbursement review routes", () => {
		test("requires Legal & Finance or admin access to list review requests", async () => {
			resetDatabase();

			const unauthenticated = await app.inject({
				method: "GET",
				url: "/api/reimbursements/review",
			});
			assert.strictEqual(unauthenticated.statusCode, 401);

			const regularUser = await app.inject({
				method: "GET",
				url: "/api/reimbursements/review",
				headers: authHeaders(testTokens.user),
			});
			assert.strictEqual(regularUser.statusCode, 403);
		});

		test("lets active Legal & Finance members review all reimbursement requests", async () => {
			resetDatabase();
			const adminRole = mockDatabase.user_roles.find(
				(row) => row.user_id === testUserIds.admin,
			);
			if (adminRole) {
				adminRole.role = "user";
			}

			const response = await app.inject({
				method: "GET",
				url: "/api/reimbursements/review",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.deepStrictEqual(
				data.map((row: { id: string }) => row.id),
				[
					"other-user-reimbursement",
					"reimbursement-newer",
					"reimbursement-older",
				],
			);
		});

		test("lets reviewers approve, reject, and mark requests paid", async () => {
			resetDatabase();

			const approve = await app.inject({
				method: "PATCH",
				url: "/api/reimbursements/review/reimbursement-older",
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ action: "approve" }),
			});
			assert.strictEqual(approve.statusCode, 200);
			assert.strictEqual(
				mockDatabase.reimbursements.find(
					(row) => row.id === "reimbursement-older",
				)?.approval_status,
				"approved",
			);

			const markPaid = await app.inject({
				method: "PATCH",
				url: "/api/reimbursements/review/reimbursement-older",
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ action: "mark_paid" }),
			});
			assert.strictEqual(markPaid.statusCode, 200);
			const paidRequest = mockDatabase.reimbursements.find(
				(row) => row.id === "reimbursement-older",
			);
			assert.strictEqual(paidRequest?.payment_status, "paid");
			assert.strictEqual(paidRequest?.status, "paid");

			const reject = await app.inject({
				method: "PATCH",
				url: "/api/reimbursements/review/other-user-reimbursement",
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					action: "reject",
					rejection_reason: "Receipt is missing required finance details",
				}),
			});
			assert.strictEqual(reject.statusCode, 200);
			const rejectedRequest = mockDatabase.reimbursements.find(
				(row) => row.id === "other-user-reimbursement",
			);
			assert.strictEqual(rejectedRequest?.approval_status, "not_approved");
			assert.strictEqual(rejectedRequest?.status, "rejected");
			assert.strictEqual(
				rejectedRequest?.rejection_reason,
				"Receipt is missing required finance details",
			);
		});
	});
});
