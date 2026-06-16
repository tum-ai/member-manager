// Beacon Layer-B search index. Derives `beacon_search_chunk` rows ONLY from a
// member's CONFIRMED Layer-A claims (+ editable headline/summary). Chunks are
// always regenerated from Layer A, never hand-edited. Each chunk gets a dense
// embedding (OpenAI text-embedding-3-small, 1536-d) for vector search; the
// `lexeme` tsvector column is generated in-DB for sparse search.
//
// No OPENAI_API_KEY → chunks are still (re)built with NULL embeddings, so sparse
// (lexeme) search keeps working; embeddings backfill on a later run with a key.

import type { ExpertiseProfile } from "./beacon.js";
import { fetchWithTimeout } from "./fetchWithTimeout.js";

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

export type ChunkKind =
	| "headline"
	| "bio"
	| "employment"
	| "education"
	| "skill_cluster"
	| "project"
	| "tag";

export interface SearchChunk {
	kind: ChunkKind;
	content: string;
}

export function embeddingConfigured(): boolean {
	return Boolean(process.env.OPENAI_API_KEY?.trim());
}

const yrs = (a: number | null, b: number | null, cur?: boolean): string => {
	if (!a && !b) return "";
	const right = cur ? "present" : b ? String(b) : "";
	return a && right ? `${a}–${right}` : String(a ?? right);
};

// Build the chunk set from an aggregated (confirmed-only) profile. Pure +
// deterministic so it's unit-testable without a DB.
export function buildChunksForProfile(
	profile: Pick<
		ExpertiseProfile,
		"person" | "employment" | "education" | "skills" | "projects" | "tags"
	>,
): SearchChunk[] {
	const chunks: SearchChunk[] = [];
	const person = profile.person as {
		headline?: string | null;
		summary?: string | null;
	} | null;

	if (person?.headline?.trim()) {
		chunks.push({ kind: "headline", content: person.headline.trim() });
	}
	if (person?.summary?.trim()) {
		chunks.push({ kind: "bio", content: person.summary.trim() });
	}

	for (const e of profile.employment as Array<{
		title: string | null;
		is_current: boolean;
		start_year: number | null;
		end_year: number | null;
		raw_value: string | null;
		organization: { name: string; tags: string[] } | null;
	}>) {
		const org = e.organization?.name ?? e.raw_value ?? "";
		const tags = e.organization?.tags?.length
			? ` (${e.organization.tags.join(", ")})`
			: "";
		const span = yrs(e.start_year, e.end_year, e.is_current);
		const content =
			`${e.title ?? "Worked"} at ${org}${tags}${span ? `, ${span}` : ""}`.trim();
		if (org || e.title) chunks.push({ kind: "employment", content });
	}

	for (const ed of profile.education as Array<{
		degree: string | null;
		field: string | null;
		start_year: number | null;
		end_year: number | null;
		raw_value: string | null;
		school: { name: string; groups: string[] } | null;
	}>) {
		const school = ed.school?.name ?? ed.raw_value ?? "";
		const groups = ed.school?.groups?.length
			? ` (${ed.school.groups.join(", ")})`
			: "";
		const parts = [ed.degree, ed.field].filter(Boolean).join(" in ");
		const content = `${parts || "Studied"} at ${school}${groups}`.trim();
		if (school || parts) chunks.push({ kind: "education", content });
	}

	const skillNames = (
		profile.skills as Array<{
			raw_value: string | null;
			skill: { name: string } | null;
		}>
	)
		.map((s) => s.skill?.name ?? s.raw_value ?? "")
		.filter(Boolean);
	if (skillNames.length) {
		chunks.push({
			kind: "skill_cluster",
			content: `Skills: ${skillNames.join(", ")}`,
		});
	}

	for (const p of profile.projects as Array<{
		role: string | null;
		raw_value: string | null;
		project: { name: string; description: string | null } | null;
	}>) {
		const name = p.project?.name ?? p.raw_value ?? "";
		if (!name) continue;
		const content = [name, p.role, p.project?.description]
			.filter(Boolean)
			.join(". ");
		chunks.push({ kind: "project", content });
	}

	const tagLabels = (
		profile.tags as Array<{
			tag: string;
			vocabulary: { label: string } | null;
		}>
	)
		.map((t) => t.vocabulary?.label ?? t.tag)
		.filter(Boolean);
	if (tagLabels.length) {
		chunks.push({
			kind: "tag",
			content: `Capabilities: ${tagLabels.join(", ")}`,
		});
	}

	return chunks;
}

// Embed an array of texts via OpenAI. Returns one vector per input (aligned by
// index). No key → array of nulls (caller stores NULL embeddings).
export async function embedTexts(
	texts: string[],
	timeoutMs = 30_000,
): Promise<(number[] | null)[]> {
	const apiKey = process.env.OPENAI_API_KEY?.trim();
	if (!apiKey || texts.length === 0) return texts.map(() => null);

	const res = await fetchWithTimeout(
		OPENAI_EMBEDDINGS_URL,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
		},
		timeoutMs,
	);
	if (!res.ok) {
		throw new Error(
			`OpenAI embeddings failed: ${res.status} ${await res.text()}`,
		);
	}
	const body = (await res.json()) as {
		data?: Array<{ index: number; embedding: number[] }>;
	};
	const out: (number[] | null)[] = texts.map(() => null);
	for (const item of body.data ?? []) {
		if (item.index >= 0 && item.index < out.length)
			out[item.index] = item.embedding;
	}
	return out;
}

// pgvector accepts the literal "[f1,f2,…]" via PostgREST.
export function toVectorLiteral(embedding: number[] | null): string | null {
	return embedding ? `[${embedding.join(",")}]` : null;
}
