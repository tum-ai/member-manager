import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockDatabase } from "../mocks/supabase.js";

const TEMPLATE_ID = "11111111-1111-4111-8111-111111111111";
const SUBMISSION_ID = "33333333-3333-4333-8333-333333333333";

function moveRegularUserToPartnersAndSponsors(): void {
	const member = mockDatabase.members.find(
		(row) => row.user_id === testUserIds.user,
	);
	assert.ok(member);
	member.department = "Partners & Sponsors";
	member.member_status = "active";
	member.active = true;
}

describe("Contract Routes", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	test("creates an authenticated submission with rendered contract text", async () => {
		resetDatabase();
		moveRegularUserToPartnersAndSponsors();

		const response = await app.inject({
			method: "POST",
			url: "/api/contracts/submissions",
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				template_id: TEMPLATE_ID,
				form_data: { partner_name: "Partner GmbH" },
				status: "submitted",
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.strictEqual(data.submitter_user_id, testUserIds.user);
		assert.strictEqual(data.generated_contract_text, "Hello Partner GmbH");
		assert.strictEqual(data.status, "legal_review");
		assert.ok(data.active_document_version_id);
		assert.strictEqual(mockDatabase.contract_document_versions.length, 1);
		assert.strictEqual(
			mockDatabase.contract_document_versions[0].rendered_text,
			"Hello Partner GmbH",
		);
	});

	test("renders a PDF-style preview through the server renderer", async () => {
		resetDatabase();
		moveRegularUserToPartnersAndSponsors();

		const response = await app.inject({
			method: "POST",
			url: `/api/contracts/templates/${TEMPLATE_ID}/preview`,
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				form_data: { partner_name: "Preview GmbH" },
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.strictEqual(data.text, "Hello Preview GmbH");
		assert.ok(Array.isArray(data.pages));
		assert.match(data.html, /Hello Preview GmbH/);
	});

	test("rejects contract tool access for members without the contract permission", async () => {
		resetDatabase();

		const response = await app.inject({
			method: "POST",
			url: "/api/contracts/submissions",
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				template_id: TEMPLATE_ID,
				form_data: { partner_name: "Blocked GmbH" },
				status: "submitted",
			}),
		});

		assert.strictEqual(response.statusCode, 403);
	});

	test("sends a reviewed contract to the partner", async () => {
		resetDatabase();

		const response = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				admin_edited_text: "Approved contract text",
				send_to_partner: true,
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.strictEqual(data.status, "sent_to_partner");
		assert.strictEqual(data.admin_edited_text, "Approved contract text");
		assert.match(data.signature_token, /^[a-f0-9]{64}$/);
		assert.ok(data.signature_token_expires_at);
		assert.ok(data.sent_document_version_id);
		assert.strictEqual(mockDatabase.contract_document_versions.length, 1);
		assert.strictEqual(
			mockDatabase.contract_document_versions[0].source,
			"sent_to_partner",
		);
	});

	test("records partner comments and returns the submission to review", async () => {
		resetDatabase();
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.status = "sent_to_partner";
		submission.signature_token = "comment-token";
		submission.signature_token_expires_at = "2099-01-01T00:00:00Z";

		const response = await app.inject({
			method: "POST",
			url: "/api/contracts/sign/comment-token/comment",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				comment: "Please adjust the scope.",
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.strictEqual(data.status, "partner_comments");
		assert.strictEqual(data.partner_comment, "Please adjust the scope.");

		const updated = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(updated);
		assert.strictEqual(updated.signature_token, null);
	});

	test("records a partner signature and clears the one-time token", async () => {
		resetDatabase();
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.status = "sent_to_partner";
		submission.signature_token = "signing-token";
		submission.signature_token_expires_at = "2099-01-01T00:00:00Z";

		const response = await app.inject({
			method: "POST",
			url: "/api/contracts/sign/signing-token",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				signature_data: "data:image/png;base64,AAAA",
				signer_name: "Jane Signer",
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.strictEqual(data.status, "partner_signed");

		const updated = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(updated);
		assert.strictEqual(updated.status, "partner_signed");
		assert.strictEqual(updated.signature_token, null);
		assert.strictEqual(updated.signer_name, "Jane Signer");
		assert.ok(updated.signed_at);
	});

	test("records board signature, finalizes, and serves the final PDF", async () => {
		resetDatabase();
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.status = "partner_signed";
		submission.signer_name = "Jane Signer";
		submission.signed_at = "2026-05-28T12:00:00Z";

		const boardResponse = await app.inject({
			method: "POST",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/board-signature`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				signature_data: "data:image/png;base64,BBBB",
				signer_name: "Board Member",
			}),
		});

		assert.strictEqual(boardResponse.statusCode, 200);
		const boardData = JSON.parse(boardResponse.payload);
		assert.strictEqual(boardData.status, "board_signed");
		assert.strictEqual(boardData.admin_signer_name, "Board Member");

		const finalizeResponse = await app.inject({
			method: "POST",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/finalize`,
			headers: authHeaders(testTokens.admin),
		});

		assert.strictEqual(finalizeResponse.statusCode, 200);
		const finalData = JSON.parse(finalizeResponse.payload);
		assert.strictEqual(finalData.status, "completed");
		assert.match(finalData.final_pdf_token, /^[a-f0-9]{64}$/);
		assert.ok(finalData.final_document_version_id);

		const pdfResponse = await app.inject({
			method: "GET",
			url: `/api/contracts/final/${finalData.final_pdf_token}/pdf`,
		});

		assert.strictEqual(pdfResponse.statusCode, 200);
		assert.strictEqual(pdfResponse.headers["content-type"], "application/pdf");
		assert.match(pdfResponse.payload.slice(0, 8), /^%PDF-1/);
	});
});
