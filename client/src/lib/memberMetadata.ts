import { DEGREE_TYPES } from "./constants";

export const MEMBER_STATUSES = ["active", "inactive", "alumni"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
const NON_OPERATIONAL_DEPARTMENTS = new Set(["Board", "Research"]);

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

export function resolveDepartmentForMemberRole(
	role: string | null | undefined,
	department: string | null | undefined,
): string | null {
	if (isExecutiveMemberRole(role)) {
		return null;
	}

	return getOperationalDepartment(department);
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

export function getOperationalDepartment(
	department: string | null | undefined,
): string | null {
	const normalized = department?.trim();
	if (normalized && NON_OPERATIONAL_DEPARTMENTS.has(normalized)) {
		return null;
	}
	return normalized ? normalized : null;
}
