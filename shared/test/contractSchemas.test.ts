import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	ContractSubmissionAdminDetailSchema,
	ContractSubmissionCreatorDetailSchema,
	SubmissionBodySchema,
	SubmissionPatchSchema,
	VariableBodySchema,
} from "../dist/contractSchemas.js";

function adminSubmissionFixture(): Record<string, unknown> {
	return {
		id: "submission-1",
		template_id: "template-1",
		submitter_user_id: "user-1",
		form_data: { partner_name: "Partner GmbH" },
		generated_contract_text: "Contract",
		admin_edited_text: null,
		status: "legal_review",
		notes: "Internal",
		auto_send_after_board_signed: false,
		feedback_message: null,
		rejection_reason: null,
		signature_token: "partner-token",
		signature_token_expires_at: "2026-08-01T00:00:00Z",
		signature_data: null,
		signer_name: null,
		signed_at: null,
		admin_signature_data: null,
		admin_signer_name: null,
		admin_signed_at: null,
		board_signature_token: "board-token",
		board_signature_token_expires_at: "2026-08-01T00:00:00Z",
		partner_comment: null,
		partner_commented_at: null,
		sent_to_partner_at: null,
		partner_email_sent_at: null,
		partner_email_recipient: null,
		partner_email_error: null,
		clarification_email_sent_at: null,
		clarification_email_recipient: null,
		clarification_email_error: null,
		signature_provider: "in_app",
		opensign_document_id: null,
		opensign_status: null,
		opensign_sent_at: null,
		opensign_completed_at: null,
		opensign_file_url: null,
		opensign_certificate_url: null,
		opensign_error: null,
		final_pdf_token: null,
		final_pdf_sent_at: null,
		completed_at: null,
		active_document_version_id: null,
		sent_document_version_id: null,
		final_document_version_id: null,
		submitted_at: "2026-07-15T00:00:00Z",
		created_at: "2026-07-15T00:00:00Z",
		updated_at: "2026-07-15T00:00:00Z",
	};
}

describe("contract schemas", () => {
	test("applies submission defaults and rejects no-op review patches", () => {
		const submission = SubmissionBodySchema.parse({
			template_id: "11111111-1111-4111-8111-111111111111",
			form_data: {},
		});

		assert.equal(submission.status, "submitted");
		assert.equal(SubmissionPatchSchema.safeParse({}).success, false);
	});

	test("preserves legacy variable options while sharing the input contract", () => {
		assert.equal(
			VariableBodySchema.safeParse({
				variable_name: "partner_name",
				label: "Partner name",
				options: "one,two",
			}).success,
			true,
		);
	});

	test("explains that variable names must start with a letter", () => {
		const result = VariableBodySchema.safeParse({
			variable_name: "_partner_name",
			label: "Partner name",
		});

		assert.equal(result.success, false);
		if (!result.success) {
			assert.match(
				result.error.issues[0]?.message ?? "",
				/start with a letter/,
			);
		}
	});

	test("models admin and creator detail responses separately", () => {
		const admin = adminSubmissionFixture();
		assert.equal(
			ContractSubmissionAdminDetailSchema.safeParse(admin).success,
			true,
		);

		const {
			notes: _notes,
			signature_token: _signatureToken,
			signature_token_expires_at: _signatureTokenExpiresAt,
			board_signature_token: _boardSignatureToken,
			board_signature_token_expires_at: _boardSignatureTokenExpiresAt,
			...creator
		} = admin;

		assert.equal(
			ContractSubmissionCreatorDetailSchema.safeParse(creator).success,
			true,
		);
		assert.equal(
			ContractSubmissionAdminDetailSchema.safeParse(creator).success,
			false,
		);
	});
});
