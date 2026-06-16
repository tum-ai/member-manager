// Beacon search filter-DSL + candidate compilation. The NL parser emits this
// constrained DSL (never raw SQL); compileCandidates turns the structured
// filters into a candidate set of user_ids over CONFIRMED Layer-A claims.
// Semantic matching happens separately over Layer B (hybrid search).

import { z } from "zod";
import { type ClaimStatus, canonicalKey } from "./beacon.js";
import { getSupabase } from "./supabase.js";

// Statuses a candidate's claim may have to count as a match. Pending is included
// so enriched-but-unconfirmed members are findable (labeled "unverified" when
// surfaced); the reranker still favors confirmed signal.
export type StatusFilter = ClaimStatus[];
export const DEFAULT_STATUS: StatusFilter = ["confirmed", "pending"];

export const SearchDslSchema = z.object({
	org_tags: z.array(z.string()).default([]),
	school_groups: z.array(z.string()).default([]),
	skills: z.array(z.string()).default([]),
	tags: z.array(z.string()).default([]),
	semantic_query: z.string().default(""),
	needs_clarification: z.string().nullish(),
});
export type SearchDsl = z.infer<typeof SearchDslSchema>;

function intersect(sets: Set<string>[]): Set<string> {
	if (sets.length === 0) return new Set();
	let acc = sets[0];
	for (const s of sets.slice(1)) {
		acc = new Set([...acc].filter((x) => s.has(x)));
	}
	return acc;
}

async function usersByOrgTags(
	tags: string[],
	status: StatusFilter,
): Promise<Set<string>> {
	const supabase = getSupabase();
	const { data: orgs } = await supabase
		.from("beacon_organization")
		.select("id")
		.overlaps("tags", tags);
	const orgIds = (orgs ?? []).map((o) => (o as { id: string }).id);
	if (!orgIds.length) return new Set();
	const { data } = await supabase
		.from("beacon_employment")
		.select("user_id")
		.in("organization_id", orgIds)
		.in("status", status);
	return new Set((data ?? []).map((r) => (r as { user_id: string }).user_id));
}

async function usersBySchoolGroups(
	groups: string[],
	status: StatusFilter,
): Promise<Set<string>> {
	const supabase = getSupabase();
	const { data: schools } = await supabase
		.from("beacon_school")
		.select("id")
		.overlaps("groups", groups);
	const ids = (schools ?? []).map((s) => (s as { id: string }).id);
	if (!ids.length) return new Set();
	const { data } = await supabase
		.from("beacon_education")
		.select("user_id")
		.in("school_id", ids)
		.in("status", status);
	return new Set((data ?? []).map((r) => (r as { user_id: string }).user_id));
}

async function usersBySkills(
	skills: string[],
	status: StatusFilter,
): Promise<Set<string>> {
	const supabase = getSupabase();
	const keys = skills.map(canonicalKey).filter(Boolean);
	if (!keys.length) return new Set();
	const { data: rows } = await supabase
		.from("beacon_skill")
		.select("id")
		.in("canonical_key", keys);
	const ids = (rows ?? []).map((s) => (s as { id: string }).id);
	if (!ids.length) return new Set();
	const { data } = await supabase
		.from("beacon_person_skill")
		.select("user_id")
		.in("skill_id", ids)
		.in("status", status);
	return new Set((data ?? []).map((r) => (r as { user_id: string }).user_id));
}

async function usersByTags(
	tags: string[],
	status: StatusFilter,
): Promise<Set<string>> {
	const supabase = getSupabase();
	const { data } = await supabase
		.from("beacon_person_tag")
		.select("user_id")
		.in("tag", tags)
		.in("status", status);
	return new Set((data ?? []).map((r) => (r as { user_id: string }).user_id));
}

// Compile structured filters → candidate user_ids (AND across filter groups, OR
// within each group). Returns null when no structured filters are present (the
// search then ranks semantically over everyone). Defaults to confirmed+pending.
export async function compileCandidates(
	dsl: SearchDsl,
	status: StatusFilter = DEFAULT_STATUS,
): Promise<string[] | null> {
	const groups: Promise<Set<string>>[] = [];
	if (dsl.org_tags.length) groups.push(usersByOrgTags(dsl.org_tags, status));
	if (dsl.school_groups.length)
		groups.push(usersBySchoolGroups(dsl.school_groups, status));
	if (dsl.skills.length) groups.push(usersBySkills(dsl.skills, status));
	if (dsl.tags.length) groups.push(usersByTags(dsl.tags, status));
	if (groups.length === 0) return null;
	const sets = await Promise.all(groups);
	return [...intersect(sets)];
}
