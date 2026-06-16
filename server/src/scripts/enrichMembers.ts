// Beacon enrichment job. Builds expertise claims for members from three tiers,
// each optional:
//   1. self-data  — education from the member's own school/degree (confirmed).
//   2. PDL        — employment/education/skills from People Data Labs, anchored
//                   on a verified LinkedIn URL when present (PDL_API_KEY).
//   3. LLM tags   — controlled capability tags inferred by OpenAI from the
//                   combined signals (OPENAI_API_KEY); always pending.
//
// Every output is a claim with source + confidence + status. The confidence
// gate auto-confirms only high-confidence, identity-verified facts; everything
// else is pending for member review. Idempotent and member-decision-respecting
// (see lib/claims.ts). Dry-run by default; pass --apply to write.
//
// Usage:
//   tsx src/scripts/enrichMembers.ts [--apply] [--limit N] [--user <uuid>]
//                                    [--require-linkedin] [--no-pdl] [--no-llm]

import { createSource } from "../lib/beacon.js";
import { consolidateMemberClaims } from "../lib/claimConsolidation.js";
import {
	type ApplyResult,
	applyClaims,
	type ProposedClaim,
} from "../lib/claims.js";
import { enrichPerson, pdlConfigured, pdlToClaims } from "../lib/pdl.js";
import {
	extractCapabilityTags,
	llmConfigured,
	normalizeClaimSkills,
	type VocabTag,
} from "../lib/researchAgent.js";
import { getSupabase } from "../lib/supabase.js";
import {
	kindFromUrl,
	researchPerson,
	titleFromUrl,
	webResearchConfigured,
} from "../lib/webResearch.js";

interface MemberRow {
	user_id: string;
	given_name: string | null;
	surname: string | null;
	linkedin_url: string | null;
	linkedin_profile_url: string | null;
	public_location: string | null;
	school: string | null;
	degree: string | null;
	department: string | null;
}

interface Flags {
	apply: boolean;
	limit: number | null;
	user: string | null;
	requireLinkedin: boolean;
	noPdl: boolean;
	noLlm: boolean;
	noWeb: boolean;
}

function parseFlags(argv: string[]): Flags {
	const has = (f: string) => argv.includes(f);
	const val = (f: string) => {
		const i = argv.indexOf(f);
		return i >= 0 ? argv[i + 1] : null;
	};
	const limitRaw = val("--limit");
	return {
		apply: has("--apply"),
		limit: limitRaw ? Number(limitRaw) : null,
		user: val("--user"),
		requireLinkedin: has("--require-linkedin"),
		noPdl: has("--no-pdl"),
		noLlm: has("--no-llm"),
		noWeb: has("--no-web"),
	};
}

function linkedinOf(m: MemberRow): string | null {
	return m.linkedin_url?.trim() || m.linkedin_profile_url?.trim() || null;
}

// Education from the member's own profile (newline-serialized degree/school
// pairs as the profile form stores them). Self-reported → confirmed.
function selfClaims(m: MemberRow): ProposedClaim[] {
	const schools = (m.school ?? "").split(/\r?\n/).map((s) => s.trim());
	const degrees = (m.degree ?? "").split(/\r?\n/).map((s) => s.trim());
	const claims: ProposedClaim[] = [];
	const n = Math.max(schools.length, degrees.length);
	for (let i = 0; i < n; i++) {
		const school = schools[i];
		if (!school) continue;
		claims.push({
			type: "education",
			schoolName: school,
			degree: degrees[i] || null,
			confidence: 1,
			rawValue: school,
		});
	}
	return claims;
}

function buildSignals(m: MemberRow, pdlJobTitle?: string | null): string {
	return [
		`Name: ${[m.given_name, m.surname].filter(Boolean).join(" ")}`,
		m.department && `Department: ${m.department}`,
		m.degree && `Studies: ${m.degree}`,
		m.school && `School: ${m.school}`,
		m.public_location && `Location: ${m.public_location}`,
		pdlJobTitle && `Current role: ${pdlJobTitle}`,
	]
		.filter(Boolean)
		.join("\n");
}

function mergeResult(into: ApplyResult, from: ApplyResult): void {
	into.items.push(...from.items);
	into.added += from.added;
	into.updated += from.updated;
	into.skipped += from.skipped;
}

async function main(): Promise<void> {
	const flags = parseFlags(process.argv.slice(2));
	const supabase = getSupabase();

	console.log(
		`Beacon enrichment — ${flags.apply ? "APPLY (writing)" : "DRY RUN"}` +
			` | PDL: ${pdlConfigured() && !flags.noPdl ? "on" : "off"}` +
			` | LLM tags: ${llmConfigured() && !flags.noLlm ? "on" : "off"}` +
			` | Web research: ${webResearchConfigured() && !flags.noWeb ? "on" : "off"}`,
	);

	// Vocabulary for LLM tag extraction.
	let vocab: VocabTag[] = [];
	if (llmConfigured() && !flags.noLlm) {
		const { data } = await supabase
			.from("beacon_tag_vocabulary")
			.select("tag,label,category");
		vocab = (data ?? []) as VocabTag[];
	}

	// Opted-out members are excluded entirely.
	const { data: optedRows } = await supabase
		.from("beacon_person")
		.select("user_id")
		.eq("opted_out", true);
	const optedOut = new Set(
		(optedRows ?? []).map((r) => (r as { user_id: string }).user_id),
	);

	let query = supabase
		.from("members")
		.select(
			"user_id, given_name, surname, linkedin_url, linkedin_profile_url, public_location, school, degree, department",
		);
	if (flags.user) query = query.eq("user_id", flags.user);
	const { data, error } = await query;
	if (error) throw new Error(`Failed to load members: ${error.message}`);

	let members = (data ?? []) as MemberRow[];
	members = members.filter((m) => !optedOut.has(m.user_id));
	if (flags.requireLinkedin) members = members.filter((m) => linkedinOf(m));
	if (flags.limit) members = members.slice(0, flags.limit);

	console.log(`Processing ${members.length} member(s)…\n`);

	const totals = {
		added: 0,
		updated: 0,
		skipped: 0,
		deduped: 0,
		members: 0,
		errors: 0,
	};

	for (const m of members) {
		const name =
			[m.given_name, m.surname].filter(Boolean).join(" ") || m.user_id;
		const result: ApplyResult = { items: [], added: 0, updated: 0, skipped: 0 };

		try {
			// Tier 1 — self education (source-less, confirmed).
			mergeResult(
				result,
				await applyClaims(selfClaims(m), {
					userId: m.user_id,
					sourceId: null,
					kind: "self",
					identityConfirmed: true,
					apply: flags.apply,
				}),
			);

			// Tier 2 — PDL.
			let pdlJobTitle: string | null = null;
			if (pdlConfigured() && !flags.noPdl) {
				const li = linkedinOf(m);
				if (li || name) {
					const pdl = await enrichPerson({
						linkedinUrl: li,
						name: li ? null : name,
						location: m.public_location,
					});
					if (pdl) {
						pdlJobTitle = pdl.person.job_title ?? null;
						const sourceId = flags.apply
							? await createSource({
									kind: "pdl",
									url: li,
									title: "People Data Labs",
									identityConfirmed: pdl.identityConfirmed,
								})
							: null;
						mergeResult(
							result,
							await applyClaims(await normalizeClaimSkills(pdlToClaims(pdl)), {
								userId: m.user_id,
								sourceId,
								kind: "pdl",
								identityConfirmed: pdl.identityConfirmed,
								apply: flags.apply,
							}),
						);
					}
				}
			}

			// Tier 3 — LLM capability tags (always pending).
			if (llmConfigured() && !flags.noLlm && vocab.length) {
				const tags = await extractCapabilityTags(
					buildSignals(m, pdlJobTitle),
					vocab,
				);
				if (tags.length) {
					const sourceId = flags.apply
						? await createSource({
								kind: "web_search",
								title: "Inferred (LLM)",
								identityConfirmed: false,
							})
						: null;
					mergeResult(
						result,
						await applyClaims(tags, {
							userId: m.user_id,
							sourceId,
							kind: "web_search",
							identityConfirmed: false,
							apply: flags.apply,
						}),
					);
				}
			}

			// Tier 4 — open-web research via OpenAI native web search. Identity
			// unverified → everything lands pending. Each fact keeps its own
			// source URL, so claims are grouped per source.
			if (webResearchConfigured() && !flags.noWeb) {
				const research = await researchPerson({
					name,
					linkedinUrl: linkedinOf(m),
					department: m.department,
					currentRole: pdlJobTitle,
					location: m.public_location,
				});
				// Normalize skill names to canonical English once for the whole set,
				// then re-group by source URL (order preserved).
				const normalizedClaims = await normalizeClaimSkills(
					research.items.map((it) => it.claim),
				);
				const byUrl = new Map<string, ProposedClaim[]>();
				research.items.forEach((it, i) => {
					const url = it.sourceUrl ?? "";
					const list = byUrl.get(url) ?? [];
					list.push(normalizedClaims[i]);
					byUrl.set(url, list);
				});
				for (const [url, group] of byUrl) {
					const sourceId = flags.apply
						? await createSource({
								kind: kindFromUrl(url),
								url: url || null,
								title: titleFromUrl(url) ?? "Web research",
								identityConfirmed: false,
							})
						: null;
					mergeResult(
						result,
						await applyClaims(group, {
							userId: m.user_id,
							sourceId,
							kind: kindFromUrl(url),
							identityConfirmed: false,
							apply: flags.apply,
						}),
					);
				}
			}
			// Post-pass: merge near-duplicate roles + title-case (deterministic).
			const merged = await consolidateMemberClaims(m.user_id, {
				apply: flags.apply,
			});
			totals.deduped += merged.employment + merged.education;
		} catch (e) {
			totals.errors++;
			console.log(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`);
			continue;
		}

		totals.members++;
		totals.added += result.added;
		totals.updated += result.updated;
		totals.skipped += result.skipped;

		if (result.items.length) {
			console.log(
				`  ${name}: +${result.added} ~${result.updated} ·${result.skipped}`,
			);
			for (const it of result.items) {
				const mark =
					it.action === "add" ? "+" : it.action === "update" ? "~" : "·";
				console.log(
					`     ${mark} [${it.type}] ${it.label}` +
						`${it.status ? ` → ${it.status}` : ""}` +
						`${it.reason ? ` (${it.reason})` : ""}`,
				);
			}
		}
	}

	console.log(
		`\n${flags.apply ? "Applied" : "Dry run"} — members=${totals.members} ` +
			`added=${totals.added} updated=${totals.updated} skipped=${totals.skipped} ` +
			`deduped=${totals.deduped} errors=${totals.errors}`,
	);
	if (!flags.apply) console.log("Re-run with --apply to write.");
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
