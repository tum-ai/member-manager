// Canonical TUM.ai member domain: roles, statuses, and framework-free helpers
// shared by both the client and the server. This is the single source of truth;
// keep DB enums (supabase/migrations) in sync with the values here.

export const MEMBER_ROLES = [
	"Member",
	"Team Lead",
	"Vice-President",
	"President",
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const BOARD_MEMBER_ROLE = "Board Member" as const;

export const MEMBER_STATUSES = ["active", "inactive", "alumni"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const DEFAULT_MEMBER_ROLE: MemberRole = "Member";
export const DEFAULT_MEMBER_STATUS: MemberStatus = "active";

// Batch identifiers look like WS24 / SS25 (semester + two-digit year >= 20).
export const MEMBER_BATCH_REGEX = /^(WS|SS)(2\d|[3-9]\d)$/;

const NON_OPERATIONAL_DEPARTMENTS = new Set(["Board"]);

export function normalizeNullableText(value?: string | null): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

export function statusToLegacyActive(status: MemberStatus): boolean {
	return status === "active";
}

export function getMemberStatusLabel(status?: string | null): string {
	switch (status) {
		case "inactive":
			return "Inactive";
		case "alumni":
			return "Alumni";
		default:
			return "Active";
	}
}

export function isExecutiveMemberRole(
	role: string | null | undefined,
): boolean {
	return role === "President" || role === "Vice-President";
}

export function requiresDepartmentForMemberRole(
	role: string | null | undefined,
): boolean {
	return role === "Member" || role === "Team Lead";
}

// A department only counts as "operational" if it is set and not a
// non-operational placeholder (e.g. Board). Executives have no department.
export function normalizeOperationalDepartment(
	department?: string | null,
): string | null {
	const normalized = normalizeNullableText(department);
	if (normalized && NON_OPERATIONAL_DEPARTMENTS.has(normalized)) {
		return null;
	}
	return normalized;
}

export function resolveDepartmentForMemberRole(
	role: string | null | undefined,
	department: string | null | undefined,
): string | null {
	if (isExecutiveMemberRole(role)) {
		return null;
	}
	return normalizeOperationalDepartment(department);
}

export function buildMemberNameSearchText(
	givenName?: string | null,
	surname?: string | null,
): string {
	const given = givenName?.trim() ?? "";
	const family = surname?.trim() ?? "";
	return [`${given} ${family}`.trim(), `${family} ${given}`.trim()]
		.filter((value, index, values) => value && values.indexOf(value) === index)
		.join(" ");
}
