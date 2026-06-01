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
