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
		member_role: _memberRole,
		department,
		...selfServiceValues
	} = editableValues;

	const normalizedDepartment = department?.trim();
	if (normalizedDepartment) {
		return { ...selfServiceValues, department: normalizedDepartment };
	}

	return selfServiceValues;
}
