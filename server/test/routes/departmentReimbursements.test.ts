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
import {
	MOCK_OTHER_USER_ID,
	MOCK_OTHER_USER_REIMBURSEMENT_ID,
	MOCK_REIMBURSEMENT_NEWER_ID,
	MOCK_REIMBURSEMENT_OLDER_ID,
	MOCK_USER_ID,
	mockDatabase,
	mockSupabaseErrors,
} from "../mocks/supabase.js";

const URL = "/api/reimbursements/department";

function memberRow(userId: string) {
	const member = mockDatabase.members.find((row) => row.user_id === userId);
	assert.ok(member, `member ${userId} is seeded`);
	return member;
}

function reimbursementRow(id: string) {
	const row = mockDatabase.reimbursements.find((entry) => entry.id === id);
	assert.ok(row, `reimbursement ${id} is seeded`);
	return row;
}

/**
 * Puts the test user and a colleague into Makeathon. The seeded newer request
 * is the test user's own Makeathon invoice; the colleague's request is moved
 * there and rejected, so it carries a rejection reason that must stay private.
 */
function seedMakeathonDepartment(): void {
	memberRow(MOCK_USER_ID).department = "Makeathon";
	mockDatabase.members.push({
		...memberRow(MOCK_USER_ID),
		user_id: MOCK_OTHER_USER_ID,
		given_name: "Other",
		surname: "Member",
	});
	Object.assign(reimbursementRow(MOCK_OTHER_USER_REIMBURSEMENT_ID), {
		department: "Makeathon",
		status: "rejected",
		approval_status: "not_approved",
		rejection_reason: "Receipt is unreadable",
	});
}

describe("GET /api/reimbursements/department", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	beforeEach(() => {
		resetDatabase();
		seedMakeathonDepartment();
	});

	test("lists the department's requests from every member, newest first", async () => {
		const response = await app.inject({
			method: "GET",
			url: URL,
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		const body = JSON.parse(response.payload);
		assert.strictEqual(body.department, "Makeathon");
		assert.deepStrictEqual(
			body.requests.map((request: { id: string }) => request.id),
			[MOCK_OTHER_USER_REIMBURSEMENT_ID, MOCK_REIMBURSEMENT_NEWER_ID],
		);

		const [colleague, own] = body.requests;
		assert.strictEqual(colleague.requester_name, "Other Member");
		assert.strictEqual(colleague.is_own, false);
		assert.strictEqual(colleague.amount, 12);
		assert.strictEqual(colleague.description, "Other user's request");
		assert.strictEqual(colleague.approval_status, "not_approved");
		assert.strictEqual(own.requester_name, "Test User");
		assert.strictEqual(own.is_own, true);
	});

	test("shows a colleague the same list, without other departments' requests", async () => {
		const response = await app.inject({
			method: "GET",
			url: URL,
			headers: authHeaders(testTokens.otherUser),
		});

		const { requests } = JSON.parse(response.payload);
		const ids = requests.map((request: { id: string }) => request.id);
		// The test user's Community request is not part of Makeathon.
		assert.ok(!ids.includes(MOCK_REIMBURSEMENT_OLDER_ID));
		assert.deepStrictEqual(
			requests.map((request: { is_own: boolean }) => request.is_own),
			[true, false],
		);
	});

	test("returns only the summary fields, never receipts or payment details", async () => {
		const response = await app.inject({
			method: "GET",
			url: URL,
			headers: authHeaders(testTokens.user),
		});

		const body = JSON.parse(response.payload);
		for (const request of body.requests) {
			assert.deepStrictEqual(Object.keys(request).sort(), [
				"amount",
				"approval_status",
				"created_at",
				"date",
				"description",
				"first_approved_at",
				"id",
				"is_own",
				"payment_status",
				"requester_name",
				"status",
				"submission_type",
			]);
		}
		assert.doesNotMatch(response.payload, /DE89370400440532013000/);
		assert.doesNotMatch(response.payload, /COBADEFFXXX/);
		assert.doesNotMatch(response.payload, /Receipt is unreadable/);
		assert.doesNotMatch(response.payload, /other\.pdf/);
	});

	test("returns nothing to an inactive member", async () => {
		Object.assign(memberRow(MOCK_USER_ID), {
			active: false,
			member_status: "alumni",
		});

		const response = await app.inject({
			method: "GET",
			url: URL,
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.deepStrictEqual(JSON.parse(response.payload), {
			department: null,
			requests: [],
		});
	});

	test("returns nothing to a member without a department", async () => {
		memberRow(MOCK_USER_ID).department = null;

		const response = await app.inject({
			method: "GET",
			url: URL,
			headers: authHeaders(testTokens.user),
		});

		assert.deepStrictEqual(JSON.parse(response.payload), {
			department: null,
			requests: [],
		});
	});

	test("requires authentication", async () => {
		const response = await app.inject({ method: "GET", url: URL });

		assert.strictEqual(response.statusCode, 401);
	});

	test("answers 500 when the requests can't be loaded", async () => {
		mockSupabaseErrors.tables.reimbursements = { message: "boom" };

		const response = await app.inject({
			method: "GET",
			url: URL,
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 500);
	});
});
