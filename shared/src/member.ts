import { z } from "zod";

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

// Operational TUM.ai departments members are assigned to. Used e.g. to map
// BuchhaltungsButler cost locations to a department in the finance analytics
// tool. Keep in sync with the `department` values seeded in supabase/seed.sql.
export const TUMAI_DEPARTMENTS = [
	"Makeathon",
	"Venture",
	"Software Development",
	"Legal & Finance",
	"Community",
	"Marketing",
	"Partners & Sponsors",
	"Research",
] as const;
export type TumaiDepartment = (typeof TUMAI_DEPARTMENTS)[number];

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

export type MemberDuplicateConfidence = "high" | "medium";

export interface DuplicateMemberSummary {
	user_id: string;
	email: string;
	given_name: string;
	surname: string;
	date_of_birth?: string | null;
	member_status?: string | null;
	active?: boolean | null;
	department?: string | null;
	batch?: string | null;
	created_at?: string | null;
}

export interface MemberDuplicateCandidate {
	id: string;
	match_key: string;
	reason: string;
	confidence: MemberDuplicateConfidence;
	members: DuplicateMemberSummary[];
}

export const memberMergeRequestSchema = z
	.object({
		source_user_id: z.string().uuid(),
		target_user_id: z.string().uuid(),
		note: z.string().max(1000).trim().optional().nullable(),
	})
	.refine((value) => value.source_user_id !== value.target_user_id, {
		message: "source_user_id and target_user_id must differ",
		path: ["target_user_id"],
	});

export const memberMergeResponseSchema = z.object({
	source_user_id: z.string().uuid(),
	target_user_id: z.string().uuid(),
	audit_id: z.string().uuid().nullable(),
	transferred_counts: z.record(z.string(), z.number()),
});

export type MemberMergeRequest = z.infer<typeof memberMergeRequestSchema>;
export type MemberMergeResponse = z.infer<typeof memberMergeResponseSchema>;

export function normalizeDuplicateMemberText(value?: string | null): string {
	return (value ?? "")
		.normalize("NFKD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

export function buildDuplicateMemberNameKey(
	givenName?: string | null,
	surname?: string | null,
): string {
	const given = normalizeDuplicateMemberText(givenName);
	const family = normalizeDuplicateMemberText(surname);
	return [given, family].filter(Boolean).join(" ");
}

export function isPlaceholderDateOfBirth(value?: string | null): boolean {
	return !value || value === "2000-01-01";
}
