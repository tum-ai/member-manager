import {
	DEFAULT_MEMBER_ROLE,
	normalizeOperationalDepartment,
	type ProfileMemberUpdate,
	requiresDepartmentForMemberRole,
	resolveDepartmentForMemberRole,
} from "@member-manager/shared";
import { ValidationError } from "../errors.js";

/** The admin-managed columns of the stored member row. */
export interface ManagedMemberFields {
	member_role?: string | null;
	department?: string | null;
}

export interface MemberUpdateContext {
	isAdmin: boolean;
	/** What is stored today; null for a member without a row yet. */
	existing: ManagedMemberFields | null;
}

/**
 * Decides which member columns a profile save may write.
 *
 * - Everyone: the personal and LinkedIn fields they sent. Omitted keys stay
 *   omitted (merge, never replace).
 * - Members: `member_role` and `department` are admin-managed (changes go
 *   through member_change_requests), so they are dropped. The research project
 *   only counts while the member's *stored* department is Research.
 * - Admins: may set role and department; the department follows the role
 *   (executives have none), and Member / Team Lead need one. Leaving the
 *   Research department clears the research project.
 *
 * Pure: no I/O, so every rule is unit-testable.
 */
export function resolveMemberUpdate(
	input: ProfileMemberUpdate,
	{ isAdmin, existing }: MemberUpdateContext,
): Record<string, unknown> {
	const patch: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined) {
			patch[key] = value;
		}
	}

	const hasResearchProject = Object.hasOwn(input, "research_project_id");

	if (!isAdmin) {
		delete patch.member_role;
		delete patch.department;
		if (hasResearchProject) {
			const effectiveDepartment = resolveDepartmentForMemberRole(
				String(existing?.member_role ?? DEFAULT_MEMBER_ROLE),
				existing?.department,
			);
			patch.research_project_id =
				effectiveDepartment === "Research"
					? (input.research_project_id ?? null)
					: null;
		}
		return patch;
	}

	const updatesRoleOrDepartment =
		Object.hasOwn(input, "department") || Object.hasOwn(input, "member_role");
	if (!updatesRoleOrDepartment && !hasResearchProject) {
		return patch;
	}

	let effectiveDepartment = normalizeOperationalDepartment(
		existing?.department,
	);

	if (updatesRoleOrDepartment) {
		const nextRole =
			input.member_role ?? String(existing?.member_role ?? DEFAULT_MEMBER_ROLE);
		const requestedDepartment = Object.hasOwn(input, "department")
			? input.department
			: existing?.department;
		effectiveDepartment = resolveDepartmentForMemberRole(
			nextRole,
			requestedDepartment,
		);
		if (requiresDepartmentForMemberRole(nextRole) && !effectiveDepartment) {
			throw new ValidationError(
				"Department is required for Member and Team Lead roles",
			);
		}
		patch.member_role = nextRole;
		patch.department = effectiveDepartment;
	}

	if (hasResearchProject) {
		patch.research_project_id =
			effectiveDepartment === "Research"
				? (input.research_project_id ?? null)
				: null;
	} else if (updatesRoleOrDepartment && effectiveDepartment !== "Research") {
		patch.research_project_id = null;
	}

	return patch;
}
