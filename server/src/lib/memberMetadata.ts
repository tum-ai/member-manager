import { z } from "zod";

export const MEMBER_ROLES = [
	"Member",
	"Team Lead",
	"Vice-President",
	"President",
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export const BOARD_LEADERSHIP_ROLES = ["Vice-President", "President"] as const;

export const MEMBER_STATUSES = ["active", "inactive", "alumni"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const DEFAULT_MEMBER_ROLE: MemberRole = "Member";
export const DEFAULT_MEMBER_STATUS: MemberStatus = "active";

export const memberRoleSchema = z.enum(MEMBER_ROLES);
export const memberStatusSchema = z.enum(MEMBER_STATUSES);

export function normalizeNullableText(value?: string | null): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

export function statusToLegacyActive(status: MemberStatus): boolean {
	return status === "active";
}

export function isBoardLeadershipRole(role?: string | null): boolean {
	return BOARD_LEADERSHIP_ROLES.includes(
		role as (typeof BOARD_LEADERSHIP_ROLES)[number],
	);
}

export function resolveDepartmentForMemberRole(
	role: string | null | undefined,
	department: string | null | undefined,
): string | null {
	if (isBoardLeadershipRole(role)) {
		return "Board";
	}

	return normalizeNullableText(department);
}
