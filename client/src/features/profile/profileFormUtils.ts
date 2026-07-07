import type { MemberSchema } from "@/lib/schemas";

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
		data_privacy_notice_agreed?: boolean;
	};
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
		{
			label: "Data privacy notice agreement",
			filled: Boolean(sepa.data_privacy_notice_agreed),
		},
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
