export const DEPARTMENTS = [
	"Community",
	"Innovation Department",
	"Legal & Finance",
	"Makeathon",
	"Marketing",
	"Partners & Sponsors",
	"Software Development",
	"Venture",
] as const;

export const WEEKLY_HOURS_OPTIONS = [2, 5, 10, 15, 20] as const;

// Canonical TUM.ai member roles. Keep in sync with:
//   - `server/src/routes/admin.ts` (MEMBER_ROLES)
//   - `supabase/migrations/20260423160500_member_role_enum_and_alumni.sql`
export const MEMBER_ROLES = [
	"Member",
	"Team Lead",
	"Vice-President",
	"President",
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export const DEFAULT_MEMBER_ROLE: MemberRole = "Member";

export const BOARD_MEMBER_ROLE = "Board Member" as const;

// School/University presets. "Other" unlocks a free-text field.
export const SCHOOL_PRESETS = [
	"TUM",
	"LMU",
	"Hochschule München",
	"Munich Business School",
] as const;
export const SCHOOL_CUSTOM_OPTION = "Other";

// Degree level is fixed; only the program/major name is freely chosen.
export const DEGREE_TYPES = [
	"Bachelor",
	"Master",
	"PhD",
	"Staatsexamen",
] as const;
export type DegreeType = (typeof DEGREE_TYPES)[number];

export const DEGREE_PROGRAM_PRESETS = [
	"Aerospace",
	"Architecture",
	"Biology",
	"Business Administration",
	"Chemistry",
	"Civil Engineering",
	"Communication Science",
	"Computer Science",
	"Data Engineering and Analytics",
	"Data Science",
	"Economics",
	"Electrical Engineering and Information Technology",
	"Finance and Information Management",
	"Information Systems",
	"Law",
	"Life Sciences",
	"Management",
	"Management & Technology",
	"Mathematics",
	"Mechanical Engineering",
	"Medicine",
	"Molecular Biotechnology",
	"Physics",
	"Psychology",
	"Robotics, Cognition, Intelligence",
	"Software Engineering",
	"Statistics",
] as const;
export const DEGREE_PROGRAM_CUSTOM_OPTION = "Other";

function getBatchYearSuffix(year: number): string {
	return String(year % 100).padStart(2, "0");
}

export function buildBatchOptions(
	startYear = 2020,
	endYear = new Date().getFullYear(),
): string[] {
	const options: string[] = [];
	for (let year = endYear; year >= startYear; year -= 1) {
		const suffix = getBatchYearSuffix(year);
		options.push(`WS${suffix}`, `SS${suffix}`);
	}
	return options;
}

export const BATCH_OPTIONS = buildBatchOptions();

export function getCurrentBatch(reference: Date = new Date()): string {
	const month = reference.getMonth();
	const year = reference.getFullYear();

	if (month >= 3 && month <= 8) {
		return `SS${getBatchYearSuffix(year)}`;
	}
	if (month >= 9) {
		return `WS${getBatchYearSuffix(year)}`;
	}
	return `WS${getBatchYearSuffix(year - 1)}`;
}
