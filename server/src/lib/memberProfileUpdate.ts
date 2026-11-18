import {
	DEFAULT_MEMBER_ROLE,
	normalizeOperationalDepartment,
	requiresDepartmentForMemberRole,
	resolveDepartmentForMemberRole,
} from "./memberMetadata.js";

export interface MemberManagedFields {
	member_role?: string | null;
	department?: string | null;
}

export interface MemberProfileUpdateBody {
	given_name?: string;
	surname?: string;
	date_of_birth?: string;
	street?: string;
	number?: string;
	postal_code?: string;
	city?: string;
	country?: string;
	salutation?: string;
	title?: string;
	batch?: string | null;
	department?: string | null;
	member_role?: string;
	degree?: string | null;
	school?: string | null;
	research_project_id?: string | null;
	reimbursement_slack_notifications_enabled?: boolean;
	linkedin_profile_url?: string | null;
	public_location?: string | null;
}

export type BuildMemberProfileUpdateResult =
	| { ok: true; payload: Record<string, unknown> }
	| { ok: false; error: string };

/**
 * Drop keys whose value is `undefined` so a partial PUT never writes them as
 * null via upsert (#317-class wipe).
 */
function withoutUndefined(
	record: Record<string, unknown>,
): Record<string, unknown> {
	const next: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record)) {
		if (value !== undefined) {
			next[key] = value;
		}
	}
	return next;
}

/**
 * Apply self-service / admin policy to a parsed profile PUT body. Callers still
 * encrypt and upsert; this only decides which columns change.
 */
export function buildMemberProfileUpdate({
	body,
	isAdmin,
	existingMember,
	userId,
}: {
	body: MemberProfileUpdateBody;
	isAdmin: boolean;
	existingMember: MemberManagedFields | null;
	userId: string;
}): BuildMemberProfileUpdateResult {
	const updatePayload: Record<string, unknown> = {
		...body,
		user_id: userId,
	};
	const hasResearchProjectUpdate = Object.hasOwn(body, "research_project_id");

	if (!isAdmin) {
		// member_role and department are admin-managed; members request changes
		// through member_change_requests rather than editing them directly. The
		// research project is resolved against the member's existing department.
		delete updatePayload.member_role;
		delete updatePayload.department;
		if (hasResearchProjectUpdate) {
			const currentRole = String(
				existingMember?.member_role ?? DEFAULT_MEMBER_ROLE,
			);
			const effectiveDepartment = resolveDepartmentForMemberRole(
				currentRole,
				existingMember?.department,
			);
			updatePayload.research_project_id =
				effectiveDepartment === "Research"
					? (body.research_project_id ?? null)
					: null;
		}
	} else if (
		Object.hasOwn(body, "department") ||
		Object.hasOwn(body, "member_role") ||
		hasResearchProjectUpdate
	) {
		const updatesRoleOrDepartment =
			Object.hasOwn(body, "department") || Object.hasOwn(body, "member_role");
		let effectiveDepartment = normalizeOperationalDepartment(
			existingMember?.department,
		);

		if (updatesRoleOrDepartment) {
			const nextRole =
				body.member_role ??
				String(existingMember?.member_role ?? DEFAULT_MEMBER_ROLE);
			const requestedDepartment = Object.hasOwn(body, "department")
				? body.department
				: existingMember?.department;
			effectiveDepartment = resolveDepartmentForMemberRole(
				nextRole,
				requestedDepartment,
			);
			if (requiresDepartmentForMemberRole(nextRole) && !effectiveDepartment) {
				return {
					ok: false,
					error: "Department is required for Member and Team Lead roles",
				};
			}

			updatePayload.member_role = nextRole;
			updatePayload.department = effectiveDepartment;
		}

		if (hasResearchProjectUpdate) {
			updatePayload.research_project_id =
				effectiveDepartment === "Research"
					? (body.research_project_id ?? null)
					: null;
		} else if (updatesRoleOrDepartment && effectiveDepartment !== "Research") {
			updatePayload.research_project_id = null;
		}
	}

	return { ok: true, payload: withoutUndefined(updatePayload) };
}
