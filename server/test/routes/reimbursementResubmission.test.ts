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
import {
	MOCK_REIMBURSEMENT_OLDER_ID,
	mockDatabase,
	mockStorage,
} from "../mocks/supabase.js";

const PDF_BASE64 = "JVBERi0xLjQ=";
const RECEIPT_BUCKET = "reimbursement-receipts";

const correctedRequest = {
	amount: 31.2,
	date: "2026-03-21",
	description: "Snacks for member onboarding (itemized receipt)",
	department: "Community",
	submission_type: "reimbursement",
	payment_iban: "DE89370400440532013000",
	payment_bic: "COBADEFFXXX",
};

function findRequest(id = MOCK_REIMBURSEMENT_OLDER_ID) {
	return mockDatabase.reimbursements.find((row) => row.id === id);
}

/** Puts the user's seeded request into the state a reviewer's rejection leaves. */
function rejectSeededRequest(extra: Record<string, unknown> = {}) {
	const row = findRequest();
	assert.ok(row);
	Object.assign(row, {
		status: "rejected",
		approval_status: "not_approved",
		rejection_reason: "Receipt is not itemized",
		first_approved_at: "2026-03-22T09:00:00Z",
		first_approved_by: testUserIds.admin,
		finance_project_id: "project-1",
		...extra,
	});
	return row;
}

describe("reimbursement resubmission", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	afterEach(() => {
		resetSlackNotifier();
	});

	const resubmit = (
		body: Record<string, unknown>,
		{
			token = testTokens.user,
			requestId = MOCK_REIMBURSEMENT_OLDER_ID,
		}: { token?: string; requestId?: string } = {},
	) =>
		app.inject({
			method: "POST",
			url: `/api/reimbursements/${requestId}/resubmit`,
			headers: { ...authHeaders(token), "content-type": "application/json" },
			payload: JSON.stringify(body),
		});

	test("sends the same rejected request back to review with the corrections", async () => {
		resetDatabase();
		rejectSeededRequest();
		const notifications: Array<Record<string, unknown>> = [];
		setReimbursementSlackNotifier(async (payload) => {
			notifications.push(payload as unknown as Record<string, unknown>);
		});

		const response = await resubmit(correctedRequest);

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.strictEqual(data.id, MOCK_REIMBURSEMENT_OLDER_ID);
		assert.strictEqual(data.payment_iban, correctedRequest.payment_iban);
		assert.doesNotMatch(JSON.stringify(data), /enc-v1:/);

		const stored = findRequest();
		assert.strictEqual(stored?.amount, 31.2);
		assert.strictEqual(stored?.description, correctedRequest.description);
		assert.strictEqual(stored?.status, "requested");
		assert.strictEqual(stored?.approval_status, "pending");
		assert.strictEqual(stored?.payment_status, "to_be_paid");
		assert.strictEqual(stored?.rejection_reason, null);
		assert.strictEqual(
			stored?.last_rejection_reason,
			"Receipt is not itemized",
		);
		// The approvals were for the old content, so the review starts over.
		assert.strictEqual(stored?.first_approved_at, null);
		assert.strictEqual(stored?.first_approved_by, null);
		assert.strictEqual(stored?.resubmission_count, 1);
		assert.ok(stored?.resubmitted_at);
		// Reviewer-owned and historical fields stay as they were.
		assert.strictEqual(stored?.finance_project_id, "project-1");
		assert.strictEqual(stored?.created_at, "2026-03-20T10:00:00Z");
		// No new receipt sent: the attached one is kept.
		assert.strictEqual(stored?.receipt_filename, "older.pdf");
		assert.strictEqual(stored?.receipt_base64, PDF_BASE64);
		assert.match(String(stored?.payment_iban), /^enc-v1:/);
		assert.match(String(stored?.payment_bic), /^enc-v1:/);

		assert.strictEqual(notifications.length, 1);
		assert.strictEqual(notifications[0].requestId, MOCK_REIMBURSEMENT_OLDER_ID);
		assert.deepStrictEqual(notifications[0].resubmission, {
			count: 1,
			previousRejectionReason: "Receipt is not itemized",
		});
	});

	test("replaces the receipt and removes the old stored file", async () => {
		resetDatabase();
		const oldPath = `${testUserIds.user}/old.pdf`;
		const newPath = `${testUserIds.user}/new.pdf`;
		rejectSeededRequest({
			receipt_base64: null,
			receipt_storage_bucket: RECEIPT_BUCKET,
			receipt_storage_path: oldPath,
		});
		mockStorage.set(
			`${RECEIPT_BUCKET}/${oldPath}`,
			Buffer.from(PDF_BASE64, "base64"),
		);
		mockStorage.set(
			`${RECEIPT_BUCKET}/${newPath}`,
			Buffer.from(PDF_BASE64, "base64"),
		);

		const response = await resubmit({
			...correctedRequest,
			receipt_filename: "new.pdf",
			receipt_mime_type: "application/pdf",
			receipt_storage_bucket: RECEIPT_BUCKET,
			receipt_storage_path: newPath,
			receipt_size_bytes: 8,
		});

		assert.strictEqual(response.statusCode, 200);
		const stored = findRequest();
		assert.strictEqual(stored?.receipt_filename, "new.pdf");
		assert.strictEqual(stored?.receipt_storage_path, newPath);
		assert.strictEqual(mockStorage.has(`${RECEIPT_BUCKET}/${oldPath}`), false);
		assert.strictEqual(mockStorage.has(`${RECEIPT_BUCKET}/${newPath}`), true);
	});

	test("refuses a replacement receipt from another user's folder", async () => {
		resetDatabase();
		rejectSeededRequest();
		const foreignPath = `${testUserIds.admin}/receipt.pdf`;
		mockStorage.set(
			`${RECEIPT_BUCKET}/${foreignPath}`,
			Buffer.from(PDF_BASE64, "base64"),
		);

		const response = await resubmit({
			...correctedRequest,
			receipt_filename: "receipt.pdf",
			receipt_mime_type: "application/pdf",
			receipt_storage_bucket: RECEIPT_BUCKET,
			receipt_storage_path: foreignPath,
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(response.payload, /does not belong to this user/);
		assert.strictEqual(findRequest()?.approval_status, "not_approved");
	});

	test("answers 404 for another member's request", async () => {
		resetDatabase();
		rejectSeededRequest();

		const response = await resubmit(correctedRequest, {
			token: testTokens.otherUser,
		});

		assert.strictEqual(response.statusCode, 404);
		assert.strictEqual(findRequest()?.approval_status, "not_approved");
		assert.strictEqual(findRequest()?.amount, 25.5);
	});

	test("only resubmits rejected requests", async () => {
		for (const state of [
			{ approval_status: "pending", status: "requested" },
			{ approval_status: "approved", status: "requested" },
			{ approval_status: "approved", status: "paid", payment_status: "paid" },
		]) {
			resetDatabase();
			const row = findRequest();
			assert.ok(row);
			Object.assign(row, state);

			const response = await resubmit(correctedRequest);

			assert.strictEqual(response.statusCode, 409);
			assert.match(response.payload, /Only rejected requests/);
			assert.strictEqual(findRequest()?.amount, 25.5);
			assert.strictEqual(findRequest()?.resubmission_count ?? 0, 0);
		}
	});

	test("counts a double-click as one resubmission", async () => {
		resetDatabase();
		rejectSeededRequest();

		const responses = await Promise.all([
			resubmit(correctedRequest),
			resubmit(correctedRequest),
		]);

		assert.deepStrictEqual(
			responses.map((response) => response.statusCode).sort(),
			[200, 409],
		);
		assert.strictEqual(findRequest()?.resubmission_count, 1);
	});

	test("keeps counting across repeated rejections", async () => {
		resetDatabase();
		rejectSeededRequest({ resubmission_count: 2 });

		const response = await resubmit(correctedRequest);

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(findRequest()?.resubmission_count, 3);
	});

	test("applies the create rules: IBAN required and Vivid eligibility", async () => {
		resetDatabase();
		rejectSeededRequest();

		const missingIban = await resubmit({
			...correctedRequest,
			payment_iban: "",
		});
		assert.strictEqual(missingIban.statusCode, 400);

		const incompleteReceipt = await resubmit({
			...correctedRequest,
			receipt_storage_path: `${testUserIds.user}/new.pdf`,
		});
		assert.strictEqual(incompleteReceipt.statusCode, 400);

		const vivid = await resubmit({
			...correctedRequest,
			submission_type: "vivid_reimbursement",
			payment_iban: null,
			payment_bic: null,
		});
		assert.strictEqual(vivid.statusCode, 403);
		assert.strictEqual(findRequest()?.approval_status, "not_approved");
	});

	test("switches an eligible member's request to Vivid without payout", async () => {
		resetDatabase();
		rejectSeededRequest();
		const member = mockDatabase.members.find(
			(row) => row.user_id === testUserIds.user,
		);
		assert.ok(member);
		member.member_role = "Team Lead";

		const response = await resubmit({
			...correctedRequest,
			submission_type: "vivid_reimbursement",
			payment_iban: null,
			payment_bic: null,
		});

		assert.strictEqual(response.statusCode, 200);
		const stored = findRequest();
		assert.strictEqual(stored?.submission_type, "vivid_reimbursement");
		assert.strictEqual(stored?.payment_iban, null);
		assert.strictEqual(stored?.payment_status, "not_required");
	});
});
