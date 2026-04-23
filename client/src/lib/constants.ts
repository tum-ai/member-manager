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
	"Alumni",
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
