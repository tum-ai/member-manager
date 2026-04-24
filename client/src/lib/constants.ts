export const DEPARTMENTS = [
	"Board",
	"Community",
	"Innovation Department",
	"Legal & Finance",
	"Makeathon",
	"Marketing",
	"Partners & Sponsors",
	"Research",
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

// School/University presets. "Other" unlocks a free-text field.
export const SCHOOL_PRESETS = ["TUM", "LMU"] as const;
export const SCHOOL_CUSTOM_OPTION = "Other";

// Degree type is fixed; only the program name is freely chosen.
export const DEGREE_TYPES = ["B.Sc.", "M.Sc.", "PhD"] as const;
export type DegreeType = (typeof DEGREE_TYPES)[number];

export const DEGREE_PROGRAM_PRESETS = [
	"Computer Science",
	"Management & Technology",
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
