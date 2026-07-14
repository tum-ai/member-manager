import {
	CONTRACT_CONDITION_TYPES,
	CONTRACT_DATA_TYPES,
	CONTRACT_REVIEW_STATUSES,
} from "@member-manager/shared";
import { z } from "zod";

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
			"Variable name must be alphanumeric/underscore",
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
