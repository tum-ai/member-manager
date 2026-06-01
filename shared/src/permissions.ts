// Department-scoped RBAC: a member's department IS their role. Each department
// maps to the set of tool permissions that every active member of that
// department automatically inherits. Admins are superusers and bypass these
// checks entirely. Department is admin-controlled (members request changes via
// member_change_requests), so it is a trusted access boundary.

export const PERMISSIONS = ["finance.review", "contracts.admin"] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Maps each department to the permissions every active member inherits. Keep
// keys in sync with the DEPARTMENTS list. Departments absent from this map
// grant no special tool permissions.
export const DEPARTMENT_PERMISSIONS: Record<string, readonly Permission[]> = {
	"Legal & Finance": ["finance.review", "contracts.admin"],
};

interface MemberAccessFields {
	active?: boolean | null;
	member_status?: string | null;
	department?: string | null;
}

export function isActiveMember(
	member: MemberAccessFields | null | undefined,
): boolean {
	if (!member) return false;
	const status =
		member.member_status ?? (member.active ? "active" : "inactive");
	return status === "active";
}

export function departmentHasPermission(
	department: string | null | undefined,
	permission: Permission,
): boolean {
	if (!department) return false;
	return DEPARTMENT_PERMISSIONS[department]?.includes(permission) ?? false;
}

// True when the member is active and their department grants the permission.
// Does NOT include the admin superuser bypass — callers combine this with their
// own admin check, e.g. `isAdmin || memberHasPermission(member, permission)`.
export function memberHasPermission(
	member: MemberAccessFields | null | undefined,
	permission: Permission,
): boolean {
	return (
		isActiveMember(member) &&
		departmentHasPermission(member?.department, permission)
	);
}
