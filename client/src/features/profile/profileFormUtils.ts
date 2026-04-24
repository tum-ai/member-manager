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

	const {
		department: _department,
		member_role: _memberRole,
		...selfServiceValues
	} = editableValues;

	return selfServiceValues;
}
