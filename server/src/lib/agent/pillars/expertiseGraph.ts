// The "expertise-graph" pillar — org-wide aggregate analytics the per-person
// tools can't produce. Tools:
//   expertise_landscape  collective skill/capability/company/school distribution
//   find_collaborators   members sharing a project or employer with someone
//   compare_members      side-by-side profiles of 2–5 members
// find_collaborators / compare_members harvest into ctx.collectedPeople so the
// final answer may cite them, and exclude members opted out of the directory.

import { z } from "zod";
import { getExpertiseProfile } from "../../beacon.js";
import {
	type CollaboratorHit,
	expertiseLandscape,
	findCollaborators,
	type LandscapeDimension,
	type LandscapeEntry,
} from "../../expertiseGraphLookup.js";
import { nameOf } from "../fallback.js";
import { type CollectedPerson, defineTool, type Pillar } from "../types.js";
import { compactProfileText } from "./members.js";

const DIMENSIONS: LandscapeDimension[] = [
	"skills",
	"capabilities",
	"companies",
	"schools",
];

const DIMENSION_TITLE: Record<LandscapeDimension, string> = {
	skills: "Top skills",
	capabilities: "Top capabilities",
	companies: "Companies worked at (by category)",
	schools: "School groups",
};

function renderEntries(title: string, entries: LandscapeEntry[]): string {
	if (!entries.length) return `${title}: nothing recorded yet.`;
	const lines = entries.map(
		(e) => `- ${e.label}: ${e.count} member${e.count === 1 ? "" : "s"}`,
	);
	return `${title}:\n${lines.join("\n")}`;
}

function collaboratorToPerson(h: CollaboratorHit): CollectedPerson {
	return {
		user_id: h.user_id,
		name: h.name,
		avatar_url: null,
		best_chunk: h.detail,
		score: 1,
		match_reason: h.detail,
	};
}

export const expertiseGraphPillar: Pillar = {
	id: "expertise-graph",
	title: "Expertise Graph",
	shortDescription:
		"Org-wide expertise analytics across all members — the collective skill / capability / company / school landscape, who collaborates with whom (shared projects or employers), and side-by-side member comparisons. For aggregate 'what are we collectively good at' questions, not for finding one specific person.",
	longDescription:
		"Aggregate analytics over the whole membership. Use expertise_landscape for distribution questions (top skills/capabilities, which companies people came from, which school groups) — omit `dimension` for a quick overview across all four, or set it for a deeper ranked list. Use find_collaborators to see who shares a project or employer with a given member, and compare_members to lay 2–5 members' profiles side by side. Counts include unverified (pending) claims. find_collaborators and compare_members need beacon user ids.",
	promptGuidance:
		"Use expertise_landscape for aggregate / distribution questions — 'what are we collectively good at', 'our ML strength', 'top skills', 'which companies have people worked at' — NOT to find specific people (use the members area's find_people_by for that). find_collaborators and compare_members take beacon user ids, so resolve a name to an id first (members area's resolve_person) if you only have a name.",
	tools: [
		defineTool({
			name: "expertise_landscape",
			description:
				"Ranked distribution of the membership's collective expertise: top skills, capabilities, companies people have worked at (by category like bigtech/faang), or school groups (e.g. tu9, ivy_league). Returns counts of members, not a list of individuals. Omit `dimension` for a top-5 overview across all four.",
			params: z.object({
				dimension: z
					.enum(["skills", "capabilities", "companies", "schools"])
					.optional()
					.describe(
						"Which landscape to rank. Omit for a short overview across all four.",
					),
				category: z
					.string()
					.optional()
					.describe(
						"Narrow skills or capabilities to one category (e.g. 'domain'). Ignored for companies/schools.",
					),
				top_k: z
					.number()
					.int()
					.min(1)
					.max(50)
					.optional()
					.describe("How many entries to return for a single dimension."),
			}),
			handler: async ({ dimension, category, top_k }) => {
				if (!dimension) {
					const sections = await Promise.all(
						DIMENSIONS.map(async (d) =>
							renderEntries(
								DIMENSION_TITLE[d],
								await expertiseLandscape({ dimension: d, category, limit: 5 }),
							),
						),
					);
					return { content: sections.join("\n\n") };
				}
				const entries = await expertiseLandscape({
					dimension,
					category,
					limit: top_k ?? 15,
				});
				return { content: renderEntries(DIMENSION_TITLE[dimension], entries) };
			},
		}),
		defineTool({
			name: "find_collaborators",
			description:
				"List members who share a project or a past employer with a given member (by beacon user id), ranked by how much they share. Use for 'who has worked with X' / 'who overlaps with X'.",
			params: z.object({
				user_id: z.string().describe("The beacon user id (uuid)."),
				top_k: z.number().int().min(1).max(20).optional(),
			}),
			handler: async ({ user_id, top_k }) => {
				const hits = await findCollaborators(user_id, { limit: top_k ?? 12 });
				if (!hits.length)
					return {
						content:
							"No one shares a recorded project or employer with that member.",
					};
				const lines = hits.map(
					(h) => `- @[${h.name}](beacon:${h.user_id}) — ${h.detail}`,
				);
				return {
					content: `Shared projects / employers:\n${lines.join("\n")}`,
					people: hits.map(collaboratorToPerson),
				};
			},
		}),
		defineTool({
			name: "compare_members",
			description:
				"Lay 2–5 members' profiles (experience, education, skills, projects, capabilities) side by side by their beacon user ids. Use for 'compare X and Y' questions.",
			params: z.object({
				user_ids: z
					.array(z.string())
					.min(2)
					.max(5)
					.describe("Beacon user ids (uuids) of the members to compare."),
			}),
			handler: async ({ user_ids }) => {
				const sections: string[] = [];
				const people: CollectedPerson[] = [];
				for (const id of [...new Set(user_ids)]) {
					const profile = await getExpertiseProfile(id, {
						statuses: ["confirmed", "pending"],
					});
					const optedOut = (profile?.person as { opted_out?: boolean } | null)
						?.opted_out;
					if (!profile || optedOut === true) continue;
					const m = (profile.member ?? {}) as {
						given_name?: string | null;
						surname?: string | null;
					};
					const headline = (
						profile.person as { headline?: string | null } | null
					)?.headline;
					sections.push(compactProfileText(profile));
					people.push({
						user_id: id,
						name: nameOf({
							user_id: id,
							given_name: m.given_name ?? null,
							surname: m.surname ?? null,
						}),
						avatar_url: null,
						best_chunk: headline ?? null,
						score: 1,
					});
				}
				if (sections.length < 2)
					return {
						content:
							"I need at least two available member profiles to compare.",
					};
				return { content: sections.join("\n\n---\n\n"), people };
			},
		}),
	],
};
