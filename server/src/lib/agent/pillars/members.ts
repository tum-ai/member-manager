// The "members" pillar — the people directory. Tools:
//   search_members      ranked discovery ("find me people who…")
//   find_people_by      deterministic Q&A ("who built X / works at Y / knows Z")
//   get_member_profile  read one member's structured profile
//   resolve_person      name → beacon user id (grounds names + follow-ups)
// All people-producing tools harvest into ctx.collectedPeople so the final
// answer may cite them.

import { z } from "zod";
import { type ExpertiseProfile, getExpertiseProfile } from "../../beacon.js";
import {
	type PersonHit,
	peopleByOrganization,
	peopleByProject,
	peopleBySkill,
	peopleByTag,
	type StatusFilter,
} from "../../structuredLookup.js";
import { nameOf, runMemberSearch } from "../fallback.js";
import { type CollectedPerson, defineTool, type Pillar } from "../types.js";

const unverified = (status: string): string =>
	status === "pending" ? " (unverified)" : "";

function hitToPerson(h: PersonHit): CollectedPerson {
	return {
		user_id: h.user_id,
		name: h.name,
		avatar_url: null,
		best_chunk: h.detail,
		score: h.status === "confirmed" ? 1 : 0.6,
		match_reason: `${h.detail}${unverified(h.status)}`,
	};
}

function renderHits(title: string, hits: PersonHit[]): string {
	if (!hits.length) return `${title}: none found.`;
	const lines = hits.map(
		(h) =>
			`- @[${h.name}](beacon:${h.user_id}) — ${h.detail}${unverified(h.status)}`,
	);
	return `${title}:\n${lines.join("\n")}`;
}

const yrs = (a: number | null, b: number | null, cur?: boolean): string => {
	if (!a && !b) return "";
	const right = cur ? "present" : b ? String(b) : "";
	return a && right ? `${a}–${right}` : String(a ?? right);
};

// Render a profile as compact text for the model. Pending facts are flagged
// "(unverified)". Experience is sorted earliest-first so "first job"-style
// questions are easy to answer. Exported for testing.
export function compactProfileText(profile: ExpertiseProfile): string {
	const m = (profile.member ?? {}) as {
		given_name?: string | null;
		surname?: string | null;
		department?: string | null;
		member_role?: string | null;
		public_location?: string | null;
	};
	const person = (profile.person ?? {}) as {
		headline?: string | null;
		summary?: string | null;
	};
	const name = nameOf({
		user_id: profile.user_id,
		given_name: m.given_name ?? null,
		surname: m.surname ?? null,
	});

	// Present the name as the citation token so the model reproduces it verbatim.
	const lines: string[] = [`Name: @[${name}](beacon:${profile.user_id})`];
	if (m.member_role) lines.push(`TUM.ai role: ${m.member_role}`);
	if (m.department) lines.push(`Department: ${m.department}`);
	if (m.public_location) lines.push(`Location: ${m.public_location}`);
	if (person.headline) lines.push(`Headline: ${person.headline}`);
	if (person.summary) lines.push(`Summary: ${person.summary}`);

	const employment = [
		...(profile.employment as Array<{
			title: string | null;
			is_current: boolean;
			start_year: number | null;
			end_year: number | null;
			raw_value: string | null;
			status: string;
			organization: { name: string } | null;
		}>),
	].sort((a, b) => (a.start_year ?? 9999) - (b.start_year ?? 9999));
	const emp = employment.map((e) => {
		const org = e.organization?.name ?? e.raw_value ?? "";
		const span = yrs(e.start_year, e.end_year, e.is_current);
		return `${e.title ?? "Role"} at ${org}${span ? `, ${span}` : ""}${unverified(e.status)}`;
	});
	if (emp.length)
		lines.push(
			`Experience (earliest first):\n${emp.map((s) => `- ${s}`).join("\n")}`,
		);

	const edu = (
		profile.education as Array<{
			degree: string | null;
			field: string | null;
			raw_value: string | null;
			status: string;
			school: { name: string } | null;
		}>
	).map((e) => {
		const school = e.school?.name ?? e.raw_value ?? "";
		const what = [e.degree, e.field].filter(Boolean).join(" in ") || "Studied";
		return `${what} at ${school}${unverified(e.status)}`;
	});
	if (edu.length)
		lines.push(`Education:\n${edu.map((s) => `- ${s}`).join("\n")}`);

	const skills = (
		profile.skills as Array<{
			raw_value: string | null;
			status: string;
			skill: { name: string } | null;
		}>
	).map((s) => `${s.skill?.name ?? s.raw_value ?? ""}${unverified(s.status)}`);
	if (skills.length) lines.push(`Skills: ${skills.join(", ")}`);

	const projects = (
		profile.projects as Array<{
			role: string | null;
			raw_value: string | null;
			status: string;
			project: { name: string; description: string | null } | null;
		}>
	).map((p) => {
		const n = p.project?.name ?? p.raw_value ?? "";
		const desc = p.project?.description ? ` — ${p.project.description}` : "";
		return `${n}${p.role ? ` (${p.role})` : ""}${desc}${unverified(p.status)}`;
	});
	if (projects.length)
		lines.push(`Projects:\n${projects.map((s) => `- ${s}`).join("\n")}`);

	const tags = (
		profile.tags as Array<{
			tag: string;
			status: string;
			vocabulary: { label: string } | null;
		}>
	).map((t) => `${t.vocabulary?.label ?? t.tag}${unverified(t.status)}`);
	if (tags.length) lines.push(`Capabilities: ${tags.join(", ")}`);

	return lines.join("\n").slice(0, 1800);
}

const SHORT =
	"People directory of TUM.ai members — their jobs, education, skills, projects and capabilities. Find people, or answer who-did / who-knows / what-does-X-work-on questions.";

export const membersPillar: Pillar = {
	id: "members",
	title: "Members & Expertise",
	shortDescription: SHORT,
	longDescription:
		"The TUM.ai people directory. Use search_members to rank people for an open-ended need, find_people_by to list the members tied to a specific project / company / skill / capability, get_member_profile to read one person's details, and resolve_person to turn a name into an id. Some facts are unverified (enriched but not yet confirmed by the member).",
	tools: [
		defineTool({
			name: "search_members",
			description:
				"Rank members for an open-ended need (e.g. 'senior iOS dev who shipped an App Store app'). Returns a ranked list with reasons.",
			params: z.object({
				query: z.string().describe("The natural-language search need."),
				top_k: z.number().int().min(1).max(20).optional(),
			}),
			handler: async ({ query, top_k }) => {
				const { people } = await runMemberSearch({
					text: query,
					topK: top_k ?? 12,
				});
				if (!people.length)
					return { content: "No members matched that search." };
				const lines = people.map(
					(p) =>
						`- @[${p.name}](beacon:${p.user_id})${p.match_reason ? ` — ${p.match_reason}` : ""}`,
				);
				return {
					content: `Ranked matches:\n${lines.join("\n")}`,
					people: people.map((p) => ({ ...p })),
				};
			},
		}),
		defineTool({
			name: "find_people_by",
			description:
				"List members tied to a specific project, organization (company name), skill, or capability tag. Use this for factual 'who built X / who worked at Y / who knows Z' questions.",
			params: z.object({
				project: z.string().optional(),
				organization: z.string().optional(),
				skill: z.string().optional(),
				tag: z.string().optional(),
				include_pending: z
					.boolean()
					.optional()
					.describe("Include unverified claims (default true)."),
			}),
			handler: async ({
				project,
				organization,
				skill,
				tag,
				include_pending,
			}) => {
				const status: StatusFilter =
					include_pending === false ? ["confirmed"] : ["confirmed", "pending"];
				const sections: string[] = [];
				const collected: CollectedPerson[] = [];
				const add = (title: string, hits: PersonHit[]) => {
					sections.push(renderHits(title, hits));
					for (const h of hits) collected.push(hitToPerson(h));
				};
				if (project)
					add(
						`People on project '${project}'`,
						await peopleByProject(project, status),
					);
				if (organization)
					add(
						`People who worked at '${organization}'`,
						await peopleByOrganization(organization, status),
					);
				if (skill)
					add(
						`People with the skill '${skill}'`,
						await peopleBySkill(skill, status),
					);
				if (tag)
					add(
						`People with the capability '${tag}'`,
						await peopleByTag(tag, status),
					);
				if (!sections.length)
					return {
						content:
							"Give me a project, organization, skill, or capability to look up.",
					};
				return { content: sections.join("\n\n"), people: collected };
			},
		}),
		defineTool({
			name: "get_member_profile",
			description:
				"Read one member's structured profile (experience, education, skills, projects, capabilities) by their beacon user id.",
			params: z.object({
				user_id: z.string().describe("The beacon user id (uuid)."),
			}),
			handler: async ({ user_id }) => {
				const profile = await getExpertiseProfile(user_id, {
					statuses: ["confirmed", "pending"],
				});
				const optedOut = (profile?.person as { opted_out?: boolean } | null)
					?.opted_out;
				if (!profile || optedOut === true)
					return { content: "That member's profile isn't available." };
				const m = (profile.member ?? {}) as {
					given_name?: string | null;
					surname?: string | null;
				};
				const headline = (profile.person as { headline?: string | null } | null)
					?.headline;
				return {
					content: compactProfileText(profile),
					people: [
						{
							user_id,
							name: nameOf({
								user_id,
								given_name: m.given_name ?? null,
								surname: m.surname ?? null,
							}),
							avatar_url: null,
							best_chunk: headline ?? null,
							score: 1,
						},
					],
				};
			},
		}),
		defineTool({
			name: "resolve_person",
			description:
				"Look up members by (partial) name and return their beacon ids. Use this to ground a name before reading a profile, or to resolve who 'he/she/that person' refers to.",
			params: z.object({
				name: z.string().describe("A full or partial member name."),
			}),
			handler: async ({ name }, ctx) => {
				const q = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
				if (q.length < 2)
					return { content: "Give me at least two letters of a name." };
				const { data } = await ctx.supabase
					.from("members")
					.select("user_id, given_name, surname")
					.or(`given_name.ilike.%${q}%,surname.ilike.%${q}%`)
					.limit(5);
				const rows = (data ?? []) as {
					user_id: string;
					given_name: string | null;
					surname: string | null;
				}[];
				if (!rows.length)
					return { content: `I couldn't find anyone named "${name}".` };
				const people: CollectedPerson[] = rows.map((r) => ({
					user_id: r.user_id,
					name: nameOf(r),
					avatar_url: null,
					best_chunk: null,
					score: 0.5,
				}));
				const lines = people.map((p) => `- @[${p.name}](beacon:${p.user_id})`);
				return { content: `Possible matches:\n${lines.join("\n")}`, people };
			},
		}),
	],
};
