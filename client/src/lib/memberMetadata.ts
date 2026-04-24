import { DEGREE_TYPES } from "./constants";

export const MEMBER_STATUSES = ["active", "inactive", "alumni"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export const BOARD_LEADERSHIP_ROLES = ["Vice-President", "President"] as const;

export function splitDegree(stored: string): { type: string; program: string } {
	const trimmed = (stored ?? "").trim();
	for (const candidate of DEGREE_TYPES) {
		if (trimmed === candidate) return { type: candidate, program: "" };
		if (trimmed.startsWith(`${candidate} `)) {
			return {
				type: candidate,
				program: trimmed.slice(candidate.length + 1).trim(),
			};
		}
	}
	return { type: "", program: trimmed };
}

export function joinDegree(type: string, program: string): string {
	const normalizedType = type.trim();
	const normalizedProgram = program.trim();
	if (normalizedType && normalizedProgram) {
		return `${normalizedType} ${normalizedProgram}`;
	}
	return normalizedType || normalizedProgram;
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

	const normalized = department?.trim();
	return normalized ? normalized : null;
}
