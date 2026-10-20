import "../setup.js";
import assert from "node:assert";
import { after, afterEach, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	type ResubmissionReceipt,
	resubmitRejectedReimbursement,
} from "../../src/lib/reimbursementResubmission.js";
import {
	resetSlackNotifier,
	setReimbursementSlackNotifier,
} from "../../src/lib/slackNotifier.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import {
	createMockSupabaseClient,
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

/**
 * Runs `action` with the request row changed by `change` right after the
 * resubmission has read it, as if another call had landed in between.
 */
async function withRowChangedAfterRead<T>(
	change: Record<string, unknown>,
	action: () => Promise<T>,
): Promise<T> {
	const client = createMockSupabaseClient();
	let changed = false;
	setSupabaseClient({
		...client,
		from: (table: string) => {
			const builder = client.from(table);
			if (table === "reimbursements" && !changed) {
				changed = true;
				const read = builder.maybeSingle;
				builder.maybeSingle = (async () => {
					const result = await read();
					// The mock hands out its stored row object; the database
					// returns a copy, so snapshot it before the row changes.
					const snapshot = {
						...result,
						data: result.data ? { ...result.data } : result.data,
					};
					Object.assign(findRequest() ?? {}, change);
					return snapshot;
				}) as typeof builder.maybeSingle;
			}
			return builder;
		},
	} as typeof client);
	try {
		return await action();
	} finally {
		setSupabaseClient(createMockSupabaseClient());
	}
}

function resubmitDirectly(receipt: ResubmissionReceipt | null) {
	return resubmitRejectedReimbursement({
		requestId: MOCK_REIMBURSEMENT_OLDER_ID,
		userId: testUserIds.user,
		details: { ...correctedRequest, submission_type: "reimbursement" },
		receipt,
		log: { warn: () => {} },
	});
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

	test("refuses a rejected request that was already paid", async () => {
		resetDatabase();
		// Before the reject-only-pending fix a paid request could be rejected
		// and keep its paid state; resubmitting must not make it payable again.
		rejectSeededRequest({ payment_status: "paid" });

		const response = await resubmit(correctedRequest);

		assert.strictEqual(response.statusCode, 409);
		assert.match(response.payload, /already paid/);
		const stored = findRequest();
		assert.strictEqual(stored?.payment_status, "paid");
		assert.strictEqual(stored?.approval_status, "not_approved");
	});

	test("refuses receipt keys that resolve into another member's folder", async () => {
		resetDatabase();
		rejectSeededRequest();
		const victimPath = `${testUserIds.otherUser}/receipt.pdf`;
		mockStorage.set(
			`${RECEIPT_BUCKET}/${victimPath}`,
			Buffer.from(PDF_BASE64, "base64"),
		);

		const response = await resubmit({
			...correctedRequest,
			receipt_filename: "receipt.pdf",
			receipt_mime_type: "application/pdf",
			receipt_storage_bucket: RECEIPT_BUCKET,
			receipt_storage_path: `${testUserIds.user}/../${victimPath}`,
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(response.payload, /does not belong to this user/);
		assert.strictEqual(findRequest()?.receipt_storage_path ?? null, null);
	});

	test("refuses the same traversal key on a new request", async () => {
		resetDatabase();
		const victimPath = `${testUserIds.otherUser}/receipt.pdf`;
		mockStorage.set(
			`${RECEIPT_BUCKET}/${victimPath}`,
			Buffer.from(PDF_BASE64, "base64"),
		);

		const response = await app.inject({
			method: "POST",
			url: "/api/reimbursements",
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				...correctedRequest,
				receipt_filename: "receipt.pdf",
				receipt_mime_type: "application/pdf",
				receipt_storage_bucket: RECEIPT_BUCKET,
				receipt_storage_path: `${testUserIds.user}/../${victimPath}`,
			}),
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(response.payload, /does not belong to this user/);
	});

	test("the losing call of a double click keeps the receipt the winner attached", async () => {
		resetDatabase();
		rejectSeededRequest();
		const newPath = `${testUserIds.user}/itemised.pdf`;
		mockStorage.set(
			`${RECEIPT_BUCKET}/${newPath}`,
			Buffer.from(PDF_BASE64, "base64"),
		);

		// Both clicks carry the same upload. The winner lands between this
		// call's read and its update.
		await assert.rejects(
			withRowChangedAfterRead(
				{
					approval_status: "pending",
					status: "requested",
					resubmission_count: 1,
					receipt_storage_bucket: RECEIPT_BUCKET,
					receipt_storage_path: newPath,
				},
				() =>
					resubmitDirectly({
						filename: "itemised.pdf",
						mimeType: "application/pdf",
						base64: null,
						storageBucket: RECEIPT_BUCKET,
						storagePath: newPath,
						sizeBytes: 8,
					}),
			),
			/changed in the meantime/,
		);

		assert.strictEqual(findRequest()?.receipt_storage_path, newPath);
		assert.strictEqual(mockStorage.has(`${RECEIPT_BUCKET}/${newPath}`), true);
	});

	test("keeps a replaced receipt that another request still uses", async () => {
		resetDatabase();
		const sharedPath = `${testUserIds.user}/shared.pdf`;
		const newPath = `${testUserIds.user}/new.pdf`;
		rejectSeededRequest({
			receipt_base64: null,
			receipt_storage_bucket: RECEIPT_BUCKET,
			receipt_storage_path: sharedPath,
		});
		mockDatabase.reimbursements.push({
			...findRequest(),
			id: "other-request-with-same-receipt",
			approval_status: "pending",
			status: "requested",
		});
		mockStorage.set(
			`${RECEIPT_BUCKET}/${sharedPath}`,
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
		});

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(
			mockStorage.has(`${RECEIPT_BUCKET}/${sharedPath}`),
			true,
		);
	});

	test("a delayed call can't overwrite a newer review round", async () => {
		resetDatabase();
		rejectSeededRequest();

		// The call reads round 0. Before its update lands, another resubmit
		// and a second rejection move the request to round 1, still rejected.
		await assert.rejects(
			withRowChangedAfterRead(
				{
					resubmission_count: 1,
					rejection_reason: "Second rejection",
					description: "Newer details",
				},
				() => resubmitDirectly(null),
			),
			/changed in the meantime/,
		);

		const stored = findRequest();
		assert.strictEqual(stored?.resubmission_count, 1);
		assert.strictEqual(stored?.rejection_reason, "Second rejection");
		assert.strictEqual(stored?.description, "Newer details");
	});

	test("moving to another department drops the finance links", async () => {
		resetDatabase();
		rejectSeededRequest({
			finance_project_id: "project-1",
			finance_plan_item_id: "plan-item-1",
			bb_posting_external_id: "posting-1",
		});

		const response = await resubmit({
			...correctedRequest,
			department: "Makeathon",
		});

		assert.strictEqual(response.statusCode, 200);
		const stored = findRequest();
		assert.strictEqual(stored?.department, "Makeathon");
		assert.strictEqual(stored?.finance_project_id, null);
		assert.strictEqual(stored?.finance_plan_item_id, null);
		assert.strictEqual(stored?.bb_posting_external_id, null);
	});
});
