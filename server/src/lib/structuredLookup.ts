// Beacon structured people-lookup: deterministic Layer-A joins from an entity
// (project / organization / skill / tag) to the members linked to it. No LLM —
// this powers the assistant's factual "who built X / who works at Y / who knows
// Z" answers. Confirmed + pending are included by default (pending is labeled
// "unverified" when surfaced); pass ["confirmed"] for confirmed-only.

import { type ClaimStatus, canonicalKey, tagSlug } from "./beacon.js";
import { getSupabase } from "./supabase.js";

export type StatusFilter = ClaimStatus[];
export const DEFAULT_STATUS: StatusFilter = ["confirmed", "pending"];

export interface PersonHit {
	user_id: string;
	name: string;
	detail: string; // e.g. "Software Engineer at Google, 2020–present"
	status: ClaimStatus; // confirmed | pending
}

interface MemberRow {
	user_id: string;
	given_name: string | null;
	surname: string | null;
}
const nameOf = (m: MemberRow): string =>
	[m.given_name, m.surname].filter(Boolean).join(" ") || "Member";

// Strip characters that would break a `%…%` ILIKE value or look like wildcards.
const likeTerm = (s: string): string => s.replace(/[%_]/g, " ").trim();

const yrs = (a: number | null, b: number | null, cur?: boolean): string => {
	if (!a && !b) return "";
	const right = cur ? "present" : b ? String(b) : "";
	return a && right ? `${a}–${right}` : String(a ?? right);
};

// One query to resolve member display names for a set of ids.
async function membersByIds(ids: string[]): Promise<Map<string, MemberRow>> {
	const unique = [...new Set(ids)];
	if (!unique.length) return new Map();
	const { data } = await getSupabase()
		.from("members")
		.select("user_id, given_name, surname")
		.in("user_id", unique);
	return new Map(
		(data ?? []).map((m) => [(m as MemberRow).user_id, m as MemberRow]),
	);
}

// Resolve canonical-entity ids by exact canonical_key first, then a fuzzy name
// match (so "Study Set" finds "Study Set Creator").
async function resolveEntityIds(
	table: "beacon_project" | "beacon_organization" | "beacon_skill",
	name: string,
): Promise<{ id: string; name: string }[]> {
	const supabase = getSupabase();
	const exact = await supabase
		.from(table)
		.select("id, name")
		.eq("canonical_key", canonicalKey(name));
	if (exact.data?.length) return exact.data as { id: string; name: string }[];
	const term = likeTerm(name);
	if (!term) return [];
	const fuzzy = await supabase
		.from(table)
		.select("id, name")
		.ilike("name", `%${term}%`)
		.limit(10);
	return (fuzzy.data ?? []) as { id: string; name: string }[];
}

export async function peopleByProject(
	name: string,
	status: StatusFilter = DEFAULT_STATUS,
): Promise<PersonHit[]> {
	const projects = await resolveEntityIds("beacon_project", name);
	if (!projects.length) return [];
	const byId = new Map(projects.map((p) => [p.id, p.name]));
	const { data } = await getSupabase()
		.from("beacon_person_project")
		.select("user_id, role, status, project_id")
		.in(
			"project_id",
			projects.map((p) => p.id),
		)
		.in("status", status);
	const rows = (data ?? []) as {
		user_id: string;
		role: string | null;
		status: ClaimStatus;
		project_id: string;
	}[];
	const members = await membersByIds(rows.map((r) => r.user_id));
	return rows
		.filter((r) => members.has(r.user_id))
		.map((r) => {
			const proj = byId.get(r.project_id) ?? name;
			return {
				user_id: r.user_id,
				name: nameOf(members.get(r.user_id) as MemberRow),
				detail: r.role ? `${proj} — ${r.role}` : proj,
				status: r.status,
			};
		});
}

export async function peopleByOrganization(
	name: string,
	status: StatusFilter = DEFAULT_STATUS,
): Promise<PersonHit[]> {
	const orgs = await resolveEntityIds("beacon_organization", name);
	if (!orgs.length) return [];
	const byId = new Map(orgs.map((o) => [o.id, o.name]));
	const { data } = await getSupabase()
		.from("beacon_employment")
		.select(
			"user_id, title, start_year, end_year, is_current, status, organization_id",
		)
		.in(
			"organization_id",
			orgs.map((o) => o.id),
		)
		.in("status", status);
	const rows = (data ?? []) as {
		user_id: string;
		title: string | null;
		start_year: number | null;
		end_year: number | null;
		is_current: boolean;
		status: ClaimStatus;
		organization_id: string;
	}[];
	const members = await membersByIds(rows.map((r) => r.user_id));
	return rows
		.filter((r) => members.has(r.user_id))
		.map((r) => {
			const org = byId.get(r.organization_id) ?? name;
			const span = yrs(r.start_year, r.end_year, r.is_current);
			const role = r.title ? `${r.title} at ${org}` : `Worked at ${org}`;
			return {
				user_id: r.user_id,
				name: nameOf(members.get(r.user_id) as MemberRow),
				detail: span ? `${role}, ${span}` : role,
				status: r.status,
			};
		});
}

export async function peopleBySkill(
	name: string,
	status: StatusFilter = DEFAULT_STATUS,
): Promise<PersonHit[]> {
	const skills = await resolveEntityIds("beacon_skill", name);
	if (!skills.length) return [];
	const byId = new Map(skills.map((s) => [s.id, s.name]));
	const { data } = await getSupabase()
		.from("beacon_person_skill")
		.select("user_id, proficiency, status, skill_id")
		.in(
			"skill_id",
			skills.map((s) => s.id),
		)
		.in("status", status);
	const rows = (data ?? []) as {
		user_id: string;
		proficiency: string | null;
		status: ClaimStatus;
		skill_id: string;
	}[];
	const members = await membersByIds(rows.map((r) => r.user_id));
	return rows
		.filter((r) => members.has(r.user_id))
		.map((r) => {
			const skill = byId.get(r.skill_id) ?? name;
			return {
				user_id: r.user_id,
				name: nameOf(members.get(r.user_id) as MemberRow),
				detail: r.proficiency ? `${skill} (${r.proficiency})` : skill,
				status: r.status,
			};
		});
}

export async function peopleByTag(
	tag: string,
	status: StatusFilter = DEFAULT_STATUS,
): Promise<PersonHit[]> {
	const supabase = getSupabase();
	const slug = tagSlug(tag);
	// Resolve the vocabulary tag: exact slug, else fuzzy by slug or label.
	const exact = await supabase
		.from("beacon_tag_vocabulary")
		.select("tag, label")
		.eq("tag", slug);
	let vocab = (exact.data ?? []) as { tag: string; label: string }[];
	if (!vocab.length) {
		const term = likeTerm(tag);
		const [bySlug, byLabel] = await Promise.all([
			supabase
				.from("beacon_tag_vocabulary")
				.select("tag, label")
				.ilike("tag", `%${slug}%`)
				.limit(10),
			term
				? supabase
						.from("beacon_tag_vocabulary")
						.select("tag, label")
						.ilike("label", `%${term}%`)
						.limit(10)
				: Promise.resolve({ data: [] as { tag: string; label: string }[] }),
		]);
		const merged = new Map<string, string>();
		for (const v of [...(bySlug.data ?? []), ...(byLabel.data ?? [])] as {
			tag: string;
			label: string;
		}[])
			merged.set(v.tag, v.label);
		vocab = [...merged].map(([t, label]) => ({ tag: t, label }));
	}
	if (!vocab.length) return [];
	const labelByTag = new Map(vocab.map((v) => [v.tag, v.label]));
	const { data } = await supabase
		.from("beacon_person_tag")
		.select("user_id, tag, status")
		.in(
			"tag",
			vocab.map((v) => v.tag),
		)
		.in("status", status);
	const rows = (data ?? []) as {
		user_id: string;
		tag: string;
		status: ClaimStatus;
	}[];
	const members = await membersByIds(rows.map((r) => r.user_id));
	return rows
		.filter((r) => members.has(r.user_id))
		.map((r) => ({
			user_id: r.user_id,
			name: nameOf(members.get(r.user_id) as MemberRow),
			detail: labelByTag.get(r.tag) ?? r.tag,
			status: r.status,
		}));
}
