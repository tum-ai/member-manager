// Beacon expertise-portal data access. Centralizes the Layer-A claim model so
// both the member-facing routes (expertise.ts) and the enrichment job (Phase 3)
// share one canonicalization + aggregation path.
//
// All access uses the service-role client (getSupabase) and is gated by the
// caller in the route layer (ensureOwnerOrAdmin). RLS is a defensive second
// layer only.

import { titleCaseName } from "./claimConsolidation.js";
import {
	buildChunksForProfile,
	embedTexts,
	toVectorLiteral,
} from "./searchChunks.js";
import { getSupabase } from "./supabase.js";

// Claim edge tables, keyed by the short type used in API paths.
export const CLAIM_TABLES = {
	employment: "beacon_employment",
	education: "beacon_education",
	skill: "beacon_person_skill",
	project: "beacon_person_project",
	tag: "beacon_person_tag",
} as const;

export type ClaimType = keyof typeof CLAIM_TABLES;

export const CLAIM_STATUSES = ["confirmed", "pending", "rejected"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// Normalize a free-text entity name to the canonical_key used for dedup. Same
// rule everywhere (resolve, enrichment, search), so "Google " and "google"
// collapse to one row.
export function canonicalKey(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, " ");
}

interface CanonicalEntity {
	id: string;
	name: string;
	[key: string]: unknown;
}

// Find-or-create a canonical entity by its canonical_key. Tolerant of the
// insert race (unique violation → refetch). Returns null only for empty names.
async function resolveCanonical(
	table:
		| "beacon_organization"
		| "beacon_school"
		| "beacon_skill"
		| "beacon_project",
	name: string,
): Promise<CanonicalEntity | null> {
	const key = canonicalKey(name);
	if (!key) return null;
	const supabase = getSupabase();

	const existing = await supabase
		.from(table)
		.select("*")
		.eq("canonical_key", key)
		.maybeSingle();
	if (existing.data) return existing.data as CanonicalEntity;

	// Title-case org/school display names on create (self/PDL often arrive
	// lowercase); canonical_key (the dedup key) stays normalized regardless.
	const displayName =
		table === "beacon_organization" || table === "beacon_school"
			? titleCaseName(name)
			: name.trim();
	const created = await supabase
		.from(table)
		.insert({ name: displayName, canonical_key: key })
		.select("*")
		.single();
	if (!created.error && created.data) return created.data as CanonicalEntity;

	// Likely a concurrent insert hit the unique(canonical_key); refetch.
	const retry = await supabase
		.from(table)
		.select("*")
		.eq("canonical_key", key)
		.maybeSingle();
	return (retry.data as CanonicalEntity | null) ?? null;
}

export const resolveOrganization = (name: string) =>
	resolveCanonical("beacon_organization", name);
export const resolveSchool = (name: string) =>
	resolveCanonical("beacon_school", name);
export const resolveSkill = (name: string) =>
	resolveCanonical("beacon_skill", name);
export const resolveProject = (name: string) =>
	resolveCanonical("beacon_project", name);

// Read-only lookup by canonical_key (no create). Used by the enrichment job's
// dry-run so a `--dry` pass never writes canonical entities.
async function findCanonical(
	table:
		| "beacon_organization"
		| "beacon_school"
		| "beacon_skill"
		| "beacon_project",
	name: string,
): Promise<CanonicalEntity | null> {
	const key = canonicalKey(name);
	if (!key) return null;
	const { data } = await getSupabase()
		.from(table)
		.select("*")
		.eq("canonical_key", key)
		.maybeSingle();
	return (data as CanonicalEntity | null) ?? null;
}

export const findOrganization = (name: string) =>
	findCanonical("beacon_organization", name);
export const findSchool = (name: string) =>
	findCanonical("beacon_school", name);
export const findSkill = (name: string) => findCanonical("beacon_skill", name);
export const findProject = (name: string) =>
	findCanonical("beacon_project", name);

export type SourceKind =
	| "self"
	| "csv"
	| "github"
	| "linkedin"
	| "pdl"
	| "blog"
	| "web_search"
	| "slack";

// Normalize a free-text capability into a vocabulary tag slug. Idempotent for
// existing slugs (e.g. "shipped_app_store" → "shipped_app_store").
export function tagSlug(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

function humanizeTag(slug: string): string {
	return slug
		.split("_")
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

// Grow the controlled tag vocabulary: ensure a tag slug exists so a
// `beacon_person_tag` row can FK to it. Newly discovered tags (e.g. from web
// research) are added here. Best-effort + race-tolerant.
export async function ensureTagVocabulary(
	tag: string,
	label?: string | null,
	category?: string | null,
): Promise<void> {
	const supabase = getSupabase();
	const existing = await supabase
		.from("beacon_tag_vocabulary")
		.select("tag")
		.eq("tag", tag)
		.maybeSingle();
	if (existing.data) return;
	await supabase.from("beacon_tag_vocabulary").insert({
		tag,
		label: label?.trim() || humanizeTag(tag),
		category: category?.trim() || "discovered",
	});
}

// Persist a one-line description / url onto the canonical project — only fills
// blanks, never clobbers an existing value. Lets enrichment record "what a
// project is" (e.g. NeatPass = an iOS password manager) so search and the
// assistant can use it. Best-effort.
export async function updateProjectDetails(
	projectId: string,
	patch: { description?: string | null; url?: string | null },
): Promise<void> {
	const supabase = getSupabase();
	const { data } = await supabase
		.from("beacon_project")
		.select("description, url")
		.eq("id", projectId)
		.maybeSingle();
	const cur = (data ?? {}) as {
		description: string | null;
		url: string | null;
	};
	const set: Record<string, unknown> = {};
	if (!cur.description && patch.description?.trim())
		set.description = patch.description.trim();
	if (!cur.url && patch.url?.trim()) set.url = patch.url.trim();
	if (Object.keys(set).length === 0) return;
	await supabase.from("beacon_project").update(set).eq("id", projectId);
}

// Record a provenance source row (enrichment writes one per origin per run).
export async function createSource(input: {
	kind: SourceKind;
	url?: string | null;
	title?: string | null;
	identityConfirmed?: boolean;
}): Promise<string> {
	const { data, error } = await getSupabase()
		.from("beacon_source")
		.insert({
			kind: input.kind,
			url: input.url ?? null,
			title: input.title ?? null,
			identity_confirmed: input.identityConfirmed ?? false,
			fetched_at: new Date().toISOString(),
		})
		.select("id")
		.single();
	if (error) throw error;
	return (data as { id: string }).id;
}

// Embed strings for PostgREST nested selects (FK-detected relationships).
const EMBEDS: Record<ClaimType, string> = {
	employment:
		"*, organization:beacon_organization(id,name,tags,domain), source:beacon_source(id,kind,url,title,identity_confirmed)",
	education:
		"*, school:beacon_school(id,name,groups,country), source:beacon_source(id,kind,url,title,identity_confirmed)",
	skill:
		"*, skill:beacon_skill(id,name,category), source:beacon_source(id,kind,url,title,identity_confirmed)",
	project:
		"*, project:beacon_project(id,name,url,description), source:beacon_source(id,kind,url,title,identity_confirmed)",
	tag: "*, vocabulary:beacon_tag_vocabulary(tag,label,category,description), source:beacon_source(id,kind,url,title,identity_confirmed)",
};

export interface ExpertiseProfile {
	user_id: string;
	person: Record<string, unknown> | null;
	member: Record<string, unknown> | null;
	employment: unknown[];
	education: unknown[];
	skills: unknown[];
	projects: unknown[];
	tags: unknown[];
	counts: { confirmed: number; pending: number; rejected: number };
}

// NB: `members` has no avatar column (the client derives avatars elsewhere and
// falls back to initials), so it is intentionally not selected here.
const MEMBER_PROFILE_FIELDS =
	"user_id, given_name, surname, department, batch, member_role, board_role, linkedin_profile_url, linkedin_url, public_location, member_status";

// Aggregate a member's full expertise profile. When `confirmedOnly` is set
// (someone viewing another member), only confirmed claims are returned and the
// profile is hidden entirely if the member opted out. `statuses` overrides the
// claim-status filter (e.g. ["confirmed","pending"] for the search index /
// assistant tools); it does NOT trigger opt-out hiding — callers that index or
// answer on behalf of others check `person.opted_out` themselves.
export async function getExpertiseProfile(
	userId: string,
	{
		confirmedOnly = false,
		statuses,
	}: { confirmedOnly?: boolean; statuses?: ClaimStatus[] } = {},
): Promise<ExpertiseProfile | null> {
	const supabase = getSupabase();

	const personRes = await supabase
		.from("beacon_person")
		.select("*")
		.eq("user_id", userId)
		.maybeSingle();
	const person = (personRes.data as Record<string, unknown> | null) ?? null;

	if (confirmedOnly && person?.opted_out === true) return null;

	const memberRes = await supabase
		.from("members")
		.select(MEMBER_PROFILE_FIELDS)
		.eq("user_id", userId)
		.maybeSingle();

	// Status filter precedence: explicit `statuses` wins; else confirmedOnly →
	// confirmed-only; else no filter (all statuses, incl. rejected).
	const statusFilter: ClaimStatus[] | null =
		statuses ?? (confirmedOnly ? ["confirmed"] : null);

	const fetchClaims = async (type: ClaimType) => {
		let q = supabase
			.from(CLAIM_TABLES[type])
			.select(EMBEDS[type])
			.eq("user_id", userId);
		if (statusFilter) q = q.in("status", statusFilter);
		const { data } = await q.order("confidence", { ascending: false });
		return data ?? [];
	};

	const [employment, education, skills, projects, tags] = await Promise.all([
		fetchClaims("employment"),
		fetchClaims("education"),
		fetchClaims("skill"),
		fetchClaims("project"),
		fetchClaims("tag"),
	]);

	const all = [
		...employment,
		...education,
		...skills,
		...projects,
		...tags,
	] as {
		status?: string;
	}[];
	const counts = { confirmed: 0, pending: 0, rejected: 0 };
	for (const c of all) {
		if (c.status && c.status in counts) {
			counts[c.status as ClaimStatus]++;
		}
	}

	return {
		user_id: userId,
		person,
		member: (memberRes.data as Record<string, unknown> | null) ?? null,
		employment,
		education,
		skills,
		projects,
		tags,
		counts,
	};
}

// Upsert the per-person Beacon row (editable headline/summary; consent stamp on
// first write). Returns the row.
export async function upsertBeaconPerson(
	userId: string,
	patch: { headline?: string | null; summary?: string | null },
): Promise<Record<string, unknown>> {
	const supabase = getSupabase();
	const existing = await supabase
		.from("beacon_person")
		.select("user_id, consent_at")
		.eq("user_id", userId)
		.maybeSingle();

	const row: Record<string, unknown> = { user_id: userId, ...patch };
	// Stamp consent the first time a member curates their profile.
	if (!existing.data?.consent_at) row.consent_at = new Date().toISOString();

	const { data, error } = await supabase
		.from("beacon_person")
		.upsert(row, { onConflict: "user_id" })
		.select("*")
		.single();
	if (error) throw error;
	return data as Record<string, unknown>;
}

// Hard opt-out: flag the person and purge their search index. Search chunks are
// always regenerable from confirmed claims, so deleting them is safe.
export async function setOptOut(
	userId: string,
	optedOut: boolean,
): Promise<void> {
	const supabase = getSupabase();
	const row: Record<string, unknown> = {
		user_id: userId,
		opted_out: optedOut,
	};
	if (!optedOut) row.consent_at = new Date().toISOString();
	const { error } = await supabase
		.from("beacon_person")
		.upsert(row, { onConflict: "user_id" });
	if (error) throw error;

	if (optedOut) {
		await supabase.from("beacon_search_chunk").delete().eq("user_id", userId);
	}
}

// Statuses indexed into Layer B. We include pending so enrichment is
// immediately searchable (pending facts are labeled "unverified" when the
// assistant presents them); rejected claims are always excluded.
export const SEARCH_INDEX_STATUSES: ClaimStatus[] = ["confirmed", "pending"];

export interface RebuildResult {
	chunks: number;
	embedded: number;
	cleared: boolean;
}

// Regenerate a single member's Layer-B search chunks from their current claims
// (confirmed + pending) and editable headline/summary. Full delete + insert —
// Layer B is derived, never hand-edited. Opted-out / empty members are purged.
// Embeds only when OPENAI_API_KEY is present (else NULL embeddings; sparse
// search still works). Shared by the build script and the on-mutation hook.
export async function rebuildSearchChunks(
	userId: string,
): Promise<RebuildResult> {
	const supabase = getSupabase();
	const profile = await getExpertiseProfile(userId, {
		statuses: SEARCH_INDEX_STATUSES,
	});
	const optedOut = (profile?.person as { opted_out?: boolean } | null)
		?.opted_out;

	const purge = async () => {
		await supabase.from("beacon_search_chunk").delete().eq("user_id", userId);
	};

	if (!profile || optedOut === true) {
		await purge();
		return { chunks: 0, embedded: 0, cleared: true };
	}

	const chunks = buildChunksForProfile(profile);
	if (chunks.length === 0) {
		await purge();
		return { chunks: 0, embedded: 0, cleared: true };
	}

	const embeddings = await embedTexts(chunks.map((c) => c.content));
	const embedded = embeddings.filter(Boolean).length;

	await purge();
	const rows = chunks.map((c, i) => ({
		user_id: userId,
		kind: c.kind,
		content: c.content,
		embedding: toVectorLiteral(embeddings[i]),
	}));
	const { error } = await supabase.from("beacon_search_chunk").insert(rows);
	if (error) throw error;

	return { chunks: chunks.length, embedded, cleared: false };
}

// On-mutation hook: when a member's claims change (add/edit/confirm/reject/
// delete), their search index is stale. Rebuild it best-effort — a failed
// reindex must NEVER fail the claim write, so this swallows errors. Callers
// fire-and-forget (`void markSearchIndexStale(...)`) to keep write latency flat.
export async function markSearchIndexStale(userId: string): Promise<void> {
	try {
		await rebuildSearchChunks(userId);
	} catch (err) {
		console.error(
			`[beacon] rebuildSearchChunks failed for ${userId}:`,
			err instanceof Error ? err.message : err,
		);
	}
}
