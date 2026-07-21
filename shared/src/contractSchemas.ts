import { z } from "zod";
import {
	CONTRACT_CONDITION_TYPES,
	CONTRACT_DATA_TYPES,
	CONTRACT_REVIEW_STATUSES,
	CONTRACT_WORKFLOW_STATUSES,
} from "./contracts.js";

export const TemplateBodySchema = z.object({
	name: z.string().trim().min(1).max(200),
	description: z.string().trim().max(2000).nullable().optional(),
	contract_text: z.string().max(200_000).default(""),
	is_active: z.boolean().optional().default(true),
});

export const VariableBodySchema = z.object({
	variable_name: z
		.string()
		.trim()
		.regex(
			/^[a-zA-Z][a-zA-Z0-9_]*$/,
			"Variable name must start with a letter and contain only letters, digits, or underscores",
		)
		.max(80),
	label: z.string().trim().min(1).max(200),
	data_type: z.enum(CONTRACT_DATA_TYPES).default("TEXT"),
	help_text: z.string().trim().max(1000).nullable().optional(),
	options: z.unknown().nullable().optional(),
	is_required: z.boolean().optional().default(false),
	is_multiselect: z.boolean().optional().default(false),
	show_if_variable: z.string().trim().max(80).nullable().optional(),
	show_if_value: z.string().trim().max(200).nullable().optional(),
	sort_order: z.number().int().min(0).max(10_000).optional().default(0),
});

export const ConditionalBlockBodySchema = z.object({
	name: z.string().trim().min(1).max(200),
	condition_type: z.enum(CONTRACT_CONDITION_TYPES).default("ALWAYS"),
	condition_variable: z.string().trim().max(80).nullable().optional(),
	condition_value: z.string().trim().max(500).nullable().optional(),
	block_text: z.string().max(50_000).default(""),
	sort_order: z.number().int().min(0).max(10_000).optional().default(0),
});

export const SubmissionBodySchema = z.object({
	template_id: z.string().uuid(),
	form_data: z.record(z.string(), z.unknown()),
	status: z.enum(["draft", "submitted"]).optional().default("submitted"),
});

export const DraftSubmissionPatchSchema = z.object({
	form_data: z.record(z.string(), z.unknown()),
	status: z.enum(["draft", "submitted"]).optional().default("draft"),
});

export const PreviewBodySchema = z.object({
	form_data: z.record(z.string(), z.unknown()),
});

export const TextPreviewBodySchema = z.object({
	contract_text: z.string().max(250_000),
});

export const PdfDownloadQuerySchema = z.object({
	download: z.string().optional(),
});

export const SubmissionPatchSchema = z
	.object({
		status: z.enum(CONTRACT_REVIEW_STATUSES).optional(),
		manual_status_change: z.boolean().optional(),
		admin_edited_text: z.string().max(200_000).nullable().optional(),
		notes: z.string().max(5000).nullable().optional(),
		feedback_message: z.string().max(5000).nullable().optional(),
		rejection_reason: z.string().max(5000).nullable().optional(),
		generate_signature_token: z.boolean().optional(),
		generate_board_signature_token: z.boolean().optional(),
		send_to_partner: z.boolean().optional(),
		send_partner_email: z.boolean().optional(),
		send_opensign: z.boolean().optional(),
		auto_send_after_board_signed: z.boolean().optional(),
		partner_email_subject: z.string().trim().max(300).nullable().optional(),
		partner_email_message: z.string().trim().max(5000).nullable().optional(),
		signature_token_ttl_hours: z.number().int().min(1).max(720).optional(),
	})
	.refine(
		(value) =>
			value.status !== undefined ||
			value.admin_edited_text !== undefined ||
			value.notes !== undefined ||
			value.feedback_message !== undefined ||
			value.rejection_reason !== undefined ||
			value.generate_signature_token === true ||
			value.generate_board_signature_token === true ||
			value.send_to_partner === true ||
			value.send_partner_email === true ||
			value.send_opensign === true ||
			value.auto_send_after_board_signed !== undefined,
		{ message: "No-op patch" },
	)
	.refine(
		(value) =>
			value.status !== "rejected" ||
			(value.rejection_reason?.trim().length ?? 0) > 0,
		{
			message: "A rejection reason is required when rejecting a contract",
			path: ["rejection_reason"],
		},
	);

export const SignBodySchema = z.object({
	signature_data: z.string().min(1).max(2_000_000),
	signer_name: z.string().trim().min(1).max(200),
});

export const CommentBodySchema = z.object({
	comment: z.string().trim().min(1).max(5000),
});

export const OpenSignWebhookSchema = z
	.object({
		event: z.string().trim().max(100).optional(),
		type: z.string().trim().max(100).optional(),
		objectId: z.string().trim().max(200).optional(),
		file: z.string().trim().max(4000).optional(),
		certificate: z.string().trim().max(4000).optional(),
		certificateUrl: z.string().trim().max(4000).optional(),
	})
	.passthrough();

const nullableString = z.string().nullable();

const ContractSubmissionDetailBaseSchema = z.object({
	id: z.string(),
	template_id: z.string(),
	submitter_user_id: z.string(),
	form_data: z.record(z.string(), z.unknown()),
	generated_contract_text: nullableString,
	admin_edited_text: nullableString,
	status: z.enum(CONTRACT_WORKFLOW_STATUSES),
	feedback_message: nullableString,
	rejection_reason: nullableString,
	signature_data: nullableString,
	signer_name: nullableString,
	signed_at: nullableString,
	admin_signature_data: nullableString,
	admin_signer_name: nullableString,
	admin_signed_at: nullableString,
	partner_comment: nullableString,
	partner_commented_at: nullableString,
	sent_to_partner_at: nullableString,
	partner_email_sent_at: nullableString,
	partner_email_recipient: nullableString,
	partner_email_error: nullableString,
	clarification_email_sent_at: nullableString,
	clarification_email_recipient: nullableString,
	clarification_email_error: nullableString,
	signature_provider: z.enum(["in_app", "opensign"]),
	opensign_document_id: nullableString,
	opensign_status: nullableString,
	opensign_sent_at: nullableString,
	opensign_completed_at: nullableString,
	opensign_file_url: nullableString,
	opensign_certificate_url: nullableString,
	opensign_error: nullableString,
	final_pdf_token: nullableString,
	final_pdf_sent_at: nullableString,
	completed_at: nullableString,
	active_document_version_id: nullableString,
	sent_document_version_id: nullableString,
	final_document_version_id: nullableString,
	submitted_at: z.string(),
	created_at: z.string(),
	updated_at: z.string(),
});

export const ContractSubmissionAdminDetailSchema =
	ContractSubmissionDetailBaseSchema.extend({
		notes: nullableString,
		auto_send_after_board_signed: z.boolean().optional().default(false),
		signature_token: nullableString,
		signature_token_expires_at: nullableString,
		board_signature_token: nullableString,
		board_signature_token_expires_at: nullableString,
	});

export const ContractSubmissionCreatorDetailSchema =
	ContractSubmissionDetailBaseSchema;

export const ContractSubmissionDetailSchema = z.union([
	ContractSubmissionAdminDetailSchema,
	ContractSubmissionCreatorDetailSchema,
]);

const ContractSubmissionSummaryBaseSchema = z.object({
	id: z.string(),
	template_id: z.string(),
	submitter_user_id: z.string(),
	status: z.enum(CONTRACT_WORKFLOW_STATUSES),
	submitted_at: z.string(),
	signed_at: nullableString,
	admin_signed_at: nullableString,
	final_pdf_token: nullableString,
	final_pdf_sent_at: nullableString,
	partner_email_sent_at: nullableString,
	partner_email_recipient: nullableString,
	partner_email_error: nullableString,
	clarification_email_sent_at: nullableString,
	clarification_email_recipient: nullableString,
	clarification_email_error: nullableString,
	signature_provider: z.enum(["in_app", "opensign"]),
	opensign_document_id: nullableString,
	opensign_status: nullableString,
	opensign_sent_at: nullableString,
	opensign_completed_at: nullableString,
	opensign_file_url: nullableString,
	opensign_certificate_url: nullableString,
	opensign_error: nullableString,
	created_at: z.string(),
	updated_at: z.string(),
});

export const ContractSubmissionAdminSummarySchema =
	ContractSubmissionSummaryBaseSchema.extend({
		signature_token: nullableString,
		signature_token_expires_at: nullableString,
	});

export const ContractSubmissionCreatorSummarySchema =
	ContractSubmissionSummaryBaseSchema;

export const ContractSubmissionSummarySchema = z.union([
	ContractSubmissionAdminSummarySchema,
	ContractSubmissionCreatorSummarySchema,
]);

export type ContractTemplateInput = z.input<typeof TemplateBodySchema>;
export type ContractTemplateVariableInput = z.input<typeof VariableBodySchema>;
export type ContractConditionalBlockInput = z.input<
	typeof ConditionalBlockBodySchema
>;
export type ContractSubmissionInput = z.input<typeof SubmissionBodySchema>;
export type ContractDraftSubmissionInput = z.input<
	typeof DraftSubmissionPatchSchema
>;
export type ContractSubmissionUpdateInput = z.input<
	typeof SubmissionPatchSchema
>;
export type ContractSignatureInput = z.input<typeof SignBodySchema>;
export type ContractCommentInput = z.input<typeof CommentBodySchema>;
export type ContractSubmissionAdminDetail = z.infer<
	typeof ContractSubmissionAdminDetailSchema
>;
export type ContractSubmissionCreatorDetail = z.infer<
	typeof ContractSubmissionCreatorDetailSchema
>;
export type ContractSubmission = ContractSubmissionCreatorDetail &
	Partial<
		Pick<
			ContractSubmissionAdminDetail,
			| "notes"
			| "auto_send_after_board_signed"
			| "signature_token"
			| "signature_token_expires_at"
			| "board_signature_token"
			| "board_signature_token_expires_at"
		>
	>;
export type ContractSubmissionAdminSummary = z.infer<
	typeof ContractSubmissionAdminSummarySchema
>;
export type ContractSubmissionCreatorSummary = z.infer<
	typeof ContractSubmissionCreatorSummarySchema
>;
export type ContractSubmissionSummary = ContractSubmissionCreatorSummary &
	Partial<
		Pick<
			ContractSubmissionAdminSummary,
			"signature_token" | "signature_token_expires_at"
		>
	>;
