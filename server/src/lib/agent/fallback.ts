// The ranked member-search pipeline, extracted from routes/search.ts so it can
// be reused by (a) the `search_members` agent tool, (b) the legacy
// /api/expertise/search route, and (c) the orchestrator's no-API-key fallback.
//   parse (NL→DSL) → deterministic skill enrich → fold @mentions →
//   compile candidates (Layer A, confirmed+pending) → embed → hybrid+RRF
//   (Layer B) → listwise rerank.

import { embedTexts, toVectorLiteral } from "../searchChunks.js";
import { compileCandidates, type SearchDsl } from "../searchDsl.js";
import {
	type Candidate,
	composeAnswer,
	enrichDslWithDeterministicSkills,
	type FilterVocab,
	parseQuery,
	rerankCandidates,
} from "../searchLlm.js";
import { getSupabase } from "../supabase.js";

interface MemberRow {
	user_id: string;
	given_name: string | null;
	surname: string | null;
}
export const nameOf = (m: MemberRow): string =>
	[m.given_name, m.surname].filter(Boolean).join(" ") || "Member";

// Distinct filter vocabulary for the parser (from seeded/enriched data).
export async function loadFilterVocab(): Promise<FilterVocab> {
	const supabase = getSupabase();
	const [orgs, schools, tags] = await Promise.all([
		supabase.from("beacon_organization").select("tags"),
		supabase.from("beacon_school").select("groups"),
		supabase.from("beacon_tag_vocabulary").select("tag,label"),
	]);
	const orgTags = new Set<string>();
	for (const o of (orgs.data ?? []) as { tags: string[] }[])
		for (const t of o.tags ?? []) orgTags.add(t);
	const schoolGroups = new Set<string>();
	for (const s of (schools.data ?? []) as { groups: string[] }[])
		for (const g of s.groups ?? []) schoolGroups.add(g);
	return {
		orgTags: [...orgTags],
		schoolGroups: [...schoolGroups],
		capabilityTags: (tags.data ?? []) as { tag: string; label: string }[],
	};
}

export interface MemberSearchResult {
	people: Candidate[];
	dsl: SearchDsl;
}

export interface MemberSearchInput {
	text: string;
	mentions?: { user_id: string; label?: string }[];
	topK?: number;
}

// Retrieve + rank people for a query. Does NOT compose prose (the caller does)
// and never short-circuits on needs_clarification — it always attempts a search
// (the assistant biases toward answering).
export async function runMemberSearch(
	input: MemberSearchInput,
): Promise<MemberSearchResult> {
	const supabase = getSupabase();
	const text = input.text;
	const mentions = input.mentions ?? [];
	const topK = input.topK ?? 12;

	const vocab = await loadFilterVocab();
	let dsl = await parseQuery(text, vocab);
	dsl = await enrichDslWithDeterministicSkills(dsl, text);

	// "similar to @X": fold the mentioned members' chunk text into the semantic
	// query so retrieval leans toward people like them.
	let semantic = dsl.semantic_query || text;
	if (mentions.length) {
		const { data: chunks } = await supabase
			.from("beacon_search_chunk")
			.select("content")
			.in(
				"user_id",
				mentions.map((m) => m.user_id),
			)
			.limit(6);
		const extra = (chunks ?? [])
			.map((c) => (c as { content: string }).content)
			.join(". ");
		if (extra) semantic = `${semantic}. ${extra}`;
	}

	const candidates = await compileCandidates(dsl);
	const queryEmbedding = (await embedTexts([semantic]))[0];

	const { data: hits, error } = await supabase.rpc("beacon_hybrid_search", {
		q_embedding: toVectorLiteral(queryEmbedding),
		q_text: semantic,
		candidate_ids: candidates,
		match_limit: 20,
	});
	if (error) throw error;

	const rows = (hits ?? []) as {
		user_id: string;
		score: number;
		best_chunk: string | null;
	}[];
	const hitById = new Map(rows.map((r) => [r.user_id, r]));

	// When structured filters are present, those candidates are the answer set:
	// include all of them (hits first, then the rest), so e.g. "worked at big
	// tech" still returns matches even when the semantic ranker is dark.
	let finalIds: string[];
	if (candidates === null) {
		finalIds = rows.map((r) => r.user_id);
	} else {
		const hitOrder = rows
			.map((r) => r.user_id)
			.filter((id) => candidates.includes(id));
		const rest = candidates.filter((id) => !hitById.has(id));
		finalIds = [...hitOrder, ...rest].slice(0, 20);
	}

	let people: Candidate[] = [];
	if (finalIds.length) {
		const { data: members } = await supabase
			.from("members")
			.select("user_id, given_name, surname")
			.in("user_id", finalIds);
		const byId = new Map(
			(members ?? []).map((m) => [(m as MemberRow).user_id, m as MemberRow]),
		);
		people = finalIds
			.filter((id) => byId.has(id))
			.map((id) => {
				const m = byId.get(id) as MemberRow;
				const hit = hitById.get(id);
				return {
					user_id: id,
					name: nameOf(m),
					avatar_url: null,
					best_chunk: hit?.best_chunk ?? null,
					score: hit?.score ?? 0,
				};
			});
	}

	const reranked = (await rerankCandidates(text, people)).slice(0, topK);
	return { people: reranked, dsl };
}

export interface MemberSearchAnswer extends MemberSearchResult {
	answer: string;
}

// Full single-shot search → prose answer. Used by the legacy route and by the
// orchestrator's no-API-key degradation path.
export async function runMemberSearchAnswer(
	input: MemberSearchInput,
): Promise<MemberSearchAnswer> {
	const { people, dsl } = await runMemberSearch(input);
	const answer = await composeAnswer(input.text, people);
	return { answer, people, dsl };
}
