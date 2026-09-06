// Deterministic post-enrichment cleanup for a member's claims:
//   1. Merge near-duplicate employment/education rows that describe the SAME
//      role worded differently by different sources (same org/school +
//      overlapping years + high title-token overlap). Keeps the best row
//      (confirmed > pending, richest title), unions the year span, drops twins.
//   2. Title-case titles/degrees/fields conservatively (acronyms preserved).
//
// Used by the enrichment job (per member, after all tiers) and the standalone
// `consolidate:claims` script. The pure helpers are unit-tested.

import { getSupabase } from "./supabase.js";

// ---- Conservative title-casing ------------------------------------------
// Capitalize plain lowercase words; PRESERVE tokens that already carry case,
// digits, or dots (AWS, GmbH, TUM.ai, westend61, iOS, BenGER) so we never mangle
// acronyms/proper nouns. A small map fixes common all-lowercase legal suffixes.
const SUFFIX_FIX: Record<string, string> = {
	gmbh: "GmbH",
	mbh: "mbH",
	ag: "AG",
	se: "SE",
	kg: "KG",
	ug: "UG",
	inc: "Inc",
	llc: "LLC",
	ltd: "Ltd",
	co: "Co",
	plc: "PLC",
};

function titleCaseWord(w: string): string {
	if (!w) return w;
	const lc = w.toLowerCase();
	if (SUFFIX_FIX[lc]) return SUFFIX_FIX[lc];
	if (/[A-Z]/.test(w)) return w; // already has an uppercase (acronym / proper noun)
	if (/\d/.test(w)) return w; // alphanumeric token like "westend61"
	if (w.includes(".")) return w; // dotted token like "tum.ai"
	return w.charAt(0).toUpperCase() + w.slice(1);
}

export function titleCaseName(s: string | null | undefined): string {
	if (!s) return "";
	// Keep the original whitespace/separators, only transform word chunks.
	return s
		.split(/(\s+)/)
		.map((part) => (/^\s+$/.test(part) ? part : titleCaseWord(part)))
		.join("")
		.trim();
}

// ---- Same-role detection -------------------------------------------------
const STOP = new Set([
	"and",
	"at",
	"the",
	"of",
	"in",
	"for",
	"a",
	"an",
	"to",
	"with",
]);

export function roleTokens(title: string | null | undefined): Set<string> {
	if (!title) return new Set();
	return new Set(
		title
			.toLowerCase()
			.replace(/[^\p{L}\p{N}\s]/gu, " ")
			.split(/\s+/)
			.filter((w) => w && !STOP.has(w)),
	);
}

function yearsOverlap(
	aStart: number | null,
	aEnd: number | null,
	bStart: number | null,
	bEnd: number | null,
): boolean {
	const aS = aStart ?? Number.NEGATIVE_INFINITY;
	const aE = aEnd ?? Number.POSITIVE_INFINITY;
	const bS = bStart ?? Number.NEGATIVE_INFINITY;
	const bE = bEnd ?? Number.POSITIVE_INFINITY;
	return aS <= bE && bS <= aE;
}

// Two roles (at the SAME org/school — caller groups first) are the same job when
// their titles overlap a lot (Jaccard ≥ 0.5) and their year spans overlap. Empty
// titles on both sides count as the same.
export function rolesMatch(
	aTitle: string | null,
	aStart: number | null,
	aEnd: number | null,
	bTitle: string | null,
	bStart: number | null,
	bEnd: number | null,
): boolean {
	if (!yearsOverlap(aStart, aEnd, bStart, bEnd)) return false;
	const ta = roleTokens(aTitle);
	const tb = roleTokens(bTitle);
	if (ta.size === 0 && tb.size === 0) return true;
	if (ta.size === 0 || tb.size === 0) return false;
	let inter = 0;
	for (const t of ta) if (tb.has(t)) inter++;
	const union = new Set([...ta, ...tb]).size;
	return union > 0 && inter / union >= 0.5;
}

export interface RoleLike {
	title: string | null;
	start_year: number | null;
	end_year: number | null;
}

// Greedy clustering of same-org roles into same-job groups (pure, testable).
export function clusterRoles<T extends RoleLike>(rows: T[]): T[][] {
	const clusters: T[][] = [];
	for (const r of rows) {
		const cl = clusters.find((c) =>
			c.some((x) =>
				rolesMatch(
					x.title,
					x.start_year,
					x.end_year,
					r.title,
					r.start_year,
					r.end_year,
				),
			),
		);
		if (cl) cl.push(r);
		else clusters.push([r]);
	}
	return clusters;
}

// ---- DB consolidation ----------------------------------------------------
interface EmpRow {
	id: string;
	organization_id: string | null;
	title: string | null;
	start_year: number | null;
	end_year: number | null;
	is_current: boolean;
	status: string;
}
interface EduRow {
	id: string;
	school_id: string | null;
	degree: string | null;
	field: string | null;
	start_year: number | null;
	end_year: number | null;
	status: string;
}

const statusRank = (s: string): number =>
	s === "confirmed" ? 2 : s === "pending" ? 1 : 0;

// Best row to keep: confirmed over pending, then the richest title.
function pickKeeper<T extends RoleLike & { status: string }>(cluster: T[]): T {
	return [...cluster].sort((a, b) => {
		const sr = statusRank(b.status) - statusRank(a.status);
		if (sr !== 0) return sr;
		return roleTokens(b.title).size - roleTokens(a.title).size;
	})[0];
}

function mergeYears(cluster: RoleLike[]): {
	start: number | null;
	end: number | null;
} {
	const starts = cluster
		.map((r) => r.start_year)
		.filter((y): y is number => y != null);
	const ends = cluster.map((r) => r.end_year);
	const start = starts.length ? Math.min(...starts) : null;
	// If any row is open-ended (null end), the role is ongoing.
	const end = ends.some((e) => e == null)
		? null
		: Math.max(...ends.filter((e): e is number => e != null));
	return { start, end };
}

function richestTitle(cluster: { title: string | null }[]): string | null {
	return [...cluster].sort(
		(a, b) => roleTokens(b.title).size - roleTokens(a.title).size,
	)[0].title;
}

export interface ConsolidateResult {
	employment: number;
	education: number;
}

// Merge a single member's duplicate employment/education rows + title-case the
// surviving titles. Returns how many rows were removed.
export async function consolidateMemberClaims(
	userId: string,
	{ apply }: { apply: boolean },
): Promise<ConsolidateResult> {
	const supabase = getSupabase();
	const result: ConsolidateResult = { employment: 0, education: 0 };

	// EMPLOYMENT — group by org, cluster by role.
	const { data: empData } = await supabase
		.from("beacon_employment")
		.select(
			"id, organization_id, title, start_year, end_year, is_current, status",
		)
		.eq("user_id", userId)
		.in("status", ["confirmed", "pending"]);
	const byOrg = new Map<string, EmpRow[]>();
	for (const r of (empData ?? []) as EmpRow[]) {
		const k = r.organization_id ?? "∅";
		const list = byOrg.get(k) ?? [];
		list.push(r);
		byOrg.set(k, list);
	}
	for (const group of byOrg.values()) {
		for (const cluster of clusterRoles(group)) {
			const title = titleCaseName(richestTitle(cluster));
			const years = mergeYears(cluster);
			const isCurrent = cluster.some((r) => r.is_current) || years.end == null;
			const keeper = pickKeeper(cluster);
			if (apply) {
				await supabase
					.from("beacon_employment")
					.update({
						title: title || keeper.title,
						start_year: years.start,
						end_year: years.end,
						is_current: isCurrent,
					})
					.eq("id", keeper.id);
				const drop = cluster.filter((r) => r.id !== keeper.id).map((r) => r.id);
				if (drop.length)
					await supabase.from("beacon_employment").delete().in("id", drop);
			}
			result.employment += cluster.length - 1;
		}
	}

	// EDUCATION — group by school, cluster by degree+field.
	const { data: eduData } = await supabase
		.from("beacon_education")
		.select("id, school_id, degree, field, start_year, end_year, status")
		.eq("user_id", userId)
		.in("status", ["confirmed", "pending"]);
	const bySchool = new Map<string, EduRow[]>();
	for (const r of (eduData ?? []) as EduRow[]) {
		const k = r.school_id ?? "∅";
		const list = bySchool.get(k) ?? [];
		list.push(r);
		bySchool.set(k, list);
	}
	for (const group of bySchool.values()) {
		const asRoles = group.map((r) => ({
			...r,
			title: [r.degree, r.field].filter(Boolean).join(" ") || null,
		}));
		for (const cluster of clusterRoles(asRoles)) {
			const keeper = pickKeeper(cluster);
			const years = mergeYears(cluster);
			if (apply) {
				await supabase
					.from("beacon_education")
					.update({
						degree: titleCaseName(keeper.degree) || keeper.degree,
						field: titleCaseName(keeper.field) || keeper.field,
						start_year: years.start,
						end_year: years.end,
					})
					.eq("id", keeper.id);
				const drop = cluster.filter((r) => r.id !== keeper.id).map((r) => r.id);
				if (drop.length)
					await supabase.from("beacon_education").delete().in("id", drop);
			}
			result.education += cluster.length - 1;
		}
	}

	return result;
}

// Title-case every canonical organization / school display name (global,
// one-off — fixes pre-existing lowercase names). canonical_key is untouched, so
// dedup is unaffected.
export async function titleCaseEntities({
	apply,
}: {
	apply: boolean;
}): Promise<{ organizations: number; schools: number }> {
	const supabase = getSupabase();
	const out = { organizations: 0, schools: 0 };
	for (const table of ["beacon_organization", "beacon_school"] as const) {
		const { data } = await supabase.from(table).select("id, name");
		for (const row of (data ?? []) as { id: string; name: string }[]) {
			const next = titleCaseName(row.name);
			if (next && next !== row.name) {
				if (apply)
					await supabase.from(table).update({ name: next }).eq("id", row.id);
				if (table === "beacon_organization") out.organizations++;
				else out.schools++;
			}
		}
	}
	return out;
}
