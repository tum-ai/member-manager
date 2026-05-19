import { DEGREE_TYPES } from "./constants";

export const MEMBER_STATUSES = ["active", "inactive", "alumni"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
const NON_OPERATIONAL_DEPARTMENTS = new Set(["Board"]);

const DEGREE_TYPE_ALIASES: Record<string, string> = {
	"B.A.": "Bachelor",
	"B.Eng.": "Bachelor",
	"B.Sc.": "Bachelor",
	BA: "Bachelor",
	Bachelor: "Bachelor",
	"LL.B.": "Bachelor",
	"M.A.": "Master",
	"M.B.A.": "Master",
	"M.Eng.": "Master",
	"M.Sc.": "Master",
	MA: "Master",
	Master: "Master",
	MBA: "Master",
	"LL.M.": "Master",
	Doctorate: "PhD",
	PhD: "PhD",
	Promotion: "PhD",
	Staatsexamen: "Staatsexamen",
};

const DEGREE_TYPE_LABELS = [
	...DEGREE_TYPES,
	...Object.keys(DEGREE_TYPE_ALIASES),
].sort((left, right) => right.length - left.length);

export interface EducationEntry {
	degree: string;
	school: string;
}

function splitStoredList(
	stored?: string | null,
	{ preserveEmptyRows = false }: { preserveEmptyRows?: boolean } = {},
): string[] {
	const normalized = (stored ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	if (!normalized.trim()) return [];

	const entries = normalized.split("\n").map((entry) => entry.trim());
	return preserveEmptyRows ? entries : entries.filter(Boolean);
}

export function getDegreeEntries(stored?: string | null): string[] {
	return splitStoredList(stored).map((entry) => formatSingleDegree(entry));
}

export function getEducationEntries(
	storedDegree?: string | null,
	storedSchool?: string | null,
): EducationEntry[] {
	const degrees = splitStoredList(storedDegree, {
		preserveEmptyRows: true,
	}).map((entry) => formatSingleDegree(entry));
	const schools = splitStoredList(storedSchool, { preserveEmptyRows: true });
	const entryCount = Math.max(degrees.length, schools.length);

	return Array.from({ length: entryCount }, (_, index) => ({
		degree: degrees[index] ?? "",
		school: schools[index] ?? "",
	})).filter((entry) => entry.degree || entry.school);
}

export function serializeEducationEntries(entries: readonly EducationEntry[]): {
	degree: string;
	school: string;
} {
	const nonEmptyEntries = entries.filter(
		(entry) => entry.degree.trim() || entry.school.trim(),
	);

	return {
		degree: nonEmptyEntries
			.map((entry) => formatSingleDegree(entry.degree))
			.join("\n"),
		school: nonEmptyEntries.map((entry) => entry.school.trim()).join("\n"),
	};
}

export function splitDegree(stored: string): { type: string; program: string } {
	const trimmed = (stored ?? "").trim();
	for (const label of DEGREE_TYPE_LABELS) {
		const canonicalType = DEGREE_TYPE_ALIASES[label] ?? label;
		if (trimmed === label) return { type: canonicalType, program: "" };
		if (trimmed.startsWith(`${label} `)) {
			return {
				type: canonicalType,
				program: trimmed.slice(label.length + 1).trim(),
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

function formatSingleDegree(stored?: string | null): string {
	const normalized = stored?.trim() ?? "";
	if (!normalized) return "";
	const { type, program } = splitDegree(normalized);
	return joinDegree(type, program);
}

export function formatDegree(stored?: string | null): string {
	return getDegreeEntries(stored).join("\n");
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

export function extractLinkedinId(url: string): string {
	if (!url) return "";
	try {
		const cleaned = url.trim().replace(/\/+$/, ""); // remove trailing slashes
		const parts = cleaned.split("/in/");
		if (parts.length > 1) {
			return parts[parts.length - 1].split(/[?#]/)[0]; // strip query params
		}
		return "";
	} catch {
		return "";
	}
}
