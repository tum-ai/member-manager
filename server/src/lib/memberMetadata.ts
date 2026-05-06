import { z } from "zod";

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
const MEMBER_BATCH_REGEX = /^(WS|SS)(2\d|[3-9]\d)$/;
const NON_OPERATIONAL_DEPARTMENTS = new Set(["Board", "Research"]);

export const memberRoleSchema = z.enum(MEMBER_ROLES);
export const memberStatusSchema = z.enum(MEMBER_STATUSES);
export const memberBatchSchema = z
	.string()
	.refine((value) => MEMBER_BATCH_REGEX.test(value), "Invalid batch");

export function normalizeNullableText(value?: string | null): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

export function normalizeMemberBatch(value?: string | null): string | null {
	const normalized = normalizeNullableText(value);
	if (!normalized) {
		return null;
	}
	return memberBatchSchema.parse(normalized);
}

export function statusToLegacyActive(status: MemberStatus): boolean {
	return status === "active";
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

export function normalizeOperationalDepartment(
	department?: string | null,
): string | null {
	const normalized = normalizeNullableText(department);
	if (normalized && NON_OPERATIONAL_DEPARTMENTS.has(normalized)) {
		return null;
	}
	return normalized;
}
