import { z } from "zod";

export const JOB_TYPES = [
	"internship",
	"working_student",
	"full_time",
	"thesis",
	"other",
] as const;
export const jobTypeSchema = z.enum(JOB_TYPES);
export type JobType = z.infer<typeof jobTypeSchema>;

const optionalHttpUrlSchema = z
	.union([
		z
			.string()
			.trim()
			.url("Enter a valid URL including https://.")
			.refine(
				(value) => /^https?:\/\//i.test(value),
				"Must be a valid HTTP or HTTPS URL.",
			),
		z.literal(""),
		z.null(),
	])
	.optional()
	.transform((value) => value || null);

const optionalTextSchema = z
	.union([z.string().trim().max(140), z.null()])
	.optional()
	.transform((value) => value || null);

const optionalExpiresAtSchema = z
	.union([z.string().trim(), z.null()])
	.optional()
	.transform((value, context) => {
		if (!value) return null;
		const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
			? `${value}T23:59:59.000Z`
			: value;
		const date = new Date(normalized);
		if (Number.isNaN(date.getTime())) {
			context.addIssue({
				code: "custom",
				message: "Enter a valid expiration date.",
			});
			return z.NEVER;
		}
		return date.toISOString();
	});

export const jobPostingInputSchema = z.object({
	title: z.string().trim().min(3, "Job title is required.").max(140),
	organization_name: z
		.string()
		.trim()
		.min(2, "Organization is required.")
		.max(140),
	logo_url: optionalHttpUrlSchema,
	description_markdown: z
		.string()
		.trim()
		.min(20, "Describe the role in at least 20 characters.")
		.max(5_000),
	call_to_action: z
		.union([z.string().trim().max(80), z.null()])
		.optional()
		.transform((value) => value || "Apply now"),
	job_type: jobTypeSchema,
	location: z.string().trim().min(2, "Location is required.").max(140),
	contact_name: z.string().trim().min(2, "Contact name is required.").max(140),
	contact_email: z
		.string()
		.trim()
		.email("Enter a valid contact email.")
		.max(254),
	contact_role: optionalTextSchema,
	external_url: optionalHttpUrlSchema,
	expires_at: optionalExpiresAtSchema,
});
export type JobPostingFormInput = z.input<typeof jobPostingInputSchema>;
export type JobPostingInput = z.output<typeof jobPostingInputSchema>;

export const jobPostingReviewSchema = z.object({
	decision: z.enum(["approved", "rejected"]),
	review_note: z.string().trim().min(1).max(500).optional(),
});
export type JobPostingReview = z.infer<typeof jobPostingReviewSchema>;

export const jobPostingRequestSchema = jobPostingInputSchema.extend({
	id: z.string(),
	source: z.enum(["member_manager", "partner_portal"]).optional(),
	user_id: z.string().nullable(),
	status: z.enum(["pending", "approved", "rejected"]),
	review_note: z.string().nullable().optional(),
	reviewed_by: z.string().nullable().optional(),
	reviewed_at: z.string().nullable().optional(),
	published_at: z.string().nullable().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
});
export type JobPostingRequest = z.infer<typeof jobPostingRequestSchema>;
