// Org-structure lookups: deterministic reads of the TUM.ai org from the
// `members` row (current department / role / batch / status) and from
// `member_role_history` (who held a role in a given year). Powers the agent's
// `org` pillar. No LLM. Mirrors structuredLookup.ts: getSupabase() + batch name
// resolution. Defaults to active members; pass includeAlumni for former ones.
//
// Caveat: member_role_history records role + dates only, NOT department. So a
// past-year role lookup returns ALL holders of that period with their *current*
// department — it cannot filter by the department held at the time.

import {
	BOARD_MEMBER_ROLE,
	MEMBER_BATCH_REGEX,
	MEMBER_ROLES,
	type MemberRole,
	type MemberStatus,
	normalizeOperationalDepartment,
} from "@member-manager/shared";
import { nameOf } from "./agent/fallback.js";
import { visibleBeaconMemberIds } from "./beacon.js";
import { DatabaseError } from "./errors.js";
import { getSupabase } from "./supabase.js";

export type RoleQuery = MemberRole | typeof BOARD_MEMBER_ROLE;

export interface OrgHit {
	user_id: string;
	name: string;
	detail: string; // e.g. "Team Lead, Software Development" / "President, WS23/24 — currently alumni"
	member_status: MemberStatus;
}

interface MemberMeta {
	user_id: string;
	given_name: string | null;
	surname: string | null;
	department: string | null;
	member_status: MemberStatus;
}

// Kept for call-site compatibility while Beacon's service-role visibility
// policy is active-only. `includeAlumni` must never widen an assistant read.
const statusesFor = (_includeAlumni?: boolean): MemberStatus[] => ["active"];

async function visibleRows<T extends { user_id: string }>(
	rows: T[],
): Promise<T[]> {
	const visible = await visibleBeaconMemberIds(rows.map((row) => row.user_id));
	return rows.filter((row) => visible.has(row.user_id));
}

// Normalize whatever the model passes ("teamlead", "TL", "vp", "board") to a
// canonical role, or null if it isn't a recognized role.
export function normalizeRole(input: string): RoleQuery | null {
	const k = input.toLowerCase().replace(/[^a-z]/g, "");
	if (k === "teamlead" || k === "tl" || k === "lead") return "Team Lead";
	if (k === "vp" || k === "vicepresident" || k === "vicepres")
		return "Vice-President";
	if (k === "president" || k === "pres") return "President";
	if (k === "board" || k === "boardmember") return BOARD_MEMBER_ROLE;
	if (k === "member") return "Member";
	// Last resort: case-insensitive exact match against the canonical list.
	const exact = MEMBER_ROLES.find(
		(r) => r.toLowerCase() === input.toLowerCase(),
	);
	return exact ?? null;
}

// Validate/normalize a batch token like "ws25" → "WS25"; null if it isn't one.
export function normalizeBatch(input: string): string | null {
	const b = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
	return MEMBER_BATCH_REGEX.test(b) ? b : null;
}

const deptKey = (s: string): string =>
	s.toLowerCase().replace(/[^a-z0-9]/g, "");
// Abbreviation signature: first 4 chars of each word, joined. "Software
// Development" → "softdeve", which prefix-matches a typed "softdev".
const deptAbbr = (s: string): string =>
	s
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean)
		.map((w) => w.slice(0, 4))
		.join("");

// Resolve a typed department ("softdev") to the canonical stored value(s)
// ("Software Development") via fuzzy contains/abbreviation matching.
export async function resolveDepartment(input: string): Promise<string[]> {
	const { data, error } = await getSupabase()
		.from("members")
		.select("user_id, department")
		.eq("member_status", "active")
		.not("department", "is", null);
	if (error) throw new DatabaseError("Failed to resolve Beacon departments");
	const rows = await visibleRows(
		(data ?? []) as { user_id: string; department: string | null }[],
	);
	const all = new Set<string>();
	for (const r of rows) {
		const d = normalizeOperationalDepartment(r.department);
		if (d) all.add(d);
	}
	const q = deptKey(input);
	if (!q) return [];
	const matches: string[] = [];
	for (const d of all) {
		const k = deptKey(d);
		const abbr = deptAbbr(d);
		if (
			k === q ||
			k.includes(q) ||
			q.includes(k) ||
			abbr.startsWith(q) ||
			q.startsWith(abbr)
		)
			matches.push(d);
	}
	return matches;
}

// One query to resolve display name + current department + status for ids.
async function membersMetaByIds(
	ids: string[],
): Promise<Map<string, MemberMeta>> {
	const unique = [...new Set(ids)];
	if (!unique.length) return new Map();
	const { data, error } = await getSupabase()
		.from("members")
		.select("user_id, given_name, surname, department, member_status")
		.in("user_id", unique);
	if (error) throw new DatabaseError("Failed to load Beacon member metadata");
	const rows = await visibleRows((data ?? []) as MemberMeta[]);
	return new Map(rows.map((member) => [member.user_id, member]));
}

const toHit = (m: MemberMeta, detail: string): OrgHit => ({
	user_id: m.user_id,
	name: nameOf(m),
	detail,
	member_status: m.member_status,
});

export interface DepartmentCount {
	department: string;
	count: number;
}

// Headcount per department (+ a synthetic "Board" from board_role).
export async function listDepartments(opts?: {
	includeAlumni?: boolean;
}): Promise<DepartmentCount[]> {
	const { data, error } = await getSupabase()
		.from("members")
		.select("user_id, department, member_status, board_role")
		.in("member_status", statusesFor(opts?.includeAlumni));
	if (error) throw new DatabaseError("Failed to load Beacon departments");
	const rows = await visibleRows(
		(data ?? []) as {
			user_id: string;
			department: string | null;
			member_status: MemberStatus;
			board_role: string | null;
		}[],
	);
	const counts = new Map<string, number>();
	for (const r of rows) {
		const d = normalizeOperationalDepartment(r.department);
		if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
		if (r.board_role === BOARD_MEMBER_ROLE)
			counts.set("Board", (counts.get("Board") ?? 0) + 1);
	}
	return [...counts]
		.map(([department, count]) => ({ department, count }))
		.sort(
			(a, b) => b.count - a.count || a.department.localeCompare(b.department),
		);
}

export async function peopleByDepartment(
	department: string,
	opts?: { includeAlumni?: boolean },
): Promise<OrgHit[]> {
	const depts = await resolveDepartment(department);
	if (!depts.length) return [];
	const { data, error } = await getSupabase()
		.from("members")
		.select("user_id, given_name, surname, department, member_status")
		.in("department", depts)
		.in("member_status", statusesFor(opts?.includeAlumni));
	if (error)
		throw new DatabaseError("Failed to load Beacon department members");
	const rows = await visibleRows(
		(data ?? []) as (MemberMeta & { member_role?: string | null })[],
	);
	return rows.map((m) => toHit(m, m.department ?? depts[0]));
}

export async function peopleByBatch(
	batch: string,
	opts?: { includeAlumni?: boolean },
): Promise<OrgHit[]> {
	const b = normalizeBatch(batch);
	if (!b) return [];
	const { data, error } = await getSupabase()
		.from("members")
		.select("user_id, given_name, surname, department, member_status")
		.eq("batch", b)
		.in("member_status", statusesFor(opts?.includeAlumni));
	if (error) throw new DatabaseError("Failed to load Beacon batch members");
	const rows = await visibleRows((data ?? []) as MemberMeta[]);
	return rows.map((m) =>
		toHit(m, `Batch ${b}${m.department ? `, ${m.department}` : ""}`),
	);
}

// Who CURRENTLY holds a role. Board → board_role; others → member_role.
// Optional current-department narrowing. Defaults to active members.
export async function currentRoleHolders(
	role: RoleQuery,
	opts?: { department?: string; includeAlumni?: boolean },
): Promise<OrgHit[]> {
	let depts: string[] | null = null;
	if (opts?.department) {
		depts = await resolveDepartment(opts.department);
		if (!depts.length) return [];
	}
	let q = getSupabase()
		.from("members")
		.select(
			"user_id, given_name, surname, department, member_status, member_role, board_role",
		)
		.in("member_status", statusesFor(opts?.includeAlumni));
	q =
		role === BOARD_MEMBER_ROLE
			? q.eq("board_role", BOARD_MEMBER_ROLE)
			: q.eq("member_role", role);
	if (depts) q = q.in("department", depts);
	const { data, error } = await q;
	if (error) throw new DatabaseError("Failed to load Beacon role holders");
	const rows = await visibleRows((data ?? []) as MemberMeta[]);
	return rows.map((m) =>
		toHit(m, m.department ? `${role}, ${m.department}` : role),
	);
}

interface RoleHistoryRow {
	user_id: string;
	role: string;
	semester: string | null;
	started_at: string | null;
	ended_at: string | null;
}

const periodLabel = (r: RoleHistoryRow): string => {
	if (r.semester) return r.semester;
	const s = r.started_at?.slice(0, 4);
	const e = r.ended_at?.slice(0, 4);
	if (s && e) return `${s}–${e}`;
	if (s) return `${s}–present`;
	return e ?? "";
};

// Who held a role during calendar `year`, from member_role_history. Returns ALL
// holders of that period (no department filter — history doesn't record it),
// each annotated with their current department + status so the caller can
// narrow. Board roles aren't tracked in history → empty.
export async function historicalRoleHolders(
	role: RoleQuery,
	year: number,
): Promise<OrgHit[]> {
	if (role === BOARD_MEMBER_ROLE) return [];
	const { data, error } = await getSupabase()
		.from("member_role_history")
		.select("user_id, role, semester, started_at, ended_at")
		.eq("role", role);
	if (error) throw new DatabaseError("Failed to load Beacon role history");
	const start = `${year}-01-01`;
	const end = `${year}-12-31`;
	const yy = String(year).slice(-2);
	const rows = ((data ?? []) as RoleHistoryRow[]).filter((r) => {
		if (!r.started_at && !r.ended_at)
			return r.semester ? r.semester.includes(yy) : false;
		return (
			(!r.started_at || r.started_at <= end) &&
			(!r.ended_at || r.ended_at >= start)
		);
	});
	if (!rows.length) return [];
	const meta = await membersMetaByIds(rows.map((r) => r.user_id));
	return rows
		.filter((r) => meta.has(r.user_id))
		.map((r) => {
			const m = meta.get(r.user_id) as MemberMeta;
			const period = periodLabel(r);
			const where = m.department ?? "no current department";
			return toHit(
				m,
				`${role}${period ? `, ${period}` : ""} — currently ${where}`,
			);
		});
}
