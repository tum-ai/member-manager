import type { MemberSchema } from "../../lib/schemas";

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

// Share of "key" profile fields a member has filled in, as an integer 0–100.
// Drives the completeness meter in the profile sidebar.
export function computeProfileCompleteness({
	member,
	linkedin,
	sepa,
}: ProfileCompletenessInput): number {
	const textFields = [
		member.given_name,
		member.surname,
		member.date_of_birth,
		member.street,
		member.number,
		member.postal_code,
		member.city,
		member.country,
		member.batch,
		// Study/education: a real degree counts; an explicit "None" serializes to
		// "" (EducationFields NONE_VALUE) and so does not count — same trim rule
		// as every other select-backed field below.
		member.degree,
		// department and member_role are admin-managed (stripped from
		// self-service updates), so a member can never fill them in — excluded
		// from completeness so a fully-filled editable profile reaches 100%.
		linkedin.linkedin_profile_url,
		linkedin.public_location,
		sepa.iban,
		sepa.bank_name,
	];
	const booleanFields = [
		sepa.mandate_agreed,
		sepa.privacy_agreed,
		sepa.data_privacy_notice_agreed,
	];

	const total = textFields.length + booleanFields.length;
	const filled =
		textFields.filter((value) => Boolean(value?.trim())).length +
		booleanFields.filter(Boolean).length;

	return Math.round((filled / total) * 100);
}
