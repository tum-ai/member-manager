import "../setup.js";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
} from "../helpers.js";
import { mockDatabase } from "../mocks/supabase.js";

const PROJECT_ID = "50000000-0000-4000-8000-000000000001";
const OTHER_PROJECT_ID = "50000000-0000-4000-8000-000000000002";
const PLAN_ITEM_ID = "60000000-0000-4000-8000-000000000001";
const COMMUNITY_POSTING_ID = "BB-1077";
const PDF_BASE64 = "JVBERi0xLjQ=";

function seedFinanceLinks(department = "Community"): void {
	mockDatabase.finance_projects.push({
		id: PROJECT_ID,
		department,
		period_type: "year",
		period_key: "2026",
	});
	mockDatabase.finance_plan_items.push({
		id: PLAN_ITEM_ID,
		department,
		project_id: PROJECT_ID,
		period_type: "year",
		period_key: "2026",
	});
	mockDatabase.finance_posting_allocations.push({
		id: "70000000-0000-4000-8000-000000000001",
		posting_external_id: COMMUNITY_POSTING_ID,
		department,
		project_id: PROJECT_ID,
		tax_area: null,
		allocated_amount: -840,
		allocated_percentage: 100,
		note: null,
		created_by: null,
		created_at: "2026-04-18T00:00:00.000Z",
		updated_at: "2026-04-18T00:00:00.000Z",
	});
}

function reimbursementPayload() {
	return {
		amount: 42.5,
		date: "2026-04-12",
		description: "Snacks for the onboarding workshop",
		department: "Community",
		submission_type: "reimbursement",
		payment_iban: "DE89370400440532013000",
		payment_bic: "COBADEFFXXX",
		receipt_filename: "receipt.pdf",
		receipt_mime_type: "application/pdf",
		receipt_base64: PDF_BASE64,
	};
}

describe("Reimbursement finance links", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	beforeEach(() => {
		resetDatabase();
		seedFinanceLinks();
	});

	test("ignores finance links submitted by a regular reimbursement requester", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/api/reimbursements",
			headers: authHeaders(testTokens.user),
			payload: {
				...reimbursementPayload(),
				finance_project_id: PROJECT_ID,
				finance_plan_item_id: PLAN_ITEM_ID,
				bb_posting_external_id: COMMUNITY_POSTING_ID,
			},
		});

		assert.strictEqual(response.statusCode, 201);
		const body = JSON.parse(response.payload);
		assert.strictEqual(body.finance_project_id, null);
		assert.strictEqual(body.finance_plan_item_id, null);
		assert.strictEqual(body.bb_posting_external_id, null);

		const stored = mockDatabase.reimbursements.find(
			(row) => row.id === body.id,
		);
		assert.strictEqual(stored?.finance_project_id, null);
		assert.strictEqual(stored?.finance_plan_item_id, null);
		assert.strictEqual(stored?.bb_posting_external_id, null);
	});

	test("rejects cross-department finance links during finance review", async () => {
		mockDatabase.finance_projects[0].department = "Marketing";

		const response = await app.inject({
			method: "PATCH",
			url: "/api/reimbursements/review/reimbursement-older",
			headers: authHeaders(testTokens.admin),
			payload: {
				finance_project_id: PROJECT_ID,
			},
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(JSON.parse(response.payload).error, /department/i);
	});

	test("rejects BB posting IDs that do not exist", async () => {
		const response = await app.inject({
			method: "PATCH",
			url: "/api/reimbursements/review/reimbursement-older",
			headers: authHeaders(testTokens.admin),
			payload: {
				bb_posting_external_id: "BB-DOES-NOT-EXIST",
			},
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(JSON.parse(response.payload).error, /posting not found/i);
	});

	test("rejects BB postings outside the reimbursement department", async () => {
		const response = await app.inject({
			method: "PATCH",
			url: "/api/reimbursements/review/reimbursement-older",
			headers: authHeaders(testTokens.admin),
			payload: {
				bb_posting_external_id: "BB-1001",
			},
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(JSON.parse(response.payload).error, /department/i);
	});

	test("rejects BB postings outside the selected project period", async () => {
		mockDatabase.finance_projects[0].period_key = "2027";

		const response = await app.inject({
			method: "PATCH",
			url: "/api/reimbursements/review/reimbursement-older",
			headers: authHeaders(testTokens.admin),
			payload: {
				finance_project_id: PROJECT_ID,
				bb_posting_external_id: COMMUNITY_POSTING_ID,
			},
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(JSON.parse(response.payload).error, /project period/i);
	});

	test("rejects BB postings allocated to another project", async () => {
		mockDatabase.finance_projects.push({
			id: OTHER_PROJECT_ID,
			department: "Community",
			period_type: "year",
			period_key: "2026",
		});
		mockDatabase.finance_posting_allocations[0].project_id = OTHER_PROJECT_ID;

		const response = await app.inject({
			method: "PATCH",
			url: "/api/reimbursements/review/reimbursement-older",
			headers: authHeaders(testTokens.admin),
			payload: {
				finance_project_id: PROJECT_ID,
				bb_posting_external_id: COMMUNITY_POSTING_ID,
			},
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(
			JSON.parse(response.payload).error,
			/selected finance project/i,
		);
	});

	test("rejects plan items from another project period", async () => {
		mockDatabase.finance_plan_items[0].project_id = null;
		mockDatabase.finance_plan_items[0].period_key = "2027";

		const response = await app.inject({
			method: "PATCH",
			url: "/api/reimbursements/review/reimbursement-older",
			headers: authHeaders(testTokens.admin),
			payload: {
				finance_project_id: PROJECT_ID,
				finance_plan_item_id: PLAN_ITEM_ID,
			},
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(JSON.parse(response.payload).error, /project period/i);
	});

	test("allows reviewers to add or clear links after submission", async () => {
		const linked = await app.inject({
			method: "PATCH",
			url: "/api/reimbursements/review/reimbursement-older",
			headers: authHeaders(testTokens.admin),
			payload: {
				finance_project_id: PROJECT_ID,
				finance_plan_item_id: PLAN_ITEM_ID,
				bb_posting_external_id: COMMUNITY_POSTING_ID,
			},
		});
		assert.strictEqual(linked.statusCode, 200);
		assert.strictEqual(
			JSON.parse(linked.payload).finance_project_id,
			PROJECT_ID,
		);

		const cleared = await app.inject({
			method: "PATCH",
			url: "/api/reimbursements/review/reimbursement-older",
			headers: authHeaders(testTokens.admin),
			payload: {
				finance_project_id: null,
				finance_plan_item_id: null,
				bb_posting_external_id: null,
			},
		});
		assert.strictEqual(cleared.statusCode, 200);
		assert.strictEqual(JSON.parse(cleared.payload).finance_project_id, null);
		assert.strictEqual(JSON.parse(cleared.payload).finance_plan_item_id, null);
		assert.strictEqual(
			JSON.parse(cleared.payload).bb_posting_external_id,
			null,
		);
	});
});
