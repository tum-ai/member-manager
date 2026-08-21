import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import { enrichContractFormData } from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { isEncryptedContractArtifact } from "../../src/lib/contracts/contractArtifactCrypto.js";
import {
	CONTRACT_DOCX_FIXTURE_ANCHORS,
	createContractDocxFixture,
} from "../fixtures/contractDocxFixture.js";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockDatabase, mockStorage } from "../mocks/supabase.js";

const TEMPLATE_ID = "11111111-1111-4111-8111-111111111111";
const SUBMISSION_ID = "33333333-3333-4333-8333-333333333333";
const SIGNATURE_DATA_URL =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZsusAAAAASUVORK5CYII=";

function docxMultipartPayload(docx: Buffer): {
	boundary: string;
	payload: Buffer;
} {
	const boundary = "member-manager-contract-docx-boundary";
	const header = Buffer.from(
		`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="contract.docx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n`,
	);
	const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
	return { boundary, payload: Buffer.concat([header, docx, footer]) };
}

async function waitForContractState(
	predicate: () => boolean,
	description: string,
): Promise<void> {
	const timeoutAt = Date.now() + 20_000;
	while (Date.now() < timeoutAt) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	assert.fail(`Timed out waiting for ${description}`);
}

function restoreEnv(name: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[name];
		return;
	}
	process.env[name] = value;
}

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

	test("enriches selected a-la-carte add-ons", () => {
		const data = enrichContractFormData({
			sponsoring_package: "long_term_bronze",
			selected_addons: [
				"long_term_extra_linkedin_post",
				"long_term_workshop_slot",
				"ehl_workshop_slot",
			],
		});

		assert.equal(data.addon_total_amount_eur, 3050);
		assert.equal(data.total_amount_eur, 9050);
		assert.equal(data.total_amount_label, "9.050 EUR");
	});

	test("preserves free-text add-on terms without selected add-ons", () => {
		const data = enrichContractFormData({
			sponsoring_package: "ehl_bronze",
			addon_terms: "Dinner powered by Partner.",
		});

		assert.equal(data.addon_terms, "Dinner powered by Partner.");
	});

	test("rejects contract creation without the contract permission", async () => {
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
		assert.equal(response.statusCode, 403);
	});

	test("creates new templates as inactive DOCX templates", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "POST",
			url: "/api/contracts/templates",
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				name: "DOCX only template",
				description: "Uploaded separately",
				is_active: true,
			}),
		});
		assert.equal(response.statusCode, 200);
		const template = JSON.parse(response.payload);
		assert.equal(template.renderer_engine, "docx");
		assert.equal(template.is_active, false);
		assert.equal("contract_text" in template, false);
	});

	test("does not expose the retired text preview routes", async () => {
		resetDatabase();
		const templatePreview = await app.inject({
			method: "POST",
			url: `/api/contracts/templates/${TEMPLATE_ID}/preview`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({ form_data: {} }),
		});
		assert.equal(templatePreview.statusCode, 404);

		const submissionPreview = await app.inject({
			method: "GET",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/preview`,
			headers: authHeaders(testTokens.admin),
		});
		assert.equal(submissionPreview.statusCode, 404);
	});

	test("returns a clear retired response for historical text PDFs", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "GET",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/pdf`,
			headers: authHeaders(testTokens.admin),
		});
		assert.equal(response.statusCode, 410);
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
			payload: JSON.stringify({ comment: "Please adjust the scope." }),
		});
		assert.equal(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.equal(data.status, "partner_comments");
		assert.equal(mockDatabase.contract_partner_comments.length, 1);
	});

	test("allows internal replies and returns ordered comment history", async () => {
		resetDatabase();
		mockDatabase.contract_partner_comments.push({
			id: "comment-partner",
			submission_id: SUBMISSION_ID,
			author_type: "partner",
			author_name: "Partner GmbH",
			author_email: "partner@example.com",
			comment: "Can we use a different billing date?",
			document_version_id: null,
			created_at: "2026-05-28T10:00:00Z",
		});

		const createResponse = await app.inject({
			method: "POST",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/comments`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({ comment: "Yes, I updated the contract." }),
		});
		assert.equal(createResponse.statusCode, 200);

		const listResponse = await app.inject({
			method: "GET",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/comments`,
			headers: authHeaders(testTokens.admin),
		});
		assert.equal(listResponse.statusCode, 200);
		const comments = JSON.parse(listResponse.payload);
		assert.equal(comments.length, 2);
		assert.equal(comments[1].comment, "Yes, I updated the contract.");
	});

	test("stores a display name for internal comments", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "POST",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/comments`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({ comment: "Looks good to me" }),
		});
		assert.equal(response.statusCode, 200);
		const comment = mockDatabase.contract_partner_comments.find(
			(row) => row.submission_id === SUBMISSION_ID,
		);
		assert.ok(comment);
		assert.doesNotMatch(String(comment.author_name), /@/);
	});

	test("runs the private DOCX workflow from upload through both signatures", async () => {
		const originalMode = process.env.CONTRACT_DOCX_CONVERTER_MODE;
		const originalFetch = globalThis.fetch;
		const originalResendKey = process.env.RESEND_API_KEY;
		const originalFrom = process.env.CONTRACT_EMAIL_FROM;
		const originalBaseUrl = process.env.APP_BASE_URL;
		process.env.CONTRACT_DOCX_CONVERTER_MODE = "fake";
		process.env.RESEND_API_KEY = "test-resend-key";
		process.env.CONTRACT_EMAIL_FROM = "contracts@tum-ai.com";
		process.env.APP_BASE_URL = "https://member-manager.test";
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ id: "email-docx" }), {
				status: 200,
			})) as typeof fetch;
		try {
			resetDatabase();
			moveRegularUserToPartnersAndSponsors();
			const templateDocx = await createContractDocxFixture([
				"{{partner_name}}",
				...CONTRACT_DOCX_FIXTURE_ANCHORS,
			]);
			const multipart = docxMultipartPayload(templateDocx);
			const uploadResponse = await app.inject({
				method: "POST",
				url: `/api/contracts/templates/${TEMPLATE_ID}/documents`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": `multipart/form-data; boundary=${multipart.boundary}`,
				},
				payload: multipart.payload,
			});
			assert.equal(uploadResponse.statusCode, 200);
			const uploadedDocument = JSON.parse(uploadResponse.payload);

			await waitForContractState(
				() =>
					mockDatabase.contract_template_documents.some(
						(row) => row.id === uploadedDocument.id && row.status === "ready",
					),
				"the template preview",
			);
			const templateDocument = mockDatabase.contract_template_documents.find(
				(row) => row.id === uploadedDocument.id,
			);
			assert.ok(templateDocument);
			assert.deepEqual(
				(templateDocument.placeholder_manifest as { variables: string[] })
					.variables,
				["partner_name"],
			);
			const encryptedTemplate = mockStorage.get(
				`${templateDocument.source_bucket}/${templateDocument.source_path}`,
			);
			assert.ok(encryptedTemplate);
			assert.equal(isEncryptedContractArtifact(encryptedTemplate), true);

			const previewResponse = await app.inject({
				method: "GET",
				url: `/api/contracts/templates/${TEMPLATE_ID}/documents/${uploadedDocument.id}/preview.pdf`,
				headers: authHeaders(testTokens.admin),
			});
			assert.equal(previewResponse.statusCode, 200);
			assert.match(
				previewResponse.rawPayload.subarray(0, 5).toString(),
				/^%PDF-/,
			);

			const activateResponse = await app.inject({
				method: "POST",
				url: `/api/contracts/templates/${TEMPLATE_ID}/documents/${uploadedDocument.id}/activate`,
				headers: authHeaders(testTokens.admin),
			});
			assert.equal(activateResponse.statusCode, 200);

			const createResponse = await app.inject({
				method: "POST",
				url: "/api/contracts/submissions",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					template_id: TEMPLATE_ID,
					form_data: {
						partner_name: "DOCX Partner GmbH",
						partner_company_name: "DOCX Partner GmbH",
						partner_contact_email: "partner@example.com",
					},
					status: "submitted",
				}),
			});
			assert.equal(createResponse.statusCode, 200);
			const created = JSON.parse(createResponse.payload);
			assert.equal(created.renderer_engine, "docx");
			assert.equal(created.form_data.partner_name, "DOCX Partner GmbH");
			assert.equal("form_data_encrypted" in created, false);

			const storedSubmission = mockDatabase.contract_submissions.find(
				(row) => row.id === created.id,
			);
			assert.ok(storedSubmission);
			assert.deepEqual(storedSubmission.form_data, {});
			assert.match(
				String(storedSubmission.form_data_encrypted),
				/^enc-bin-v1:/,
			);
			await waitForContractState(
				() =>
					mockDatabase.contract_document_versions.some(
						(row) =>
							row.id === storedSubmission.active_document_version_id &&
							row.artifact_status === "ready",
					),
				"the submission PDF",
			);

			const pdfResponse = await app.inject({
				method: "GET",
				url: `/api/contracts/submissions/${created.id}/pdf`,
				headers: authHeaders(testTokens.user),
			});
			assert.equal(pdfResponse.statusCode, 200);
			assert.match(pdfResponse.rawPayload.subarray(0, 5).toString(), /^%PDF-/);

			storedSubmission.status = "sent_to_partner";
			storedSubmission.signature_token = "docx-partner-token";
			storedSubmission.signature_token_expires_at = "2099-01-01T00:00:00Z";
			storedSubmission.sent_document_version_id =
				storedSubmission.active_document_version_id;
			const partnerSignResponse = await app.inject({
				method: "POST",
				url: "/api/contracts/sign/docx-partner-token",
				headers: { "content-type": "application/json" },
				payload: JSON.stringify({
					signature_data: SIGNATURE_DATA_URL,
					signer_name: "Partner Signer",
				}),
			});
			assert.equal(partnerSignResponse.statusCode, 200);
			await waitForContractState(
				() =>
					mockDatabase.contract_render_jobs.some(
						(row) =>
							row.operation === "partner_signature" &&
							["succeeded", "failed"].includes(String(row.status)),
					),
				"the partner signature job",
			);
			const partnerJob = mockDatabase.contract_render_jobs.find(
				(row) => row.operation === "partner_signature",
			);
			assert.ok(partnerJob);
			assert.equal(
				partnerJob.status,
				"succeeded",
				String(partnerJob.last_error_message),
			);

			const partnerSignedSubmission = mockDatabase.contract_submissions.find(
				(row) => row.id === created.id,
			);
			assert.ok(partnerSignedSubmission);
			assert.equal(partnerSignedSubmission.status, "partner_signed");
			partnerSignedSubmission.board_signature_token = "docx-board-token";
			partnerSignedSubmission.board_signature_token_expires_at =
				"2099-01-01T00:00:00Z";
			partnerSignedSubmission.auto_send_after_board_signed = true;

			const boardSignResponse = await app.inject({
				method: "POST",
				url: "/api/contracts/board-sign/docx-board-token",
				headers: { "content-type": "application/json" },
				payload: JSON.stringify({
					signature_data: SIGNATURE_DATA_URL,
					signer_name: "Board Signer",
				}),
			});
			assert.equal(boardSignResponse.statusCode, 200);
			await waitForContractState(
				() =>
					mockDatabase.contract_submissions.some(
						(row) => row.id === created.id && row.status === "completed",
					),
				"the board signature and automatic finalization",
			);
			const finalized = mockDatabase.contract_submissions.find(
				(row) => row.id === created.id,
			);
			assert.ok(finalized);
			const finalPdfResponse = await app.inject({
				method: "GET",
				url: `/api/contracts/final/${finalized.final_pdf_token}/pdf`,
			});
			assert.equal(finalPdfResponse.statusCode, 200);
			assert.match(
				finalPdfResponse.rawPayload.subarray(0, 5).toString(),
				/^%PDF-/,
			);
		} finally {
			globalThis.fetch = originalFetch;
			restoreEnv("RESEND_API_KEY", originalResendKey);
			restoreEnv("CONTRACT_EMAIL_FROM", originalFrom);
			restoreEnv("APP_BASE_URL", originalBaseUrl);
			restoreEnv("CONTRACT_DOCX_CONVERTER_MODE", originalMode);
		}
	});
});
