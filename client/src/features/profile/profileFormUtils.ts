import type { MemberSchema } from "../../lib/schemas";

export function buildSelfServiceMemberUpdatePayload(
	values: Partial<MemberSchema>,
): Partial<MemberSchema> {
	const {
		department: _department,
		member_role: _memberRole,
		member_status: _memberStatus,
		active: _active,
		...selfServiceValues
	} = values;

	return selfServiceValues;
}
