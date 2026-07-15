import "../setup.js";
import assert from "node:assert";
import { createHmac } from "node:crypto";
import { after, before, describe, test } from "node:test";
import {
	ContractSubmissionAdminDetailSchema,
	ContractSubmissionCreatorDetailSchema,
	ContractSubmissionCreatorSummarySchema,
	enrichContractFormData,
} from "@member-manager/shared";
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

// Sending to the partner now requires an approved contract. Tests that
// exercise the send/OpenSign paths approve the seeded submission first.
function approveSeededSubmission(): void {
	const submission = mockDatabase.contract_submissions.find(
		(row) => row.id === SUBMISSION_ID,
	);
	assert.ok(submission);
	submission.status = "approved";
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

function grantRegularUserContractCreateOnly(): void {
	const member = mockDatabase.members.find(
		(row) => row.user_id === testUserIds.user,
	);
	assert.ok(member);
	member.department = "Software Development";
	member.member_status = "active";
	member.active = true;
	mockDatabase.department_permissions.push({
		department: "Software Development",
		permissions: ["contracts.create"],
		updated_at: "2026-07-15T00:00:00Z",
		updated_by: testUserIds.admin,
	});
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

		assert.strictEqual(
			data.addon_terms,
			"- Extra LinkedIn Post: 750 EUR\n- Workshop Slot: 2.300 EUR",
		);
		assert.strictEqual(data.addon_total_amount_eur, 3050);
		assert.strictEqual(data.total_amount_eur, 9050);
		assert.strictEqual(data.total_amount_label, "9.050 EUR");
	});

	test("preserves legacy free-text add-on terms without selected add-ons", () => {
		const data = enrichContractFormData({
			sponsoring_package: "ehl_bronze",
			addon_terms: "Dinner powered by Partner.",
		});

		assert.strictEqual(data.addon_terms, "Dinner powered by Partner.");
	});

	test("redacts admin-only submission fields from creator responses", async () => {
		resetDatabase();
		grantRegularUserContractCreateOnly();
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.notes = "Internal note";
		submission.rejection_reason = null;
		submission.signature_token = "partner-token";
		submission.signature_token_expires_at = "2099-01-01T00:00:00Z";
		submission.board_signature_token = "board-token";
		submission.board_signature_token_expires_at = "2099-01-01T00:00:00Z";
		submission.reviewed_by = testUserIds.admin;
		submission.reviewed_at = "2026-07-15T00:00:00Z";
		submission.opensign_webhook_last_event = "completed";
		submission.opensign_webhook_received_at = "2026-07-15T00:00:00Z";

		const listResponse = await app.inject({
			method: "GET",
			url: "/api/contracts/submissions",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(listResponse.statusCode, 200);
		const summaries = JSON.parse(listResponse.payload);
		assert.equal(
			ContractSubmissionCreatorSummarySchema.safeParse(summaries[0]).success,
			true,
		);
		assert.equal("signature_token" in summaries[0], false);
		assert.equal("signature_token_expires_at" in summaries[0], false);

		const detailResponse = await app.inject({
			method: "GET",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(detailResponse.statusCode, 200);
		const creatorDetail = JSON.parse(detailResponse.payload);
		assert.equal(
			ContractSubmissionCreatorDetailSchema.safeParse(creatorDetail).success,
			true,
		);
		for (const field of [
			"notes",
			"signature_token",
			"signature_token_expires_at",
			"board_signature_token",
			"board_signature_token_expires_at",
			"reviewed_by",
			"reviewed_at",
			"opensign_webhook_last_event",
			"opensign_webhook_received_at",
		]) {
			assert.equal(field in creatorDetail, false);
		}

		const adminResponse = await app.inject({
			method: "GET",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(adminResponse.statusCode, 200);
		assert.equal(
			ContractSubmissionAdminDetailSchema.safeParse(
				JSON.parse(adminResponse.payload),
			).success,
			true,
		);
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

	test("lets the draft creator update and submit a draft", async () => {
		resetDatabase();
		moveRegularUserToPartnersAndSponsors();

		const createResponse = await app.inject({
			method: "POST",
			url: "/api/contracts/submissions",
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				template_id: TEMPLATE_ID,
				form_data: { partner_name: "First GmbH" },
				status: "draft",
			}),
		});
		assert.strictEqual(createResponse.statusCode, 200);
		const draft = JSON.parse(createResponse.payload);
		assert.strictEqual(draft.status, "draft");

		const saveResponse = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${draft.id}/draft`,
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				form_data: { partner_name: "Updated GmbH" },
				status: "draft",
			}),
		});
		assert.strictEqual(saveResponse.statusCode, 200);
		const saved = JSON.parse(saveResponse.payload);
		assert.strictEqual(saved.status, "draft");
		assert.strictEqual(saved.generated_contract_text, "Hello Updated GmbH");
		assert.strictEqual(saved.form_data.partner_name, "Updated GmbH");

		const submitResponse = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${draft.id}/draft`,
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				form_data: { partner_name: "Submitted GmbH" },
				status: "submitted",
			}),
		});
		assert.strictEqual(submitResponse.statusCode, 200);
		const submitted = JSON.parse(submitResponse.payload);
		assert.strictEqual(submitted.status, "legal_review");
		assert.strictEqual(
			submitted.generated_contract_text,
			"Hello Submitted GmbH",
		);
		assert.ok(submitted.active_document_version_id);
	});

	test("rejects draft edits from another non-admin creator", async () => {
		resetDatabase();
		moveRegularUserToPartnersAndSponsors();
		mockDatabase.members.push({
			user_id: testUserIds.otherUser,
			given_name: "Other",
			surname: "Creator",
			active: true,
			member_status: "active",
			department: "Partners & Sponsors",
			member_role: "Member",
		});

		const createResponse = await app.inject({
			method: "POST",
			url: "/api/contracts/submissions",
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				template_id: TEMPLATE_ID,
				form_data: { partner_name: "Owner GmbH" },
				status: "draft",
			}),
		});
		assert.strictEqual(createResponse.statusCode, 200);
		const draft = JSON.parse(createResponse.payload);

		const response = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${draft.id}/draft`,
			headers: {
				...authHeaders(testTokens.otherUser),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				form_data: { partner_name: "Blocked GmbH" },
				status: "draft",
			}),
		});

		assert.strictEqual(response.statusCode, 403);
	});

	test("rejects draft edits after submission leaves draft status", async () => {
		resetDatabase();

		const response = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/draft`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				form_data: { partner_name: "Too Late GmbH" },
				status: "draft",
			}),
		});

		assert.strictEqual(response.statusCode, 409);
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

	test("splits long preview paragraphs across pages", async () => {
		resetDatabase();
		moveRegularUserToPartnersAndSponsors();
		const template = mockDatabase.contract_templates.find(
			(row) => row.id === TEMPLATE_ID,
		);
		assert.ok(template);
		template.contract_text = Array.from(
			{ length: 420 },
			(_, index) => `word${index}`,
		).join(" ");

		const response = await app.inject({
			method: "POST",
			url: `/api/contracts/templates/${TEMPLATE_ID}/preview`,
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				form_data: {},
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.ok(data.pages.length > 1);
	});

	test("keeps wrapped preview list items as lists", async () => {
		resetDatabase();
		moveRegularUserToPartnersAndSponsors();
		const template = mockDatabase.contract_templates.find(
			(row) => row.id === TEMPLATE_ID,
		);
		assert.ok(template);
		template.contract_text = [
			"- First list item with enough words to wrap across multiple preview lines while staying one list item",
			"- Second list item",
		].join("\n");

		const response = await app.inject({
			method: "POST",
			url: `/api/contracts/templates/${TEMPLATE_ID}/preview`,
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				form_data: {},
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.match(data.html, /<ul>/);
		assert.match(data.html, /<li>First list item/);
		assert.match(data.html, /Second list item<\/li>/);
	});

	test("keeps list continuations and blank lines across preview pages", async () => {
		resetDatabase();
		moveRegularUserToPartnersAndSponsors();
		const template = mockDatabase.contract_templates.find(
			(row) => row.id === TEMPLATE_ID,
		);
		assert.ok(template);
		template.contract_text = [
			"Opening paragraph.",
			Array.from({ length: 360 }, (_, index) => `word${index}`).join(" "),
			[
				`- ${Array.from({ length: 420 }, (_, index) => `itemword${index}`).join(
					" ",
				)}`,
				"- Second item",
			].join("\n"),
		].join("\n\n");

		const response = await app.inject({
			method: "POST",
			url: `/api/contracts/templates/${TEMPLATE_ID}/preview`,
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				form_data: {},
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.match(data.html, /class="blank-line"/);
		assert.match(data.html, /class="list-continuation"/);
	});

	test("renders selected add-ons into contract previews", async () => {
		resetDatabase();
		moveRegularUserToPartnersAndSponsors();
		const template = mockDatabase.contract_templates.find(
			(row) => row.id === TEMPLATE_ID,
		);
		assert.ok(template);
		template.contract_text =
			"{{package_label}}\n\n{{package_benefits}}\n\n{{addon_terms}}\n\nTotal: {{total_amount_label}}";

		const response = await app.inject({
			method: "POST",
			url: `/api/contracts/templates/${TEMPLATE_ID}/preview`,
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				form_data: {
					sponsoring_package: "ehl_gold",
					selected_addons: ["ehl_ceremony_job_posting", "ehl_workshop_slot"],
				},
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.match(data.text, /EHL Hackathon Pass - Gold/);
		assert.match(data.text, /- Job Posting in Ceremony: 700 EUR/);
		assert.match(data.text, /- Workshop Slot: 1.000 EUR/);
		assert.match(data.text, /Total: 10.700 EUR/);
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
		approveSeededSubmission();

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

	test("downloads the current submission as a PDF", async () => {
		resetDatabase();

		const response = await app.inject({
			method: "GET",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/pdf`,
			headers: authHeaders(testTokens.admin),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(response.headers["content-type"], "application/pdf");
		assert.match(
			String(response.headers["content-disposition"]),
			/^attachment; filename="contract-/,
		);
		assert.match(response.payload.slice(0, 8), /^%PDF-1/);
	});

	test("emails a reviewed contract to the partner", async () => {
		resetDatabase();
		approveSeededSubmission();
		const originalFetch = globalThis.fetch;
		const originalResendKey = process.env.RESEND_API_KEY;
		const originalFrom = process.env.CONTRACT_EMAIL_FROM;
		const originalBaseUrl = process.env.APP_BASE_URL;
		const sentBodies: Array<Record<string, unknown>> = [];
		process.env.RESEND_API_KEY = "test-resend-key";
		process.env.CONTRACT_EMAIL_FROM = "contracts@tum-ai.com";
		process.env.APP_BASE_URL = "https://member-manager.test";
		globalThis.fetch = (async (_url, init) => {
			sentBodies.push(JSON.parse(String(init?.body)));
			return new Response(JSON.stringify({ id: "email-123" }), {
				status: 200,
			});
		}) as typeof fetch;

		try {
			const submission = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(submission);
			submission.form_data = {
				partner_company_name: "Partner GmbH",
				partner_contact_email: "partner@example.com",
			};

			const response = await app.inject({
				method: "PATCH",
				url: `/api/contracts/submissions/${SUBMISSION_ID}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					admin_edited_text: "Approved contract text",
					send_partner_email: true,
					partner_email_subject: "Please sign",
					partner_email_message: "Review the contract.",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.status, "sent_to_partner");
			assert.strictEqual(data.partner_email_recipient, "partner@example.com");
			assert.ok(data.partner_email_sent_at);
			// The partner signing email is sent (a separate status-change
			// notification to the creator may also be sent — assert on the partner
			// email specifically).
			const partnerBody = sentBodies.find(
				(body) => body.to === "partner@example.com",
			);
			assert.ok(partnerBody);
			assert.strictEqual(partnerBody.subject, "Please sign");
			assert.match(
				String(partnerBody.text),
				/https:\/\/member-manager\.test\/contracts\/sign\/[a-f0-9]{64}/,
			);
		} finally {
			globalThis.fetch = originalFetch;
			restoreEnv("RESEND_API_KEY", originalResendKey);
			restoreEnv("CONTRACT_EMAIL_FROM", originalFrom);
			restoreEnv("APP_BASE_URL", originalBaseUrl);
		}
	});

	test("rejects partner email sending when the provider is not configured", async () => {
		resetDatabase();
		approveSeededSubmission();
		const originalResendKey = process.env.RESEND_API_KEY;
		const originalFrom = process.env.CONTRACT_EMAIL_FROM;
		delete process.env.RESEND_API_KEY;
		delete process.env.CONTRACT_EMAIL_FROM;

		try {
			const submission = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(submission);
			submission.form_data = {
				partner_company_name: "Partner GmbH",
				partner_contact_email: "partner@example.com",
			};

			const response = await app.inject({
				method: "PATCH",
				url: `/api/contracts/submissions/${SUBMISSION_ID}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					admin_edited_text: "Approved contract text",
					send_partner_email: true,
				}),
			});

			assert.strictEqual(response.statusCode, 503);
			assert.match(JSON.parse(response.payload).error, /not configured/);
		} finally {
			restoreEnv("RESEND_API_KEY", originalResendKey);
			restoreEnv("CONTRACT_EMAIL_FROM", originalFrom);
		}
	});

	test("does not mark a submission sent when partner email delivery fails", async () => {
		resetDatabase();
		approveSeededSubmission();
		const originalFetch = globalThis.fetch;
		const originalResendKey = process.env.RESEND_API_KEY;
		const originalFrom = process.env.CONTRACT_EMAIL_FROM;
		process.env.RESEND_API_KEY = "test-resend-key";
		process.env.CONTRACT_EMAIL_FROM = "contracts@tum-ai.com";
		globalThis.fetch = (async () =>
			new Response("provider unavailable", { status: 500 })) as typeof fetch;

		try {
			const submission = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(submission);
			submission.form_data = {
				partner_company_name: "Partner GmbH",
				partner_contact_email: "partner@example.com",
			};

			const response = await app.inject({
				method: "PATCH",
				url: `/api/contracts/submissions/${SUBMISSION_ID}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					admin_edited_text: "Approved contract text",
					send_partner_email: true,
				}),
			});

			assert.strictEqual(response.statusCode, 502);
			const updated = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(updated);
			assert.strictEqual(updated.status, "approved");
			assert.strictEqual(updated.sent_to_partner_at, null);
			assert.match(
				String(updated.partner_email_error),
				/Failed to send contract email/,
			);
		} finally {
			globalThis.fetch = originalFetch;
			restoreEnv("RESEND_API_KEY", originalResendKey);
			restoreEnv("CONTRACT_EMAIL_FROM", originalFrom);
		}
	});

	test("emails the submitter when clarification is requested", async () => {
		resetDatabase();
		const originalFetch = globalThis.fetch;
		const originalResendKey = process.env.RESEND_API_KEY;
		const originalFrom = process.env.CONTRACT_EMAIL_FROM;
		const originalBaseUrl = process.env.APP_BASE_URL;
		const sentBodies: Array<Record<string, unknown>> = [];
		process.env.RESEND_API_KEY = "test-resend-key";
		process.env.CONTRACT_EMAIL_FROM = "contracts@tum-ai.com";
		process.env.APP_BASE_URL = "https://member-manager.test";
		globalThis.fetch = (async (_url, init) => {
			sentBodies.push(JSON.parse(String(init?.body)));
			return new Response(JSON.stringify({ id: "email-456" }), {
				status: 200,
			});
		}) as typeof fetch;

		try {
			const submission = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(submission);
			submission.form_data = {
				partner_company_name: "Partner GmbH",
				partner_contact_email: "partner@example.com",
			};

			const response = await app.inject({
				method: "PATCH",
				url: `/api/contracts/submissions/${SUBMISSION_ID}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					status: "inquiry",
					notes: "Internal note",
					feedback_message: "Please add the billing address.",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.status, "inquiry");
			assert.strictEqual(
				data.feedback_message,
				"Please add the billing address.",
			);
			assert.strictEqual(data.clarification_email_recipient, "user@test.com");
			assert.ok(data.clarification_email_sent_at);
			assert.strictEqual(data.clarification_email_error, null);
			assert.strictEqual(sentBodies.length, 1);
			assert.strictEqual(sentBodies[0].to, "user@test.com");
			assert.match(String(sentBodies[0].subject), /Partner GmbH/);
			assert.match(
				String(sentBodies[0].text),
				/Please add the billing address\./,
			);
			assert.match(
				String(sentBodies[0].text),
				/https:\/\/member-manager\.test\/contracts\/submissions\/33333333-3333-4333-8333-333333333333/,
			);
		} finally {
			globalThis.fetch = originalFetch;
			restoreEnv("RESEND_API_KEY", originalResendKey);
			restoreEnv("CONTRACT_EMAIL_FROM", originalFrom);
			restoreEnv("APP_BASE_URL", originalBaseUrl);
		}
	});

	test("stores clarification email errors for reviewers", async () => {
		resetDatabase();
		const originalFetch = globalThis.fetch;
		const originalResendKey = process.env.RESEND_API_KEY;
		const originalFrom = process.env.CONTRACT_EMAIL_FROM;
		process.env.RESEND_API_KEY = "test-resend-key";
		process.env.CONTRACT_EMAIL_FROM = "contracts@tum-ai.com";
		globalThis.fetch = (async () =>
			new Response("provider unavailable", { status: 500 })) as typeof fetch;

		try {
			const response = await app.inject({
				method: "PATCH",
				url: `/api/contracts/submissions/${SUBMISSION_ID}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					status: "inquiry",
					feedback_message: "Please confirm the package.",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.status, "inquiry");
			assert.strictEqual(data.clarification_email_sent_at, null);
			assert.match(
				String(data.clarification_email_error),
				/Failed to send contract clarification email/,
			);
		} finally {
			globalThis.fetch = originalFetch;
			restoreEnv("RESEND_API_KEY", originalResendKey);
			restoreEnv("CONTRACT_EMAIL_FROM", originalFrom);
		}
	});

	test("sends a reviewed contract with OpenSign", async () => {
		resetDatabase();
		approveSeededSubmission();
		const originalFetch = globalThis.fetch;
		const originalOpenSignToken = process.env.OPENSIGN_API_TOKEN;
		const originalOpenSignBaseUrl = process.env.OPENSIGN_BASE_URL;
		const originalBaseUrl = process.env.APP_BASE_URL;
		const sentBodies: Array<Record<string, unknown>> = [];
		process.env.OPENSIGN_API_TOKEN = "test-opensign-token";
		process.env.OPENSIGN_BASE_URL = "https://opensign.test/api/v1.2";
		process.env.APP_BASE_URL = "https://member-manager.test";
		globalThis.fetch = (async (url, init) => {
			assert.strictEqual(
				String(url),
				"https://opensign.test/api/v1.2/createdocument",
			);
			assert.strictEqual(
				(init?.headers as Record<string, string>)["x-api-token"],
				"test-opensign-token",
			);
			sentBodies.push(JSON.parse(String(init?.body)));
			return new Response(
				JSON.stringify({
					objectId: "opensign-doc-123",
					status: "sent",
					file: "https://opensign.test/file.pdf",
				}),
				{ status: 200 },
			);
		}) as typeof fetch;

		try {
			const submission = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(submission);
			submission.form_data = {
				partner_company_name: "Partner GmbH",
				partner_contact_email: "partner@example.com",
			};

			const response = await app.inject({
				method: "PATCH",
				url: `/api/contracts/submissions/${SUBMISSION_ID}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					admin_edited_text: "Approved contract text",
					send_opensign: true,
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.status, "sent_to_partner");
			assert.strictEqual(data.signature_provider, "opensign");
			assert.strictEqual(data.opensign_document_id, "opensign-doc-123");
			assert.strictEqual(data.opensign_status, "sent");
			assert.strictEqual(
				data.opensign_file_url,
				"https://opensign.test/file.pdf",
			);
			assert.ok(data.opensign_sent_at);
			assert.match(data.signature_token, /^[a-f0-9]{64}$/);
			assert.strictEqual(sentBodies.length, 1);
			assert.strictEqual(sentBodies[0].name, "TUM.ai Contract - Partner GmbH");
			assert.match(
				String(sentBodies[0].file),
				/^data:application\/pdf;base64,/,
			);
			assert.strictEqual(sentBodies[0].send_email, true);
			assert.strictEqual(
				sentBodies[0].redirect_url,
				"https://member-manager.test/contracts",
			);
			const signer = (
				sentBodies[0].signers as Array<Record<string, unknown>>
			)[0];
			assert.strictEqual(signer.email, "partner@example.com");
			assert.strictEqual(signer.name, "Partner GmbH");
			assert.ok(Array.isArray(signer.widgets));
		} finally {
			globalThis.fetch = originalFetch;
			restoreEnv("OPENSIGN_API_TOKEN", originalOpenSignToken);
			restoreEnv("OPENSIGN_BASE_URL", originalOpenSignBaseUrl);
			restoreEnv("APP_BASE_URL", originalBaseUrl);
		}
	});

	test("does not mark a submission sent when OpenSign delivery fails", async () => {
		resetDatabase();
		approveSeededSubmission();
		const originalFetch = globalThis.fetch;
		const originalOpenSignToken = process.env.OPENSIGN_API_TOKEN;
		const originalOpenSignBaseUrl = process.env.OPENSIGN_BASE_URL;
		process.env.OPENSIGN_API_TOKEN = "test-opensign-token";
		process.env.OPENSIGN_BASE_URL = "https://opensign.test/api/v1.2";
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ message: "OpenSign unavailable" }), {
				status: 502,
			})) as typeof fetch;

		try {
			const submission = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(submission);
			submission.form_data = {
				partner_company_name: "Partner GmbH",
				partner_contact_email: "partner@example.com",
			};

			const response = await app.inject({
				method: "PATCH",
				url: `/api/contracts/submissions/${SUBMISSION_ID}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					admin_edited_text: "Approved contract text",
					send_opensign: true,
				}),
			});

			assert.strictEqual(response.statusCode, 502);
			assert.match(JSON.parse(response.payload).error, /OpenSign unavailable/);
			const updated = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(updated);
			assert.strictEqual(updated.status, "approved");
			assert.strictEqual(updated.sent_to_partner_at, null);
			assert.strictEqual(updated.opensign_document_id, null);
			assert.strictEqual(updated.opensign_error, "OpenSign unavailable");
		} finally {
			globalThis.fetch = originalFetch;
			restoreEnv("OPENSIGN_API_TOKEN", originalOpenSignToken);
			restoreEnv("OPENSIGN_BASE_URL", originalOpenSignBaseUrl);
		}
	});

	test("rejects OpenSign sending when the provider is not configured", async () => {
		resetDatabase();
		const originalOpenSignToken = process.env.OPENSIGN_API_TOKEN;
		delete process.env.OPENSIGN_API_TOKEN;

		try {
			const submission = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(submission);
			// Sending requires an approved contract first.
			submission.status = "approved";
			submission.form_data = {
				partner_company_name: "Partner GmbH",
				partner_contact_email: "partner@example.com",
			};

			const response = await app.inject({
				method: "PATCH",
				url: `/api/contracts/submissions/${SUBMISSION_ID}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					admin_edited_text: "Approved contract text",
					send_opensign: true,
				}),
			});

			assert.strictEqual(response.statusCode, 503);
			assert.match(JSON.parse(response.payload).error, /OpenSign sending/);
		} finally {
			restoreEnv("OPENSIGN_API_TOKEN", originalOpenSignToken);
		}
	});

	test("rejects OpenSign webhooks when the webhook secret is not configured", async () => {
		resetDatabase();
		const originalWebhookSecret = process.env.OPENSIGN_WEBHOOK_SECRET;
		delete process.env.OPENSIGN_WEBHOOK_SECRET;

		try {
			const response = await app.inject({
				method: "POST",
				url: "/api/webhooks/opensign",
				headers: {
					"content-type": "application/json",
					"x-webhook-signature": "anything",
				},
				payload: JSON.stringify({
					event: "completed",
					objectId: "opensign-doc-123",
				}),
			});

			assert.strictEqual(response.statusCode, 401);
		} finally {
			restoreEnv("OPENSIGN_WEBHOOK_SECRET", originalWebhookSecret);
		}
	});

	test("processes an OpenSign completion webhook", async () => {
		resetDatabase();
		const originalWebhookSecret = process.env.OPENSIGN_WEBHOOK_SECRET;
		const webhookSecret = "test-webhook-secret";
		process.env.OPENSIGN_WEBHOOK_SECRET = webhookSecret;
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.status = "sent_to_partner";
		submission.signature_provider = "opensign";
		submission.opensign_document_id = "opensign-doc-123";
		submission.opensign_status = "sent";

		try {
			const payload = {
				event: "completed",
				type: "request-sign",
				objectId: "opensign-doc-123",
				file: "https://opensign.test/signed.pdf",
				certificateUrl: "https://opensign.test/certificate.pdf",
			};
			const signature = createHmac("sha256", webhookSecret)
				.update(JSON.stringify(payload))
				.digest("hex");

			const response = await app.inject({
				method: "POST",
				url: "/api/webhooks/opensign",
				headers: {
					"content-type": "application/json",
					"x-webhook-signature": signature,
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 200);
			const updated = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(updated);
			assert.strictEqual(updated.status, "partner_signed");
			assert.strictEqual(updated.opensign_status, "completed");
			assert.strictEqual(
				updated.opensign_file_url,
				"https://opensign.test/signed.pdf",
			);
			assert.strictEqual(
				updated.opensign_certificate_url,
				"https://opensign.test/certificate.pdf",
			);
			assert.ok(updated.signed_at);
			assert.ok(updated.opensign_completed_at);
		} finally {
			restoreEnv("OPENSIGN_WEBHOOK_SECRET", originalWebhookSecret);
		}
	});

	test("does not regress completed submissions from late OpenSign webhooks", async () => {
		resetDatabase();
		const originalWebhookSecret = process.env.OPENSIGN_WEBHOOK_SECRET;
		const webhookSecret = "test-webhook-secret";
		process.env.OPENSIGN_WEBHOOK_SECRET = webhookSecret;
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.status = "completed";
		submission.signature_provider = "opensign";
		submission.opensign_document_id = "opensign-doc-123";
		submission.opensign_status = "sent";
		submission.signed_at = "2026-05-28T12:00:00Z";
		submission.opensign_error = null;
		submission.opensign_file_url = "https://opensign.test/signed.pdf";
		submission.opensign_certificate_url =
			"https://opensign.test/certificate.pdf";

		try {
			const payload = {
				event: "declined",
				type: "request-sign",
				objectId: "opensign-doc-123",
			};
			const signature = createHmac("sha256", webhookSecret)
				.update(JSON.stringify(payload))
				.digest("hex");

			const response = await app.inject({
				method: "POST",
				url: "/api/webhooks/opensign",
				headers: {
					"content-type": "application/json",
					"x-webhook-signature": signature,
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 200);
			const updated = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(updated);
			assert.strictEqual(updated.status, "completed");
			assert.strictEqual(updated.signed_at, "2026-05-28T12:00:00Z");
			assert.strictEqual(updated.opensign_status, "declined");
			assert.strictEqual(updated.opensign_error, null);
			assert.strictEqual(
				updated.opensign_file_url,
				"https://opensign.test/signed.pdf",
			);
			assert.strictEqual(
				updated.opensign_certificate_url,
				"https://opensign.test/certificate.pdf",
			);
		} finally {
			restoreEnv("OPENSIGN_WEBHOOK_SECRET", originalWebhookSecret);
		}
	});

	test("rejects OpenSign webhooks with invalid signatures", async () => {
		resetDatabase();
		const originalWebhookSecret = process.env.OPENSIGN_WEBHOOK_SECRET;
		process.env.OPENSIGN_WEBHOOK_SECRET = "test-webhook-secret";

		try {
			const response = await app.inject({
				method: "POST",
				url: "/api/webhooks/opensign",
				headers: {
					"content-type": "application/json",
					"x-webhook-signature": "bad-signature",
				},
				payload: JSON.stringify({
					event: "completed",
					objectId: "opensign-doc-123",
				}),
			});

			assert.strictEqual(response.statusCode, 401);
		} finally {
			restoreEnv("OPENSIGN_WEBHOOK_SECRET", originalWebhookSecret);
		}
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
		assert.strictEqual(mockDatabase.contract_partner_comments.length, 1);
		assert.strictEqual(
			mockDatabase.contract_partner_comments[0].submission_id,
			SUBMISSION_ID,
		);
		assert.strictEqual(
			mockDatabase.contract_partner_comments[0].author_type,
			"partner",
		);
		assert.strictEqual(
			mockDatabase.contract_partner_comments[0].comment,
			"Please adjust the scope.",
		);

		const updated = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(updated);
		assert.strictEqual(updated.signature_token, null);
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
			payload: JSON.stringify({
				comment: "Yes, I updated the contract accordingly.",
			}),
		});

		assert.strictEqual(createResponse.statusCode, 200);
		const created = JSON.parse(createResponse.payload);
		assert.strictEqual(created.author_type, "internal");
		assert.strictEqual(created.author_email, "admin@test.com");

		const listResponse = await app.inject({
			method: "GET",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/comments`,
			headers: authHeaders(testTokens.admin),
		});

		assert.strictEqual(listResponse.statusCode, 200);
		const comments = JSON.parse(listResponse.payload);
		assert.strictEqual(comments.length, 2);
		assert.strictEqual(
			comments[0].comment,
			"Can we use a different billing date?",
		);
		assert.strictEqual(
			comments[1].comment,
			"Yes, I updated the contract accordingly.",
		);
	});

	// Internal replies must never leak to the partner
	// via the public signing payload.
	test("excludes internal comments from the public signing payload", async () => {
		resetDatabase();
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.status = "sent_to_partner";
		submission.signature_token = "history-token";
		submission.signature_token_expires_at = "2099-01-01T00:00:00Z";
		mockDatabase.contract_partner_comments.push(
			{
				id: "comment-1",
				submission_id: SUBMISSION_ID,
				author_type: "partner",
				author_name: "Partner GmbH",
				author_email: "partner@example.com",
				comment: "Initial partner comment.",
				document_version_id: null,
				created_at: "2026-05-28T10:00:00Z",
			},
			{
				id: "comment-2",
				submission_id: SUBMISSION_ID,
				author_type: "internal",
				author_name: "admin@test.com",
				author_email: "admin@test.com",
				comment: "Internal reply.",
				document_version_id: null,
				created_at: "2026-05-28T11:00:00Z",
			},
		);

		const response = await app.inject({
			method: "GET",
			url: "/api/contracts/sign/history-token",
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.strictEqual(data.comments.length, 1);
		assert.strictEqual(data.comments[0].comment, "Initial partner comment.");
		assert.strictEqual(data.comments[0].author_type, "partner");
		assert.ok(
			!data.comments.some(
				(comment: { comment: string }) => comment.comment === "Internal reply.",
			),
		);
		assert.strictEqual(data.comments[0].id, undefined);
		assert.strictEqual(data.comments[0].author_email, undefined);
		assert.strictEqual(data.comments[0].submission_id, undefined);
		assert.strictEqual(data.comments[0].document_version_id, undefined);
	});

	test("includes legacy partner comments in the public signing payload", async () => {
		resetDatabase();
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.status = "sent_to_partner";
		submission.signature_token = "legacy-history-token";
		submission.signature_token_expires_at = "2099-01-01T00:00:00Z";
		submission.partner_comment = "Legacy partner feedback.";
		submission.partner_commented_at = "2026-05-28T09:00:00Z";
		submission.form_data = {
			partner_company_name: "Legacy Partner GmbH",
			partner_contact_email: "legacy-partner@example.com",
		};

		const response = await app.inject({
			method: "GET",
			url: "/api/contracts/sign/legacy-history-token",
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.strictEqual(data.comments.length, 1);
		assert.strictEqual(data.comments[0].comment, "Legacy partner feedback.");
		assert.strictEqual(data.comments[0].author_type, "partner");
		assert.strictEqual(data.comments[0].author_name, "Legacy Partner GmbH");
		assert.strictEqual(data.comments[0].id, undefined);
		assert.strictEqual(data.comments[0].author_email, undefined);
		assert.strictEqual(data.comments[0].submission_id, undefined);
		assert.strictEqual(data.comments[0].document_version_id, undefined);
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
		assert.match(
			String(pdfResponse.headers["content-disposition"]),
			/^inline; filename="contract-/,
		);
		assert.match(pdfResponse.payload.slice(0, 8), /^%PDF-1/);

		const downloadResponse = await app.inject({
			method: "GET",
			url: `/api/contracts/final/${finalData.final_pdf_token}/pdf?download=1`,
		});
		assert.strictEqual(downloadResponse.statusCode, 200);
		assert.match(
			String(downloadResponse.headers["content-disposition"]),
			/^attachment; filename="contract-/,
		);
	});

	// Sending requires an explicit approval first.
	test("blocks sending to the partner before approval", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({ send_to_partner: true }),
		});
		assert.strictEqual(response.statusCode, 400);
		assert.match(JSON.parse(response.payload).error, /must be approved/);
	});

	// Approving records a status event exposed via the status-events route.
	test("records a status event on approval", async () => {
		resetDatabase();
		const response = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({ status: "approved" }),
		});
		assert.strictEqual(response.statusCode, 200);
		const event = mockDatabase.contract_status_events.find(
			(row) => row.submission_id === SUBMISSION_ID,
		);
		assert.ok(event);
		assert.strictEqual(event.from_status, "legal_review");
		assert.strictEqual(event.to_status, "approved");

		const eventsResponse = await app.inject({
			method: "GET",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/status-events`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(eventsResponse.statusCode, 200);
		const events = JSON.parse(eventsResponse.payload);
		assert.ok(
			events.some((e: { to_status: string }) => e.to_status === "approved"),
		);
	});

	// Rejecting requires a reason, which is stored.
	test("requires a rejection reason and stores it", async () => {
		resetDatabase();
		const missing = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({ status: "rejected" }),
		});
		assert.strictEqual(missing.statusCode, 400);

		const rejected = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				status: "rejected",
				rejection_reason: "Budget not confirmed",
			}),
		});
		assert.strictEqual(rejected.statusCode, 200);
		const updated = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(updated);
		assert.strictEqual(updated.status, "rejected");
		assert.strictEqual(updated.rejection_reason, "Budget not confirmed");
	});

	// Clarification is closed once the contract is approved.
	test("blocks requesting clarification after approval", async () => {
		resetDatabase();
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.status = "approved";
		const response = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({ status: "inquiry" }),
		});
		assert.strictEqual(response.statusCode, 400);
		assert.match(JSON.parse(response.payload).error, /once the contract/);
	});

	// Public board-signing link flow.
	test("supports the public board-signing link flow", async () => {
		resetDatabase();
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.status = "partner_signed";
		submission.signer_name = "Jane Signer";
		submission.signed_at = "2026-05-28T12:00:00Z";

		const genResponse = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({ generate_board_signature_token: true }),
		});
		assert.strictEqual(genResponse.statusCode, 200);
		const token = JSON.parse(genResponse.payload).board_signature_token;
		assert.match(String(token), /^[a-f0-9]{64}$/);

		const payloadResponse = await app.inject({
			method: "GET",
			url: `/api/contracts/board-sign/${token}`,
		});
		assert.strictEqual(payloadResponse.statusCode, 200);
		assert.ok(Array.isArray(JSON.parse(payloadResponse.payload).pages));

		const signResponse = await app.inject({
			method: "POST",
			url: `/api/contracts/board-sign/${token}`,
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				signature_data: "data:image/png;base64,CCCC",
				signer_name: "Board Member",
			}),
		});
		assert.strictEqual(signResponse.statusCode, 200);
		const updated = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(updated);
		assert.strictEqual(updated.status, "board_signed");
		assert.strictEqual(updated.admin_signer_name, "Board Member");
		assert.ok(updated.admin_signed_at);
		assert.strictEqual(updated.board_signature_token, null);
	});

	// The initial status is recorded so the timeline starts at
	// the submission itself.
	test("records an initial status event on submission creation", async () => {
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
		const event = mockDatabase.contract_status_events.find(
			(row) => row.submission_id === data.id,
		);
		assert.ok(event);
		assert.strictEqual(event.from_status, null);
		assert.strictEqual(event.to_status, "legal_review");
	});

	// Submitting a draft records the draft -> legal_review event.
	test("records a status event when a draft is submitted", async () => {
		resetDatabase();
		moveRegularUserToPartnersAndSponsors();

		const createResponse = await app.inject({
			method: "POST",
			url: "/api/contracts/submissions",
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				template_id: TEMPLATE_ID,
				form_data: { partner_name: "Draft GmbH" },
				status: "draft",
			}),
		});
		assert.strictEqual(createResponse.statusCode, 200);
		const draft = JSON.parse(createResponse.payload);
		const draftEvent = mockDatabase.contract_status_events.find(
			(row) => row.submission_id === draft.id,
		);
		assert.ok(draftEvent);
		assert.strictEqual(draftEvent.from_status, null);
		assert.strictEqual(draftEvent.to_status, "draft");

		const submitResponse = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${draft.id}/draft`,
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				form_data: { partner_name: "Draft GmbH" },
				status: "submitted",
			}),
		});
		assert.strictEqual(submitResponse.statusCode, 200);
		const submitEvent = mockDatabase.contract_status_events.find(
			(row) =>
				row.submission_id === draft.id && row.to_status === "legal_review",
		);
		assert.ok(submitEvent);
		assert.strictEqual(submitEvent.from_status, "draft");
	});

	// A contract already sent to the partner can be re-sent via a
	// different delivery channel.
	test("allows re-sending to the partner from sent_to_partner", async () => {
		resetDatabase();
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.status = "sent_to_partner";

		const response = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({ send_to_partner: true }),
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.strictEqual(data.status, "sent_to_partner");
		assert.match(data.signature_token, /^[a-f0-9]{64}$/);
	});

	// Manual dropdown changes are tagged in the status event so
	// the timeline can phrase them distinctly.
	test("tags manual status changes with a Manual override note", async () => {
		resetDatabase();

		const response = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				status: "in_review",
				manual_status_change: true,
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const event = mockDatabase.contract_status_events.find(
			(row) =>
				row.submission_id === SUBMISSION_ID && row.to_status === "in_review",
		);
		assert.ok(event);
		assert.strictEqual(event.note, "Manual override");
	});

	// Button-driven changes stay untagged.
	test("does not tag button-driven status changes as manual", async () => {
		resetDatabase();

		const response = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({ status: "approved" }),
		});

		assert.strictEqual(response.statusCode, 200);
		const event = mockDatabase.contract_status_events.find(
			(row) =>
				row.submission_id === SUBMISSION_ID && row.to_status === "approved",
		);
		assert.ok(event);
		assert.strictEqual(event.note, null);
	});

	// EMAIL-typed template variables get format validation.
	test("rejects malformed EMAIL variables on submission", async () => {
		resetDatabase();
		moveRegularUserToPartnersAndSponsors();
		mockDatabase.contract_template_variables.push({
			id: "22222222-2222-4222-8222-222222222222",
			template_id: TEMPLATE_ID,
			variable_name: "partner_contact_email",
			label: "Partner contact email",
			data_type: "EMAIL",
			help_text: null,
			options: null,
			is_required: true,
			is_multiselect: false,
			show_if_variable: null,
			show_if_value: null,
			sort_order: 10,
		});

		const invalid = await app.inject({
			method: "POST",
			url: "/api/contracts/submissions",
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				template_id: TEMPLATE_ID,
				form_data: {
					partner_name: "Partner GmbH",
					partner_contact_email: "not-an-email",
				},
				status: "submitted",
			}),
		});
		assert.strictEqual(invalid.statusCode, 400);
		assert.match(
			JSON.parse(invalid.payload).error,
			/Invalid email address in: Partner contact email/,
		);

		const valid = await app.inject({
			method: "POST",
			url: "/api/contracts/submissions",
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				template_id: TEMPLATE_ID,
				form_data: {
					partner_name: "Partner GmbH",
					partner_contact_email: "partner@example.com",
				},
				status: "submitted",
			}),
		});
		assert.strictEqual(valid.statusCode, 200);
	});

	// The reserved signature tokens survive rendering so the PDF
	// generator can substitute the images at that position.
	test("preserves reserved signature tokens in rendered contract text", async () => {
		resetDatabase();
		moveRegularUserToPartnersAndSponsors();
		const template = mockDatabase.contract_templates.find(
			(row) => row.id === TEMPLATE_ID,
		);
		assert.ok(template);
		template.contract_text =
			"Hello {{partner_name}}\n\nSign here:\n\n{{partner_signature}}\n\n{{board_signature}}";

		const response = await app.inject({
			method: "POST",
			url: "/api/contracts/submissions",
			headers: {
				...authHeaders(testTokens.user),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				template_id: TEMPLATE_ID,
				form_data: { partner_name: "Token GmbH" },
				status: "submitted",
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const data = JSON.parse(response.payload);
		assert.match(data.generated_contract_text, /Hello Token GmbH/);
		assert.match(data.generated_contract_text, /\{\{partner_signature\}\}/);
		assert.match(data.generated_contract_text, /\{\{board_signature\}\}/);
	});

	// With the opt-in flag set, a board signature finalizes the
	// contract and emails the partner the final signed copy.
	test("auto-sends the final contract after board signature when opted in", async () => {
		resetDatabase();
		const originalFetch = globalThis.fetch;
		const originalResendKey = process.env.RESEND_API_KEY;
		const originalFrom = process.env.CONTRACT_EMAIL_FROM;
		const originalBaseUrl = process.env.APP_BASE_URL;
		const sentBodies: Array<Record<string, unknown>> = [];
		process.env.RESEND_API_KEY = "test-resend-key";
		process.env.CONTRACT_EMAIL_FROM = "contracts@tum-ai.com";
		process.env.APP_BASE_URL = "https://member-manager.test";
		globalThis.fetch = (async (_url, init) => {
			sentBodies.push(JSON.parse(String(init?.body)));
			return new Response(JSON.stringify({ id: "email-789" }), {
				status: 200,
			});
		}) as typeof fetch;

		try {
			const submission = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(submission);
			submission.status = "partner_signed";
			submission.signer_name = "Jane Signer";
			submission.signed_at = "2026-07-01T12:00:00Z";
			submission.auto_send_after_board_signed = true;
			submission.board_signature_token = "board-token-auto";
			submission.board_signature_token_expires_at = "2099-01-01T00:00:00Z";
			submission.form_data = {
				partner_company_name: "Partner GmbH",
				partner_contact_email: "partner@example.com",
			};

			const response = await app.inject({
				method: "POST",
				url: "/api/contracts/board-sign/board-token-auto",
				headers: { "content-type": "application/json" },
				payload: JSON.stringify({
					signature_data: "data:image/png;base64,BBBB",
					signer_name: "Board Member",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const updated = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(updated);
			assert.strictEqual(updated.status, "completed");
			assert.match(String(updated.final_pdf_token), /^[a-f0-9]{64}$/);
			assert.ok(updated.final_document_version_id);
			assert.strictEqual(
				updated.partner_email_recipient,
				"partner@example.com",
			);
			assert.ok(updated.partner_email_sent_at);
			const partnerBody = sentBodies.find(
				(body) => body.to === "partner@example.com",
			);
			assert.ok(partnerBody);
			assert.match(
				String(partnerBody.text),
				/https:\/\/member-manager\.test\/api\/contracts\/final\/[a-f0-9]{64}\/pdf/,
			);
			// The recipient gets an already signed copy, not a signing request.
			assert.match(String(partnerBody.html), /View signed contract/);
			assert.doesNotMatch(String(partnerBody.html), /Review and sign/);
			const finalVersion = mockDatabase.contract_document_versions.find(
				(row) => row.submission_id === SUBMISSION_ID && row.source === "final",
			);
			assert.ok(finalVersion);
		} finally {
			globalThis.fetch = originalFetch;
			restoreEnv("RESEND_API_KEY", originalResendKey);
			restoreEnv("CONTRACT_EMAIL_FROM", originalFrom);
			restoreEnv("APP_BASE_URL", originalBaseUrl);
		}
	});

	// Without the flag, board signing keeps the manual flow.
	test("keeps the manual flow when auto-send is disabled", async () => {
		resetDatabase();
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.status = "partner_signed";
		submission.signer_name = "Jane Signer";
		submission.signed_at = "2026-07-01T12:00:00Z";
		submission.auto_send_after_board_signed = false;
		submission.board_signature_token = "board-token-manual";
		submission.board_signature_token_expires_at = "2099-01-01T00:00:00Z";

		const response = await app.inject({
			method: "POST",
			url: "/api/contracts/board-sign/board-token-manual",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({
				signature_data: "data:image/png;base64,BBBB",
				signer_name: "Board Member",
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const updated = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(updated);
		assert.strictEqual(updated.status, "board_signed");
	});

	// Unconfigured email must never block the board signature —
	// the submission stays at board_signed for the manual flow.
	test("skips auto-send when email is not configured", async () => {
		resetDatabase();
		const originalResendKey = process.env.RESEND_API_KEY;
		const originalFrom = process.env.CONTRACT_EMAIL_FROM;
		delete process.env.RESEND_API_KEY;
		delete process.env.CONTRACT_EMAIL_FROM;

		try {
			const submission = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(submission);
			submission.status = "partner_signed";
			submission.signer_name = "Jane Signer";
			submission.signed_at = "2026-07-01T12:00:00Z";
			submission.auto_send_after_board_signed = true;
			submission.board_signature_token = "board-token-noemail";
			submission.board_signature_token_expires_at = "2099-01-01T00:00:00Z";
			submission.form_data = {
				partner_company_name: "Partner GmbH",
				partner_contact_email: "partner@example.com",
			};

			const response = await app.inject({
				method: "POST",
				url: "/api/contracts/board-sign/board-token-noemail",
				headers: { "content-type": "application/json" },
				payload: JSON.stringify({
					signature_data: "data:image/png;base64,BBBB",
					signer_name: "Board Member",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const updated = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(updated);
			assert.strictEqual(updated.status, "board_signed");
		} finally {
			restoreEnv("RESEND_API_KEY", originalResendKey);
			restoreEnv("CONTRACT_EMAIL_FROM", originalFrom);
		}
	});

	// The flag itself is toggled via the admin PATCH.
	test("toggles auto_send_after_board_signed via PATCH", async () => {
		resetDatabase();

		const response = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({ auto_send_after_board_signed: true }),
		});

		assert.strictEqual(response.statusCode, 200);
		const updated = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(updated);
		assert.strictEqual(updated.auto_send_after_board_signed, true);
	});

	// A failed final email must not strand the contract at completed —
	// it stays board_signed so the manual finalize flow can retry.
	test("keeps board_signed when the auto-send email fails", async () => {
		resetDatabase();
		const originalFetch = globalThis.fetch;
		const originalResendKey = process.env.RESEND_API_KEY;
		const originalFrom = process.env.CONTRACT_EMAIL_FROM;
		process.env.RESEND_API_KEY = "test-resend-key";
		process.env.CONTRACT_EMAIL_FROM = "contracts@tum-ai.com";
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ message: "boom" }), {
				status: 500,
			})) as typeof fetch;

		try {
			const submission = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(submission);
			submission.status = "partner_signed";
			submission.signer_name = "Jane Signer";
			submission.signed_at = "2026-07-01T12:00:00Z";
			submission.auto_send_after_board_signed = true;
			submission.board_signature_token = "board-token-fail";
			submission.board_signature_token_expires_at = "2099-01-01T00:00:00Z";
			submission.form_data = {
				partner_company_name: "Partner GmbH",
				partner_contact_email: "partner@example.com",
			};

			const response = await app.inject({
				method: "POST",
				url: "/api/contracts/board-sign/board-token-fail",
				headers: { "content-type": "application/json" },
				payload: JSON.stringify({
					signature_data: "data:image/png;base64,BBBB",
					signer_name: "Board Member",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const updated = mockDatabase.contract_submissions.find(
				(row) => row.id === SUBMISSION_ID,
			);
			assert.ok(updated);
			assert.strictEqual(updated.status, "board_signed");
			assert.match(String(updated.partner_email_error), /500/);
			assert.strictEqual(updated.partner_email_sent_at, null);
			const completedEvent = mockDatabase.contract_status_events.find(
				(row) =>
					row.submission_id === SUBMISSION_ID && row.to_status === "completed",
			);
			assert.strictEqual(completedEvent, undefined);
		} finally {
			globalThis.fetch = originalFetch;
			restoreEnv("RESEND_API_KEY", originalResendKey);
			restoreEnv("CONTRACT_EMAIL_FROM", originalFrom);
		}
	});

	// Manual overrides are limited to review statuses on both ends.
	test("rejects manual status changes outside review statuses", async () => {
		resetDatabase();
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);

		// From a post-send status: rejected even for a review target.
		submission.status = "sent_to_partner";
		const fromSent = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				status: "in_review",
				manual_status_change: true,
			}),
		});
		assert.strictEqual(fromSent.statusCode, 400);

		// To a signing status: an unsigned contract cannot be marked completed.
		submission.status = "legal_review";
		const toCompleted = await app.inject({
			method: "PATCH",
			url: `/api/contracts/submissions/${SUBMISSION_ID}`,
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				status: "completed",
				manual_status_change: true,
			}),
		});
		assert.strictEqual(toCompleted.statusCode, 400);
		const unchanged = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(unchanged);
		assert.strictEqual(unchanged.status, "legal_review");
	});

	// Regenerating the final PDF must invalidate the old link and rebuild
	// from the source text instead of stacking signature sections.
	test("regenerates the final PDF with a new token and clean text", async () => {
		resetDatabase();
		const submission = mockDatabase.contract_submissions.find(
			(row) => row.id === SUBMISSION_ID,
		);
		assert.ok(submission);
		submission.status = "board_signed";
		submission.signer_name = "Jane Signer";
		submission.signed_at = "2026-07-01T12:00:00Z";
		submission.admin_signer_name = "Board Member";
		submission.admin_signed_at = "2026-07-02T12:00:00Z";

		const first = await app.inject({
			method: "POST",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/finalize`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(first.statusCode, 200);
		const firstToken = JSON.parse(first.payload).final_pdf_token;

		const second = await app.inject({
			method: "POST",
			url: `/api/contracts/submissions/${SUBMISSION_ID}/finalize`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(second.statusCode, 200);
		const secondData = JSON.parse(second.payload);
		assert.notStrictEqual(secondData.final_pdf_token, firstToken);

		const finalVersion = mockDatabase.contract_document_versions.find(
			(row) => row.id === secondData.final_document_version_id,
		);
		assert.ok(finalVersion);
		const signatureSections = String(finalVersion.rendered_text).match(
			/Signaturen/g,
		);
		assert.strictEqual(signatureSections?.length, 1);

		// The old link no longer serves the PDF.
		const oldLink = await app.inject({
			method: "GET",
			url: `/api/contracts/final/${firstToken}/pdf`,
		});
		assert.strictEqual(oldLink.statusCode, 404);
	});

	// Internal comments store a display name, not the raw email.
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
		assert.strictEqual(response.statusCode, 200);
		const comment = mockDatabase.contract_partner_comments.find(
			(row) => row.submission_id === SUBMISSION_ID,
		);
		assert.ok(comment);
		assert.strictEqual(comment.author_type, "internal");
		// The mocked admin member resolves to a name rather than an email.
		assert.doesNotMatch(String(comment.author_name), /@/);
	});
});
