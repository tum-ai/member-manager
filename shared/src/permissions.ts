// Department-scoped RBAC: a member's department IS their role. Each department
// maps to the set of tool permissions that every active member of that
// department automatically inherits. Admins are superusers and bypass these
// checks entirely. Department is admin-controlled (members request changes via
// member_change_requests), so it is a trusted access boundary.
//
// The live mapping lives in the `department_permissions` table and is edited by
// admins. This module is the framework-free catalog of assignable permissions
// shared by client and server.

export const PERMISSIONS = [
	"finance.review",
	"finance.department",
	"contracts.admin",
	"contracts.create",
	"tumai_days.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Human-readable metadata for rendering the admin permission matrix.
export const PERMISSION_DETAILS: Record<
	Permission,
	{ label: string; description: string }
> = {
	"finance.review": {
		label: "Finance Review",
		description:
			"Approve reimbursement and invoice requests, then mark approved requests as paid.",
	},
	"finance.department": {
		label: "Department Finances",
		description:
			"View the department's own budget and spend analytics in the finance tool (read-only; no editing or other departments).",
	},
	"contracts.admin": {
		label: "Contract Administration",
		description:
			"Review and approve submitted contracts, manage templates, and send partner signing links.",
	},
	"contracts.create": {
		label: "Contract Submission",
		description:
			"Create and submit contract drafts for review, and track the status of own submissions.",
	},
	"tumai_days.manage": {
		label: "TUM.ai Days Management",
		description:
			"Create and schedule TUM.ai Day agendas, and audit RSVP votes and reasoning.",
	},
};

// Maps each department to the permissions every active member inherits. Keys
// are department names; values are subsets of PERMISSIONS.
export type DepartmentPermissionMap = Record<string, Permission[]>;

export function isPermission(value: unknown): value is Permission {
	return typeof value === "string" && PERMISSIONS.includes(value as Permission);
}

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
