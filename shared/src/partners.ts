import { z } from "zod";
import { JOB_TYPES, jobTypeSchema } from "./jobs.js";

export const PARTNER_KINDS = ["tier_subscriber", "single_job_buyer"] as const;
export const partnerKindSchema = z.enum(PARTNER_KINDS);
export type PartnerKind = z.infer<typeof partnerKindSchema>;

export const PARTNER_STATUSES = [
	"invited",
	"active",
	"expired",
	"archived",
] as const;
export const partnerStatusSchema = z.enum(PARTNER_STATUSES);
export type PartnerStatus = z.infer<typeof partnerStatusSchema>;

const companyNameSchema = z
	.string()
	.trim()
	.min(2, "Company name is required.")
	.max(120);
const tierIdSchema = z.string().uuid("Select a tier.");
const contractDateSchema = z.iso.date();
const websiteUrlSchema = z
	.union([
		z.string().trim().url("Enter a valid URL including https://."),
		z.literal(""),
	])
	.optional();
const notesSchema = z
	.string()
	.trim()
	.max(2000, "Notes are too long.")
	.optional();

const partnerFieldsSchema = z.object({
	companyName: companyNameSchema,
	tierId: tierIdSchema,
	contractStart: contractDateSchema,
	contractEnd: contractDateSchema,
	partnerKind: partnerKindSchema,
	websiteUrl: websiteUrlSchema,
	notes: notesSchema,
});

function contractEndsAfterStart(data: {
	contractStart: string;
	contractEnd: string;
}): boolean {
	return data.contractEnd > data.contractStart;
}

export const createPartnerSchema = partnerFieldsSchema
	.extend({
		primaryEmail: z
			.string()
			.trim()
			.min(1, "Email is required.")
			.email("Enter a valid email address."),
	})
	.refine(contractEndsAfterStart, {
		message: "End date must be after the start date.",
		path: ["contractEnd"],
	});
export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;

export const updatePartnerSchema = partnerFieldsSchema.refine(
	contractEndsAfterStart,
	{
		message: "End date must be after the start date.",
		path: ["contractEnd"],
	},
);
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;

export const partnerTierSchema = z.object({
	id: z.string().uuid(),
	slug: z.string(),
	displayName: z.string(),
	hasCvAccess: z.boolean(),
	jobQuota: z.number().int().nonnegative(),
	eventQuota: z.unknown(),
	displayOrder: z.number().int(),
});
export type PartnerTier = z.infer<typeof partnerTierSchema>;

export const managedPartnerSchema = z.object({
	id: z.string().uuid(),
	companyName: z.string(),
	primaryEmail: z.string().email(),
	status: partnerStatusSchema,
	partnerKind: partnerKindSchema,
	tierId: z.string().uuid(),
	tier: partnerTierSchema.omit({ displayOrder: true }).nullable(),
	contractStart: contractDateSchema,
	contractEnd: contractDateSchema,
	websiteUrl: z.string().nullable(),
	notes: z.string().nullable(),
	invitedAt: z.iso.datetime({ offset: true }),
	acceptedAt: z.iso.datetime({ offset: true }).nullable(),
	createdAt: z.iso.datetime({ offset: true }),
	updatedAt: z.iso.datetime({ offset: true }),
});
export type ManagedPartner = z.infer<typeof managedPartnerSchema>;

export const partnerManagementDataSchema = z.object({
	partners: z.array(managedPartnerSchema),
	tiers: z.array(partnerTierSchema),
});
export type PartnerManagementData = z.infer<typeof partnerManagementDataSchema>;

export const partnerCreationResultSchema = z.object({
	partnerId: z.string().uuid(),
	activationLink: z.string().url().nullable(),
	activationEmailSent: z.boolean(),
});
export type PartnerCreationResult = z.infer<typeof partnerCreationResultSchema>;

export const partnerActivationResultSchema = z.object({
	inviteLink: z.string().url(),
	activationEmailSent: z.boolean(),
});
export type PartnerActivationResult = z.infer<
	typeof partnerActivationResultSchema
>;

export const PARTNER_JOB_TYPES = JOB_TYPES;
export const partnerJobTypeSchema = jobTypeSchema;
export type PartnerJobType = z.infer<typeof partnerJobTypeSchema>;

export const PARTNER_JOB_STATUSES = [
	"draft",
	"pending_review",
	"approved",
	"rejected",
	"archived",
] as const;
export const partnerJobStatusSchema = z.enum(PARTNER_JOB_STATUSES);
export type PartnerJobStatus = z.infer<typeof partnerJobStatusSchema>;

const optionalHttpUrlSchema = z
	.union([
		z
			.string()
			.trim()
			.url("Enter a valid URL including https://.")
			.refine(
				(value) => /^https?:\/\//i.test(value),
				"Use an http:// or https:// URL.",
			),
		z.literal(""),
	])
	.optional();

export const partnerJobInputSchema = z.object({
	title: z.string().trim().min(2, "Job title is required.").max(160),
	jobType: partnerJobTypeSchema,
	location: z.string().trim().min(2, "Location is required.").max(160),
	description: z
		.string()
		.trim()
		.min(20, "Describe the role in at least 20 characters.")
		.max(8000),
	callToAction: z.string().trim().min(2, "Button label is required.").max(80),
	contactName: z.string().trim().min(2, "Contact name is required.").max(120),
	contactEmail: z.string().trim().email("Enter a valid contact email."),
	contactRole: z.string().trim().max(120).optional(),
	externalUrl: optionalHttpUrlSchema,
	logoUrl: optionalHttpUrlSchema,
});
export type PartnerJobInput = z.infer<typeof partnerJobInputSchema>;

export const managedPartnerJobSchema = partnerJobInputSchema.extend({
	id: z.string().uuid(),
	partnerId: z.string().uuid(),
	contactRole: z.string().nullable(),
	externalUrl: z.string().nullable(),
	logoUrl: z.string().nullable(),
	status: partnerJobStatusSchema,
	submittedAt: z.iso.datetime({ offset: true }).nullable(),
	publishedAt: z.iso.datetime({ offset: true }).nullable(),
	expiresAt: z.iso.datetime({ offset: true }).nullable(),
	createdAt: z.iso.datetime({ offset: true }),
	updatedAt: z.iso.datetime({ offset: true }),
});
export type ManagedPartnerJob = z.infer<typeof managedPartnerJobSchema>;

export const partnerJobsDataSchema = z.object({
	jobs: z.array(managedPartnerJobSchema),
});
export type PartnerJobsData = z.infer<typeof partnerJobsDataSchema>;
