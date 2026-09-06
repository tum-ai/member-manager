// Beacon expertise-graph analytics: org-wide aggregate reads the per-person
// tools can't produce — the collective skill/capability/company/school
// landscape, and who collaborates with whom (shared projects or employers).
// Deterministic (no LLM); pulls rows via getSupabase() and aggregates in JS,
// mirroring orgLookup.ts / structuredLookup.ts. Confirmed + pending are counted
// by default (pending = "unverified"); pass ["confirmed"] for confirmed-only.

import { nameOf } from "./agent/fallback.js";
import { type ClaimStatus, visibleBeaconMemberIds } from "./beacon.js";
import { DatabaseError } from "./errors.js";
import { getSupabase } from "./supabase.js";

export type StatusFilter = ClaimStatus[];
export const DEFAULT_STATUS: StatusFilter = ["confirmed", "pending"];

export type LandscapeDimension =
	| "skills"
	| "capabilities"
	| "companies"
	| "schools";

export interface LandscapeEntry {
	key: string;
	label: string;
	category: string | null;
	count: number; // distinct members
	unverified_count: number; // members represented only by pending claims
}

export interface CollaboratorHit {
	user_id: string;
	name: string;
	shared: string[]; // names of the shared projects / employers
	unverified_shared: string[];
	detail: string; // e.g. "Shares: Study Set Creator, Google"
}

interface MemberRow {
	user_id: string;
	given_name: string | null;
	surname: string | null;
}

const truthy = <T>(x: T | null | undefined): x is T => Boolean(x);

// One query to resolve member display names for a set of ids.
async function membersByIds(ids: string[]): Promise<Map<string, MemberRow>> {
	const unique = [...new Set(ids)];
	if (!unique.length) return new Map();
	const visible = await visibleBeaconMemberIds(unique);
	if (visible.size === 0) return new Map();
	const { data, error } = await getSupabase()
		.from("members")
		.select("user_id, given_name, surname")
		.in("user_id", [...visible]);
	if (error) throw new DatabaseError("Failed to load Beacon collaborators");
	return new Map(
		(data ?? []).map((m) => [(m as MemberRow).user_id, m as MemberRow]),
	);
}

interface Bucket {
	label: string;
	category: string | null;
	users: Map<string, ClaimStatus>;
}

function toEntries(
	buckets: Map<string, Bucket>,
	limit: number,
): LandscapeEntry[] {
	return [...buckets]
		.map(([key, b]) => ({
			key,
			label: b.label,
			category: b.category,
			count: b.users.size,
			unverified_count: [...b.users.values()].filter(
				(status) => status === "pending",
			).length,
		}))
		.filter((e) => e.count > 0)
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
		.slice(0, limit);
}

// Aggregate one dimension of the expertise landscape into ranked entries
// (distinct member counts). `category` narrows skills/capabilities only.
export async function expertiseLandscape(opts: {
	dimension: LandscapeDimension;
	category?: string;
	limit?: number;
	statuses?: StatusFilter;
}): Promise<LandscapeEntry[]> {
	const statuses = opts.statuses ?? DEFAULT_STATUS;
	const limit = opts.limit ?? 15;
	const sb = getSupabase();
	const buckets = new Map<string, Bucket>();
	const bump = (
		key: string,
		label: string,
		category: string | null,
		user: string,
		status: ClaimStatus,
	) => {
		const b = buckets.get(key) ?? {
			label,
			category,
			users: new Map<string, ClaimStatus>(),
		};
		const current = b.users.get(user);
		if (!current || status === "confirmed") b.users.set(user, status);
		buckets.set(key, b);
	};

	if (opts.dimension === "skills") {
		let q = sb.from("beacon_skill").select("id, name, category");
		if (opts.category) q = q.eq("category", opts.category);
		const { data: skills, error: skillError } = await q;
		if (skillError) throw new DatabaseError("Failed to load Beacon skills");
		const meta = new Map(
			(
				(skills ?? []) as {
					id: string;
					name: string;
					category: string | null;
				}[]
			).map((s) => [s.id, s]),
		);
		const { data, error } = await sb
			.from("beacon_person_skill")
			.select("user_id, skill_id, status")
			.in("status", statuses);
		if (error) throw new DatabaseError("Failed to load Beacon skill claims");
		for (const r of (data ?? []) as {
			user_id: string;
			skill_id: string;
			status: ClaimStatus;
		}[]) {
			const s = meta.get(r.skill_id);
			if (s) bump(r.skill_id, s.name, s.category, r.user_id, r.status);
		}
	} else if (opts.dimension === "capabilities") {
		let q = sb.from("beacon_tag_vocabulary").select("tag, label, category");
		if (opts.category) q = q.eq("category", opts.category);
		const { data: vocab, error: vocabError } = await q;
		if (vocabError)
			throw new DatabaseError("Failed to load Beacon capabilities");
		const meta = new Map(
			(
				(vocab ?? []) as {
					tag: string;
					label: string;
					category: string | null;
				}[]
			).map((v) => [v.tag, v]),
		);
		const { data, error } = await sb
			.from("beacon_person_tag")
			.select("user_id, tag, status")
			.in("status", statuses);
		if (error)
			throw new DatabaseError("Failed to load Beacon capability claims");
		for (const r of (data ?? []) as {
			user_id: string;
			tag: string;
			status: ClaimStatus;
		}[]) {
			const v = meta.get(r.tag);
			if (v) bump(r.tag, v.label, v.category, r.user_id, r.status);
		}
	} else if (opts.dimension === "companies") {
		const { data: orgs, error: orgError } = await sb
			.from("beacon_organization")
			.select("id, tags");
		if (orgError)
			throw new DatabaseError("Failed to load Beacon organizations");
		const tagsById = new Map(
			((orgs ?? []) as { id: string; tags: string[] | null }[]).map((o) => [
				o.id,
				o.tags ?? [],
			]),
		);
		const { data, error } = await sb
			.from("beacon_employment")
			.select("user_id, organization_id, status")
			.in("status", statuses);
		if (error) throw new DatabaseError("Failed to load Beacon employment");
		for (const r of (data ?? []) as {
			user_id: string;
			organization_id: string | null;
			status: ClaimStatus;
		}[]) {
			if (!r.organization_id) continue;
			for (const tag of tagsById.get(r.organization_id) ?? [])
				bump(tag, tag, null, r.user_id, r.status);
		}
	} else {
		const { data: schools, error: schoolError } = await sb
			.from("beacon_school")
			.select("id, groups");
		if (schoolError) throw new DatabaseError("Failed to load Beacon schools");
		const groupsById = new Map(
			((schools ?? []) as { id: string; groups: string[] | null }[]).map(
				(s) => [s.id, s.groups ?? []],
			),
		);
		const { data, error } = await sb
			.from("beacon_education")
			.select("user_id, school_id, status")
			.in("status", statuses);
		if (error) throw new DatabaseError("Failed to load Beacon education");
		for (const r of (data ?? []) as {
			user_id: string;
			school_id: string | null;
			status: ClaimStatus;
		}[]) {
			if (!r.school_id) continue;
			for (const group of groupsById.get(r.school_id) ?? [])
				bump(group, group, null, r.user_id, r.status);
		}
	}

	const allIds = [
		...new Set([...buckets.values()].flatMap((b) => [...b.users.keys()])),
	];
	const visible = await visibleBeaconMemberIds(allIds);
	for (const bucket of buckets.values()) {
		for (const userId of bucket.users.keys()) {
			if (!visible.has(userId)) bucket.users.delete(userId);
		}
	}
	return toEntries(buckets, limit);
}

// Members who share a project or an employer with `userId` (excluding the
// person themselves and anyone opted out of the directory), ranked by how many
// things they share.
export async function findCollaborators(
	userId: string,
	opts?: { statuses?: StatusFilter; limit?: number },
): Promise<CollaboratorHit[]> {
	const statuses = opts?.statuses ?? DEFAULT_STATUS;
	const limit = opts?.limit ?? 12;
	const sb = getSupabase();
	const subjectVisible = await visibleBeaconMemberIds([userId]);
	if (!subjectVisible.has(userId)) return [];

	const [mineProjects, mineOrgs] = await Promise.all([
		sb
			.from("beacon_person_project")
			.select("project_id, status")
			.eq("user_id", userId)
			.in("status", statuses),
		sb
			.from("beacon_employment")
			.select("organization_id, status")
			.eq("user_id", userId)
			.in("status", statuses),
	]);
	if (mineProjects.error || mineOrgs.error) {
		throw new DatabaseError("Failed to load Beacon collaboration sources");
	}
	const projectVerified = new Map<string, boolean>();
	for (const row of (mineProjects.data ?? []) as {
		project_id: string | null;
		status: ClaimStatus;
	}[]) {
		if (!row.project_id) continue;
		projectVerified.set(
			row.project_id,
			(projectVerified.get(row.project_id) ?? false) ||
				row.status === "confirmed",
		);
	}
	const organizationVerified = new Map<string, boolean>();
	for (const row of (mineOrgs.data ?? []) as {
		organization_id: string | null;
		status: ClaimStatus;
	}[]) {
		if (!row.organization_id) continue;
		organizationVerified.set(
			row.organization_id,
			(organizationVerified.get(row.organization_id) ?? false) ||
				row.status === "confirmed",
		);
	}
	const projectIds = [
		...new Set(
			((mineProjects.data ?? []) as { project_id: string | null }[])
				.map((r) => r.project_id)
				.filter(truthy),
		),
	];
	const orgIds = [
		...new Set(
			((mineOrgs.data ?? []) as { organization_id: string | null }[])
				.map((r) => r.organization_id)
				.filter(truthy),
		),
	];
	if (!projectIds.length && !orgIds.length) return [];

	const noRows = Promise.resolve({
		data: [] as Record<string, unknown>[],
		error: null,
	});
	const [others, employers, projects, organizations] = await Promise.all([
		projectIds.length
			? sb
					.from("beacon_person_project")
					.select("user_id, project_id, status")
					.in("project_id", projectIds)
					.in("status", statuses)
			: noRows,
		orgIds.length
			? sb
					.from("beacon_employment")
					.select("user_id, organization_id, status")
					.in("organization_id", orgIds)
					.in("status", statuses)
			: noRows,
		projectIds.length
			? sb.from("beacon_project").select("id, name").in("id", projectIds)
			: noRows,
		orgIds.length
			? sb.from("beacon_organization").select("id, name").in("id", orgIds)
			: noRows,
	]);
	if (
		others.error ||
		employers.error ||
		projects.error ||
		organizations.error
	) {
		throw new DatabaseError("Failed to load Beacon collaborators");
	}

	const projectName = new Map(
		((projects.data ?? []) as { id: string; name: string }[]).map((p) => [
			p.id,
			p.name,
		]),
	);
	const orgName = new Map(
		((organizations.data ?? []) as { id: string; name: string }[]).map((o) => [
			o.id,
			o.name,
		]),
	);

	const shared = new Map<string, Map<string, boolean>>();
	const add = (uid: string, label: string | undefined, verified: boolean) => {
		if (uid === userId || !label) return;
		const labels = shared.get(uid) ?? new Map<string, boolean>();
		labels.set(label, (labels.get(label) ?? false) || verified);
		shared.set(uid, labels);
	};
	for (const r of (others.data ?? []) as {
		user_id: string;
		project_id: string;
		status: ClaimStatus;
	}[])
		add(
			r.user_id,
			projectName.get(r.project_id),
			(projectVerified.get(r.project_id) ?? false) && r.status === "confirmed",
		);
	for (const r of (employers.data ?? []) as {
		user_id: string;
		organization_id: string;
		status: ClaimStatus;
	}[])
		add(
			r.user_id,
			orgName.get(r.organization_id),
			(organizationVerified.get(r.organization_id) ?? false) &&
				r.status === "confirmed",
		);

	const candidateIds = [...shared.keys()];
	if (!candidateIds.length) return [];

	const members = await membersByIds(candidateIds);

	return candidateIds
		.filter((id) => members.has(id))
		.map((id) => {
			const labelStatus = shared.get(id) ?? new Map<string, boolean>();
			const labels = [...labelStatus.keys()];
			const unverified = labels.filter((label) => !labelStatus.get(label));
			const rendered = labels.map((label) =>
				labelStatus.get(label) ? label : `${label} (unverified)`,
			);
			return {
				user_id: id,
				name: nameOf(members.get(id) as MemberRow),
				shared: labels,
				unverified_shared: unverified,
				detail: `Shares: ${rendered.join(", ")}`,
			};
		})
		.sort(
			(a, b) =>
				b.shared.length - a.shared.length || a.name.localeCompare(b.name),
		)
		.slice(0, limit);
}
