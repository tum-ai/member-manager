// Beacon search filter-DSL + candidate compilation. The NL parser emits this
// constrained DSL (never raw SQL); compileCandidates turns the structured
// filters into a candidate set of user_ids over CONFIRMED Layer-A claims.
// Semantic matching happens separately over Layer B (hybrid search).

import { z } from "zod";
import {
	type ClaimStatus,
	canonicalKey,
	visibleBeaconMemberIds,
} from "./beacon.js";
import { DatabaseError } from "./errors.js";
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

/** Whether the query contains any deterministic Layer-A filter. */
export function hasStructuredFilters(dsl: SearchDsl): boolean {
	return Boolean(
		dsl.org_tags.length ||
			dsl.school_groups.length ||
			dsl.skills.length ||
			dsl.tags.length,
	);
}

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
	const { data: orgs, error: orgError } = await supabase
		.from("beacon_organization")
		.select("id")
		.overlaps("tags", tags);
	if (orgError)
		throw new DatabaseError("Failed to resolve Beacon organizations");
	const orgIds = (orgs ?? []).map((o) => (o as { id: string }).id);
	if (!orgIds.length) return new Set();
	const { data, error } = await supabase
		.from("beacon_employment")
		.select("user_id")
		.in("organization_id", orgIds)
		.in("status", status);
	if (error) throw new DatabaseError("Failed to search Beacon employment");
	return new Set((data ?? []).map((r) => (r as { user_id: string }).user_id));
}

async function usersBySchoolGroups(
	groups: string[],
	status: StatusFilter,
): Promise<Set<string>> {
	const supabase = getSupabase();
	const { data: schools, error: schoolError } = await supabase
		.from("beacon_school")
		.select("id")
		.overlaps("groups", groups);
	if (schoolError) throw new DatabaseError("Failed to resolve Beacon schools");
	const ids = (schools ?? []).map((s) => (s as { id: string }).id);
	if (!ids.length) return new Set();
	const { data, error } = await supabase
		.from("beacon_education")
		.select("user_id")
		.in("school_id", ids)
		.in("status", status);
	if (error) throw new DatabaseError("Failed to search Beacon education");
	return new Set((data ?? []).map((r) => (r as { user_id: string }).user_id));
}

async function usersBySkills(
	skills: string[],
	status: StatusFilter,
): Promise<Set<string>> {
	const supabase = getSupabase();
	const keys = skills.map(canonicalKey).filter(Boolean);
	if (!keys.length) return new Set();
	const { data: rows, error: skillError } = await supabase
		.from("beacon_skill")
		.select("id")
		.in("canonical_key", keys);
	if (skillError) throw new DatabaseError("Failed to resolve Beacon skills");
	const ids = (rows ?? []).map((s) => (s as { id: string }).id);
	if (!ids.length) return new Set();
	const { data, error } = await supabase
		.from("beacon_person_skill")
		.select("user_id")
		.in("skill_id", ids)
		.in("status", status);
	if (error) throw new DatabaseError("Failed to search Beacon skills");
	return new Set((data ?? []).map((r) => (r as { user_id: string }).user_id));
}

async function usersByTags(
	tags: string[],
	status: StatusFilter,
): Promise<Set<string>> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from("beacon_person_tag")
		.select("user_id")
		.in("tag", tags)
		.in("status", status);
	if (error) throw new DatabaseError("Failed to search Beacon capabilities");
	return new Set((data ?? []).map((r) => (r as { user_id: string }).user_id));
}

// Compile structured filters → visible candidate user_ids (AND across filter
// groups, OR within each group). With no structured filters, all visible
// members are returned so the service-role hybrid-search RPC can never range
// over opted-out or inactive members. Defaults to confirmed+pending claims.
export async function compileCandidates(
	dsl: SearchDsl,
	status: StatusFilter = DEFAULT_STATUS,
): Promise<string[]> {
	const groups: Promise<Set<string>>[] = [];
	if (dsl.org_tags.length) groups.push(usersByOrgTags(dsl.org_tags, status));
	if (dsl.school_groups.length)
		groups.push(usersBySchoolGroups(dsl.school_groups, status));
	if (dsl.skills.length) groups.push(usersBySkills(dsl.skills, status));
	if (dsl.tags.length) groups.push(usersByTags(dsl.tags, status));
	if (groups.length === 0) return [...(await visibleBeaconMemberIds())];
	const sets = await Promise.all(groups);
	const candidates = [...intersect(sets)];
	const visible = await visibleBeaconMemberIds(candidates);
	return candidates.filter((id) => visible.has(id));
}
