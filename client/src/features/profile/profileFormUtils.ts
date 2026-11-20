import type { User } from "@supabase/supabase-js";
import { extractSlackProfile } from "@/features/profile/profileUtils";
import { getCurrentBatch } from "@/lib/constants";
import type {
	LinkedinSchema,
	MemberSchema,
	ProfileSepaInput,
} from "@/lib/schemas";

interface BuildSelfServiceMemberUpdatePayloadOptions {
	includeAdminManagedFields?: boolean;
}

export function buildSelfServiceMemberUpdatePayload(
	values: Partial<MemberSchema>,
	options: BuildSelfServiceMemberUpdatePayloadOptions = {},
): Partial<MemberSchema> {
	const {
		member_status: _memberStatus,
		active: _active,
		...editableValues
	} = values;

	if (options.includeAdminManagedFields) {
		return editableValues;
	}

	// member_role and department are admin-managed. Members request changes to
	// them via member_change_requests, so they must never be sent through the
	// self-service profile update.
	const {
		member_role: _memberRole,
		department: _department,
		...selfServiceValues
	} = editableValues;

	return selfServiceValues;
}

interface ProfileCompletenessInput {
	member: Partial<MemberSchema>;
	linkedin: { linkedin_profile_url?: string; public_location?: string };
	sepa: {
		iban?: string;
		bank_name?: string;
		mandate_agreed?: boolean;
		privacy_agreed?: boolean;
	};
	/** The member has saved a Data Privacy Notice decision (any answer counts). */
	consentsDecided: boolean;
}

interface CompletenessField {
	label: string;
	filled: boolean;
}

// Single source of truth for which fields count toward completeness, shared
// by computeProfileCompleteness (the percentage) and getMissingProfileFields
// (the breakdown of what's still needed to reach 100%).
function getCompletenessFields({
	member,
	linkedin,
	sepa,
	consentsDecided,
}: ProfileCompletenessInput): CompletenessField[] {
	const isFilledText = (value: string | null | undefined) =>
		Boolean(value?.trim());

	return [
		{ label: "First name", filled: isFilledText(member.given_name) },
		{ label: "Last name", filled: isFilledText(member.surname) },
		{ label: "Date of birth", filled: isFilledText(member.date_of_birth) },
		{ label: "Street", filled: isFilledText(member.street) },
		{ label: "House number", filled: isFilledText(member.number) },
		{ label: "Postal code", filled: isFilledText(member.postal_code) },
		{ label: "City", filled: isFilledText(member.city) },
		{ label: "Country", filled: isFilledText(member.country) },
		{ label: "TUM.ai batch", filled: isFilledText(member.batch) },
		// Study/education: a real degree counts; an explicit "None" serializes to
		// "" (EducationFields NONE_VALUE) and so does not count — same trim rule
		// as every other select-backed field below.
		{ label: "Degree", filled: isFilledText(member.degree) },
		// department and member_role are admin-managed (stripped from
		// self-service updates), so a member can never fill them in — excluded
		// from completeness so a fully-filled editable profile reaches 100%.
		{
			label: "LinkedIn profile",
			filled: isFilledText(linkedin.linkedin_profile_url),
		},
		{
			label: "Public location",
			filled: isFilledText(linkedin.public_location),
		},
		{ label: "IBAN", filled: isFilledText(sepa.iban) },
		{ label: "Bank name", filled: isFilledText(sepa.bank_name) },
		{
			label: "SEPA mandate agreement",
			filled: Boolean(sepa.mandate_agreed),
		},
		{ label: "Privacy agreement", filled: Boolean(sepa.privacy_agreed) },
		// Each purpose is optional, so a refusal still completes this item.
		{ label: "Data privacy consent choices", filled: consentsDecided },
	];
}

// Share of "key" profile fields a member has filled in, as an integer 0–100.
// Drives the completeness meter in the profile sidebar.
export function computeProfileCompleteness(
	input: ProfileCompletenessInput,
): number {
	const fields = getCompletenessFields(input);
	const filled = fields.filter((field) => field.filled).length;

	return Math.round((filled / fields.length) * 100);
}

// Labels of the fields still missing, for the "what's left" breakdown next
// to the completeness meter.
export function getMissingProfileFields(
	input: ProfileCompletenessInput,
): string[] {
	return getCompletenessFields(input)
		.filter((field) => !field.filled)
		.map((field) => field.label);
}

// biome-ignore lint/suspicious/noExplicitAny: member and sepa rows are untyped API data
type ApiRecord = Record<string, any>;

/** Form values for a member row, falling back to Slack data for new members. */
export function toMemberFormValues(
	existing: ApiRecord | undefined,
	user: User,
): MemberSchema {
	const member = existing ?? {};
	const slackProfile = extractSlackProfile(user);

	return {
		active: member.active ?? true,
		member_status:
			member.member_status || (member.active ? "active" : "inactive"),
		salutation: member.salutation || "",
		title: member.title || "",
		surname: member.surname || slackProfile.surname,
		given_name: member.given_name || slackProfile.given_name,
		date_of_birth: member.date_of_birth || "",
		street: member.street || "",
		number: member.number || "",
		postal_code: member.postal_code || "",
		city: member.city || "",
		country: member.country || "Germany",
		user_id: user.id,
		batch: member.batch || getCurrentBatch(),
		department: member.department || "",
		member_role: member.member_role || "",
		research_project_id: member.research_project_id || "",
		degree: member.degree || "",
		school: member.school || "",
		reimbursement_slack_notifications_enabled:
			member.reimbursement_slack_notifications_enabled ?? false,
	};
}

export function toLinkedinFormValues(
	existing: ApiRecord | undefined,
): LinkedinSchema {
	return {
		linkedin_profile_url: existing?.linkedin_profile_url || "",
		public_location: existing?.public_location || "",
	};
}

export function toSepaFormValues(
	existing: ApiRecord | undefined,
): ProfileSepaInput {
	return {
		iban: existing?.iban || "",
		bic: existing?.bic || "",
		bank_name: existing?.bank_name || "",
		mandate_agreed: existing?.mandate_agreed || false,
		privacy_agreed: existing?.privacy_agreed || false,
	};
}
