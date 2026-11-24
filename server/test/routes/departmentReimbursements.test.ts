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

const EMPTY_RESPONSE = {
	department: null,
	requests: [],
	total: 0,
	page: 1,
	page_size: 10,
};

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

/** Adds Makeathon requests until the department has `total` of them. */
function seedMakeathonRequests(total: number): void {
	const template = reimbursementRow(MOCK_REIMBURSEMENT_NEWER_ID);
	const existing = mockDatabase.reimbursements.filter(
		(row) => row.department === "Makeathon",
	).length;
	for (let index = existing; index < total; index += 1) {
		mockDatabase.reimbursements.push({
			...template,
			id: `90000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
			description: `Extra request ${index}`,
			// Older than the seeded requests, each a day apart.
			created_at: new Date(Date.UTC(2026, 0, 31 - index)).toISOString(),
		});
	}
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

	test("returns the first ten requests and the total by default", async () => {
		seedMakeathonRequests(12);

		const response = await app.inject({
			method: "GET",
			url: URL,
			headers: authHeaders(testTokens.user),
		});

		const body = JSON.parse(response.payload);
		assert.strictEqual(body.requests.length, 10);
		assert.strictEqual(body.total, 12);
		assert.strictEqual(body.page, 1);
		assert.strictEqual(body.page_size, 10);
		assert.strictEqual(body.requests[0].id, MOCK_OTHER_USER_REIMBURSEMENT_ID);
	});

	test("returns the rest on the second page", async () => {
		seedMakeathonRequests(12);

		const response = await app.inject({
			method: "GET",
			url: `${URL}?page=2`,
			headers: authHeaders(testTokens.user),
		});

		const body = JSON.parse(response.payload);
		assert.deepStrictEqual(
			body.requests.map(
				(request: { description: string }) => request.description,
			),
			["Extra request 10", "Extra request 11"],
		);
		assert.strictEqual(body.total, 12);
		assert.strictEqual(body.page, 2);
	});

	test("orders requests created at the same moment by id, so pages never overlap", async () => {
		seedMakeathonRequests(12);
		// Every extra request shares one timestamp, as rows inserted in a single
		// transaction do. They straddle the page boundary.
		const extras = mockDatabase.reimbursements.filter((row) =>
			String(row.description).startsWith("Extra request"),
		);
		for (const row of extras) {
			row.created_at = "2026-01-01T00:00:00.000Z";
		}

		const ids: string[] = [];
		for (const page of [1, 2]) {
			const response = await app.inject({
				method: "GET",
				url: `${URL}?page=${page}`,
				headers: authHeaders(testTokens.user),
			});
			ids.push(
				...JSON.parse(response.payload).requests.map(
					(request: { id: string }) => request.id,
				),
			);
		}

		const extraIds = extras.map((row) => String(row.id));
		assert.deepStrictEqual(ids.slice(2), [...extraIds].sort().reverse());
		assert.strictEqual(new Set(ids).size, 12);
	});

	test("returns the last page for a page past the end", async () => {
		seedMakeathonRequests(12);

		const response = await app.inject({
			method: "GET",
			url: `${URL}?page=99`,
			headers: authHeaders(testTokens.user),
		});

		const body = JSON.parse(response.payload);
		assert.strictEqual(body.page, 2);
		assert.strictEqual(body.requests.length, 2);
	});

	// On Vercel the `/api/:path*` rewrite adds a `path` parameter to every
	// request (#309, #322).
	test("accepts the extra query parameter Vercel adds", async () => {
		const response = await app.inject({
			method: "GET",
			url: `${URL}?path=reimbursements%2Fdepartment&page=1`,
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(JSON.parse(response.payload).total, 2);
	});

	test("rejects a page that is not a positive whole number", async () => {
		for (const page of ["0", "-1", "1.5", "abc"]) {
			const response = await app.inject({
				method: "GET",
				url: `${URL}?page=${page}`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 400, `page=${page}`);
		}
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
		assert.deepStrictEqual(JSON.parse(response.payload), EMPTY_RESPONSE);
	});

	test("returns nothing to a member without a department", async () => {
		memberRow(MOCK_USER_ID).department = null;

		const response = await app.inject({
			method: "GET",
			url: URL,
			headers: authHeaders(testTokens.user),
		});

		assert.deepStrictEqual(JSON.parse(response.payload), EMPTY_RESPONSE);
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
