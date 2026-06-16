// People Data Labs (PDL) Person Enrichment client. READ-ONLY external API used
// by the enrichment job to turn a verified identity (ideally a LinkedIn URL)
// into employment / education / skill claims. No key configured → returns null
// and the job falls back to self-data only.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProposedClaim } from "./claims.js";
import { normalizeYear } from "./claims.js";
import { fetchWithTimeout } from "./fetchWithTimeout.js";

const PDL_ENRICH_URL = "https://api.peopledatalabs.com/v5/person/enrich";

// On-disk PDL response cache (gitignored server/.cache/pdl) so repeated local
// dev runs don't burn the API quota. Keyed by the enrichment params; caches
// "no match" too. Disable with PDL_CACHE=0.
const PDL_CACHE_DIR = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../.cache/pdl",
);

function pdlCacheEnabled(): boolean {
	return process.env.PDL_CACHE !== "0";
}

function pdlCacheFile(input: EnrichInput): string {
	const key = createHash("sha256")
		.update(
			JSON.stringify({
				l: input.linkedinUrl ?? "",
				n: input.name ?? "",
				c: input.company ?? "",
				loc: input.location ?? "",
			}),
		)
		.digest("hex")
		.slice(0, 24);
	return resolve(PDL_CACHE_DIR, `${key}.json`);
}

// undefined = cache miss; null = cached "no match"; PdlResult = cached hit.
function readPdlCache(input: EnrichInput): PdlResult | null | undefined {
	if (!pdlCacheEnabled()) return undefined;
	try {
		const file = pdlCacheFile(input);
		if (!existsSync(file)) return undefined;
		const parsed = JSON.parse(readFileSync(file, "utf8")) as {
			result: PdlResult | null;
		};
		return parsed.result;
	} catch {
		return undefined;
	}
}

function writePdlCache(input: EnrichInput, result: PdlResult | null): void {
	if (!pdlCacheEnabled()) return;
	try {
		mkdirSync(PDL_CACHE_DIR, { recursive: true });
		writeFileSync(
			pdlCacheFile(input),
			JSON.stringify({ result, cachedAt: new Date().toISOString() }),
		);
	} catch {
		// best-effort cache; ignore write failures
	}
}

export interface PdlExperience {
	company?: { name?: string | null } | null;
	title?: { name?: string | null } | null;
	start_date?: string | null;
	end_date?: string | null;
	is_primary?: boolean | null;
}
export interface PdlEducation {
	school?: { name?: string | null } | null;
	degrees?: string[] | null;
	majors?: string[] | null;
	start_date?: string | null;
	end_date?: string | null;
}
export interface PdlPerson {
	experience?: PdlExperience[] | null;
	education?: PdlEducation[] | null;
	skills?: string[] | null;
	job_title?: string | null;
}

export interface PdlResult {
	person: PdlPerson;
	// Whether we matched on a verified handle (LinkedIn) vs a fuzzy name lookup.
	identityConfirmed: boolean;
	// Base confidence derived from PDL's match likelihood (0..1).
	baseConfidence: number;
}

export function pdlConfigured(): boolean {
	return Boolean(process.env.PDL_API_KEY?.trim());
}

// PDL likelihood is 1..10; map to a base confidence.
function likelihoodToConfidence(likelihood: number | undefined): number {
	if (!likelihood || likelihood < 0) return 0.5;
	if (likelihood >= 8) return 0.92;
	if (likelihood >= 6) return 0.82;
	if (likelihood >= 4) return 0.66;
	return 0.5;
}

function yearOf(date: string | null | undefined): number | null {
	if (!date) return null;
	const m = /^(\d{4})/.exec(date.trim());
	return m ? normalizeYear(m[1]) : null;
}

export interface EnrichInput {
	linkedinUrl?: string | null;
	name?: string | null;
	company?: string | null;
	location?: string | null;
}

// Call PDL person/enrich. Anchors on LinkedIn when available (verified identity);
// otherwise a name lookup (identity NOT confirmed → claims will be pending).
export async function enrichPerson(
	input: EnrichInput,
	timeoutMs = 30_000,
): Promise<PdlResult | null> {
	const apiKey = process.env.PDL_API_KEY?.trim();
	if (!apiKey) return null;

	const cached = readPdlCache(input);
	if (cached !== undefined) return cached;

	const result = await fetchPdlPerson(input, apiKey, timeoutMs);
	writePdlCache(input, result);
	return result;
}

async function fetchPdlPerson(
	input: EnrichInput,
	apiKey: string,
	timeoutMs: number,
): Promise<PdlResult | null> {
	const hasLinkedin = Boolean(input.linkedinUrl);
	// PDL needs a strong identifier (a profile/LinkedIn URL) OR a name together
	// with at least one qualifier (company/location). Name alone is a 400, so
	// skip those instead of erroring out the whole member.
	const hasNameWithContext =
		Boolean(input.name) && Boolean(input.company || input.location);
	if (!hasLinkedin && !hasNameWithContext) return null;

	const params = new URLSearchParams();
	if (input.linkedinUrl) params.set("profile", input.linkedinUrl);
	if (input.name) params.set("name", input.name);
	if (input.company) params.set("company", input.company);
	if (input.location) params.set("location", input.location);
	// Don't return low-confidence guesses; require a minimum match.
	params.set("min_likelihood", "4");

	const res = await fetchWithTimeout(
		`${PDL_ENRICH_URL}?${params.toString()}`,
		{ headers: { "X-Api-Key": apiKey, Accept: "application/json" } },
		timeoutMs,
	);
	// 404 = no match; 400 = insufficient/invalid input for this person. Both mean
	// "nothing from PDL", not a systemic failure — skip so other tiers still run.
	if (res.status === 404 || res.status === 400) return null;
	if (!res.ok) {
		throw new Error(`PDL enrich failed: ${res.status} ${await res.text()}`);
	}
	const body = (await res.json()) as {
		status?: number;
		likelihood?: number;
		data?: PdlPerson;
	};
	if (!body.data) return null;

	return {
		person: body.data,
		identityConfirmed: hasLinkedin,
		baseConfidence: likelihoodToConfidence(body.likelihood),
	};
}

// Map a PDL person to proposed claims. Employment/education get the base
// confidence; skills are noisier so are discounted.
export function pdlToClaims(result: PdlResult): ProposedClaim[] {
	const { person, baseConfidence } = result;
	const claims: ProposedClaim[] = [];

	for (const exp of person.experience ?? []) {
		const org = exp.company?.name?.trim();
		const title = exp.title?.name?.trim();
		if (!org && !title) continue;
		claims.push({
			type: "employment",
			organizationName: org ?? null,
			title: title ?? null,
			startYear: yearOf(exp.start_date),
			endYear: yearOf(exp.end_date),
			isCurrent: exp.is_primary === true && !exp.end_date,
			confidence: baseConfidence,
			rawValue: [org, title].filter(Boolean).join(" — ") || "experience",
		});
	}

	for (const edu of person.education ?? []) {
		const school = edu.school?.name?.trim();
		if (!school) continue;
		claims.push({
			type: "education",
			schoolName: school,
			degree: edu.degrees?.[0]?.trim() ?? null,
			field: edu.majors?.[0]?.trim() ?? null,
			startYear: yearOf(edu.start_date),
			endYear: yearOf(edu.end_date),
			confidence: baseConfidence,
			rawValue: school,
		});
	}

	for (const skill of person.skills ?? []) {
		const name = skill?.trim();
		if (!name) continue;
		claims.push({
			type: "skill",
			skillName: name,
			confidence: Math.max(0.4, baseConfidence * 0.8),
			rawValue: name,
		});
	}

	return claims;
}
