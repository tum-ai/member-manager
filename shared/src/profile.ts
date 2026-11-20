import { z } from "zod";
import {
	MEMBER_BATCH_REGEX,
	MEMBER_ROLES,
	normalizeNullableText,
} from "./member.js";
import { profileSepaSchema } from "./sepa.js";

// The profile contract: one read model and one write model for everything the
// profile page edits (member row, bank details and agreements). Both client
// and server import it, so the form, the API and the completeness meter can
// never drift apart.

export const LINKEDIN_PROFILE_URL_REGEX =
	/^https:\/\/(www\.)?linkedin\.com\/in\/[^/?#]+\/?([?#].*)?$/i;

/** Strict `YYYY-MM-DD` that also exists in the calendar (no 2024-02-31). */
export function isValidIsoDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return false;
	}
	return date.toISOString().slice(0, 10) === value;
}

/** Body code of a `412` answer: the profile changed since the client read it. */
export const PROFILE_VERSION_CONFLICT_CODE = "profile_version_conflict";

const isoDateOrBlankSchema = z
	.string()
	.refine(
		(value) => value.trim() === "" || isValidIsoDate(value),
		"Invalid date_of_birth",
	);

// "" and null both clear a value; undefined means "leave it as stored".
const clearableTextSchema = z
	.string()
	.nullish()
	.transform((value) => (value === undefined ? undefined : value || null));

const batchSchema = z
	.string()
	.nullish()
	.transform((value, ctx) => {
		if (value === undefined) {
			return undefined;
		}
		const normalized = normalizeNullableText(value);
		if (normalized === null) {
			return null;
		}
		if (!MEMBER_BATCH_REGEX.test(normalized)) {
			ctx.addIssue({ code: "custom", message: "Invalid batch" });
			return z.NEVER;
		}
		return normalized;
	});

const linkedinProfileUrlSchema = z
	.union([
		z.string().trim().regex(LINKEDIN_PROFILE_URL_REGEX, {
			message: "Must be a valid LinkedIn profile URL",
		}),
		z.literal(""),
		z.null(),
		z.undefined(),
	])
	.transform((value) => (value === undefined ? undefined : value || null))
	// A transform defeats zod v4's optional-key inference.
	.optional();

const trimmedClearableTextSchema = z
	.string()
	.nullish()
	.transform((value) =>
		value === undefined ? undefined : value?.trim() || null,
	);

/**
 * The member part of a profile save. Every key is optional and means "leave as
 * stored" when omitted; `null`/`""` clear. Admin-managed keys (`member_role`,
 * `department`) are accepted here and stripped for non-admins by the server.
 */
export const profileMemberInputSchema = z.object({
	given_name: z.string().optional(),
	surname: z.string().optional(),
	date_of_birth: isoDateOrBlankSchema.optional(),
	street: z.string().optional(),
	number: z.string().optional(),
	postal_code: z.string().optional(),
	city: z.string().optional(),
	country: z.string().optional(),
	salutation: z.string().optional(),
	title: z.string().optional(),
	batch: batchSchema,
	department: clearableTextSchema,
	member_role: z.enum(MEMBER_ROLES).optional(),
	degree: clearableTextSchema,
	school: clearableTextSchema,
	research_project_id: clearableTextSchema,
	reimbursement_slack_notifications_enabled: z.boolean().optional(),
	linkedin_profile_url: linkedinProfileUrlSchema,
	public_location: trimmedClearableTextSchema,
});

export type ProfileMemberInput = z.input<typeof profileMemberInputSchema>;
export type ProfileMemberUpdate = z.output<typeof profileMemberInputSchema>;

/**
 * `PUT /api/profile/:userId`. `version` is the one the client read; the write
 * is rejected with 412 if the profile changed since (optimistic concurrency).
 */
export const profileUpdateSchema = z.object({
	version: z.number().int().nonnegative(),
	member: profileMemberInputSchema,
	sepa: profileSepaSchema,
});

export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;
export type ProfileUpdate = z.output<typeof profileUpdateSchema>;

// --- Completeness ---------------------------------------------------------

export interface ProfileCompletenessSnapshot {
	member: {
		given_name?: string | null;
		surname?: string | null;
		date_of_birth?: string | null;
		street?: string | null;
		number?: string | null;
		postal_code?: string | null;
		city?: string | null;
		country?: string | null;
		batch?: string | null;
		degree?: string | null;
		linkedin_profile_url?: string | null;
		public_location?: string | null;
	};
	sepa: {
		iban?: string | null;
		bank_name?: string | null;
		mandate_agreed?: boolean | null;
		privacy_agreed?: boolean | null;
	};
	/** The member has saved a Data Privacy Notice decision (any answer counts). */
	consentsDecided: boolean;
}

export interface ProfileCompleteness {
	/** Integer 0-100. */
	percent: number;
	/** Labels of the fields still missing, in display order. */
	missing: string[];
}

export const profileCompletenessSchema = z.object({
	percent: z.number().int().min(0).max(100),
	missing: z.array(z.string()),
});

const isFilledText = (value: string | null | undefined) =>
	Boolean(value?.trim());

/**
 * Computed from *stored* data only. Values a form merely suggests (Slack name,
 * current batch) never count until they are saved. `department` and
 * `member_role` are admin-managed, so a member can never fill them in and
 * they are excluded: a fully filled editable profile reaches 100 %.
 */
export function computeProfileCompleteness({
	member,
	sepa,
	consentsDecided,
}: ProfileCompletenessSnapshot): ProfileCompleteness {
	const fields: Array<[label: string, filled: boolean]> = [
		["First name", isFilledText(member.given_name)],
		["Last name", isFilledText(member.surname)],
		["Date of birth", isFilledText(member.date_of_birth)],
		["Street", isFilledText(member.street)],
		["House number", isFilledText(member.number)],
		["Postal code", isFilledText(member.postal_code)],
		["City", isFilledText(member.city)],
		["Country", isFilledText(member.country)],
		["TUM.ai batch", isFilledText(member.batch)],
		// An explicit "None" serializes to "" and does not count.
		["Degree", isFilledText(member.degree)],
		["LinkedIn profile", isFilledText(member.linkedin_profile_url)],
		["Public location", isFilledText(member.public_location)],
		["IBAN", isFilledText(sepa.iban)],
		["Bank name", isFilledText(sepa.bank_name)],
		["SEPA mandate agreement", Boolean(sepa.mandate_agreed)],
		["Privacy agreement", Boolean(sepa.privacy_agreed)],
		// Each purpose is optional, so a refusal still completes this item.
		["Data privacy consent choices", consentsDecided],
	];

	const filled = fields.filter(([, isFilled]) => isFilled).length;
	return {
		percent: Math.round((filled / fields.length) * 100),
		missing: fields.filter(([, isFilled]) => !isFilled).map(([label]) => label),
	};
}

// --- Read model -------------------------------------------------------------

export const profileMemberSchema = z.looseObject({
	user_id: z.string(),
	email: z.string().optional(),
	avatar_url: z.string().optional(),
	given_name: z.string().nullish(),
	surname: z.string().nullish(),
	date_of_birth: z.string().nullish(),
	street: z.string().nullish(),
	number: z.string().nullish(),
	postal_code: z.string().nullish(),
	city: z.string().nullish(),
	country: z.string().nullish(),
	salutation: z.string().nullish(),
	title: z.string().nullish(),
	batch: z.string().nullish(),
	department: z.string().nullish(),
	member_role: z.string().nullish(),
	member_status: z.string().nullish(),
	active: z.boolean().nullish(),
	degree: z.string().nullish(),
	school: z.string().nullish(),
	research_project_id: z.string().nullish(),
	reimbursement_slack_notifications_enabled: z.boolean().nullish(),
	linkedin_profile_url: z.string().nullish(),
	public_location: z.string().nullish(),
});

export const profileBankSchema = z.object({
	iban: z.string(),
	bic: z.string(),
	bank_name: z.string(),
	mandate_agreed: z.boolean(),
	privacy_agreed: z.boolean(),
	data_privacy_notice_agreed: z.boolean(),
});

export const profileResponseSchema = z.object({
	/** Echo it back on the next `PUT`. Bumped by every write to the profile. */
	version: z.number().int().nonnegative(),
	member: profileMemberSchema,
	sepa: profileBankSchema,
	completeness: profileCompletenessSchema,
});

export type ProfileMember = z.infer<typeof profileMemberSchema>;
export type ProfileBank = z.infer<typeof profileBankSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
