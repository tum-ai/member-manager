// Web-research enrichment tier — uses OpenAI's NATIVE web search (Responses API
// `web_search` tool) to research one person on the open web and extract claims
// with per-fact source URLs. Everything it returns is treated as low-trust:
// identity is NOT confirmed, so the enrichment gate lands all of it as
// `pending` for member review. Tags may be NEW (vocabulary expansion).
//
// No OPENAI_API_KEY → returns nothing and the job skips this tier.

import type { SourceKind } from "./beacon.js";
import { normalizeYear, type ProposedClaim } from "./claims.js";
import { fetchWithTimeout } from "./fetchWithTimeout.js";

const RESPONSES_URL = "https://api.openai.com/v1/responses";

export function webResearchConfigured(): boolean {
	return Boolean(process.env.OPENAI_API_KEY?.trim());
}

// Classify a discovered URL into a provenance source kind.
export function kindFromUrl(url: string): SourceKind {
	if (!url) return "web_search";
	try {
		const host = new URL(url).hostname.replace(/^www\./, "");
		if (host.includes("github.com")) return "github";
		if (host.includes("linkedin.com")) return "linkedin";
		if (
			host.includes("medium.com") ||
			host.includes("substack.com") ||
			host.includes("blog") ||
			host.includes("dev.to")
		)
			return "blog";
		return "web_search";
	} catch {
		return "web_search";
	}
}

export function titleFromUrl(url: string): string | null {
	if (!url) return null;
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
}

export interface ResearchInput {
	name: string;
	linkedinUrl?: string | null;
	department?: string | null;
	currentRole?: string | null;
	location?: string | null;
}

export interface ResearchItem {
	claim: ProposedClaim;
	sourceUrl: string | null;
}
export interface ResearchResult {
	items: ResearchItem[];
	summary: string | null;
}

const SYSTEM =
	"You are a careful researcher assembling a professional profile of ONE " +
	"specific person for an internal company directory. Use web search to find " +
	"public, professional information: employers and roles, education, notable " +
	"projects / open-source, talks, publications, and skills. Only include facts " +
	"you are confident refer to THIS person (match the name and the provided " +
	"LinkedIn / identity); when unsure, omit it. Never fabricate. Write all " +
	"names — skills, fields, schools, projects — in ENGLISH (translate " +
	"non-English terms to their common English equivalent). Attach the " +
	"source_url you found each fact on. Return ONLY a JSON object — no prose.";

function buildPrompt(input: ResearchInput): string {
	const ctx = [
		`Person: ${input.name}`,
		input.linkedinUrl && `LinkedIn: ${input.linkedinUrl}`,
		input.department && `Department at TUM.ai: ${input.department}`,
		input.currentRole && `Known current role: ${input.currentRole}`,
		input.location && `Location: ${input.location}`,
	]
		.filter(Boolean)
		.join("\n");

	return `${ctx}

Research this person and return JSON shaped exactly like:
{
  "summary": "1-2 sentence professional summary",
  "employment": [{"organization":"","title":"","start_year":2020,"end_year":null,"is_current":true,"confidence":0.0,"source_url":""}],
  "education": [{"school":"","degree":"","field":"","start_year":null,"end_year":null,"confidence":0.0,"source_url":""}],
  "projects": [{"name":"","url":"","description":"","role":"","confidence":0.0,"source_url":""}],
  "skills": [{"name":"","confidence":0.0,"source_url":""}],
  "tags": [{"tag":"snake_case_slug","label":"Human Label","category":"capability","confidence":0.0,"source_url":""}]
}
Omit any array you find nothing for. "confidence" (0..1) reflects how sure you are it is THIS person AND the fact is correct. Tags are open-vocabulary: propose concise snake_case capability/domain descriptors with a human label — you are NOT limited to a fixed list.`;
}

interface ResponsesBody {
	output_text?: string;
	output?: Array<{
		type?: string;
		content?: Array<{
			type?: string;
			text?: string;
			annotations?: Array<{ type?: string; url?: string }>;
		}>;
	}>;
}

async function callWebSearch(
	prompt: string,
): Promise<{ text: string; citations: string[] }> {
	const key = process.env.OPENAI_API_KEY?.trim();
	if (!key) return { text: "", citations: [] };

	const res = await fetchWithTimeout(
		RESPONSES_URL,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${key}`,
			},
			body: JSON.stringify({
				model: process.env.OPENAI_RESEARCH_MODEL?.trim() || "gpt-5.4",
				reasoning: { effort: "medium" },
				tools: [
					{ type: process.env.OPENAI_WEB_SEARCH_TOOL?.trim() || "web_search" },
				],
				instructions: SYSTEM,
				input: prompt,
				max_output_tokens: 32_000,
			}),
		},
		240_000,
	);
	if (!res.ok) {
		throw new Error(
			`OpenAI web search failed: ${res.status} ${await res.text()}`,
		);
	}
	const body = (await res.json()) as ResponsesBody;

	let text = "";
	const citations: string[] = [];
	for (const item of body.output ?? []) {
		if (item?.type !== "message" || !Array.isArray(item.content)) continue;
		for (const c of item.content) {
			if (c?.type === "output_text" && typeof c.text === "string") {
				text += c.text;
				for (const a of c.annotations ?? []) {
					if (a?.type === "url_citation" && a.url) citations.push(a.url);
				}
			}
		}
	}
	if (!text && typeof body.output_text === "string") text = body.output_text;
	return { text, citations };
}

const s = (v: unknown): string | null =>
	typeof v === "string" && v.trim() ? v.trim() : null;
const conf = (v: unknown): number =>
	typeof v === "number" ? Math.min(1, Math.max(0, v)) : 0.5;

function extractJsonObject(text: string): Record<string, unknown> | null {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end < 0 || end < start) return null;
	try {
		return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
	} catch {
		return null;
	}
}

// Parse the model's JSON into proposed claims + per-fact source URLs. Exported
// for unit testing (no network).
export function parseResearchJson(text: string): ResearchResult {
	const obj = extractJsonObject(text);
	if (!obj) return { items: [], summary: null };
	const items: ResearchItem[] = [];
	const arr = (k: string): Record<string, unknown>[] =>
		Array.isArray(obj[k]) ? (obj[k] as Record<string, unknown>[]) : [];

	for (const e of arr("employment")) {
		const org = s(e.organization);
		const title = s(e.title);
		if (!org && !title) continue;
		items.push({
			sourceUrl: s(e.source_url),
			claim: {
				type: "employment",
				organizationName: org,
				title,
				startYear: normalizeYear(e.start_year),
				endYear: normalizeYear(e.end_year),
				isCurrent: e.is_current === true,
				confidence: conf(e.confidence),
				rawValue: org ?? title ?? "experience",
			},
		});
	}

	for (const e of arr("education")) {
		const school = s(e.school);
		if (!school) continue;
		items.push({
			sourceUrl: s(e.source_url),
			claim: {
				type: "education",
				schoolName: school,
				degree: s(e.degree),
				field: s(e.field),
				startYear: normalizeYear(e.start_year),
				endYear: normalizeYear(e.end_year),
				confidence: conf(e.confidence),
				rawValue: school,
			},
		});
	}

	for (const p of arr("projects")) {
		const name = s(p.name);
		if (!name) continue;
		items.push({
			sourceUrl: s(p.source_url) ?? s(p.url),
			claim: {
				type: "project",
				projectName: name,
				url: s(p.url),
				description: s(p.description),
				role: s(p.role),
				confidence: conf(p.confidence),
				rawValue: name,
			},
		});
	}

	for (const k of arr("skills")) {
		const name = s(k.name);
		if (!name) continue;
		items.push({
			sourceUrl: s(k.source_url),
			claim: {
				type: "skill",
				skillName: name,
				confidence: conf(k.confidence),
				rawValue: name,
			},
		});
	}

	for (const t of arr("tags")) {
		const tag = s(t.tag);
		if (!tag) continue;
		items.push({
			sourceUrl: s(t.source_url),
			claim: {
				type: "tag",
				tag,
				label: s(t.label),
				category: s(t.category),
				confidence: conf(t.confidence),
				rawValue: s(t.label) ?? tag,
			},
		});
	}

	return { items, summary: s(obj.summary) };
}

// Research a person on the web and return proposed claims (all pending after
// gating, since identity is unverified). No key → empty.
export async function researchPerson(
	input: ResearchInput,
): Promise<ResearchResult> {
	if (!webResearchConfigured()) return { items: [], summary: null };
	const { text, citations } = await callWebSearch(buildPrompt(input));
	const result = parseResearchJson(text);
	// Backfill a source URL from citations when the model omitted one.
	if (citations.length) {
		for (const it of result.items) {
			if (!it.sourceUrl) it.sourceUrl = citations[0];
		}
	}
	return result;
}
