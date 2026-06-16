// Beacon enrichment claim model + idempotent upsert.
//
// Enrichment producers (pdl.ts, researchAgent.ts, member self-data) emit
// `ProposedClaim`s. `applyClaims` resolves canonical entities, gates each claim
// by confidence/identity, and inserts/updates while RESPECTING member decisions:
// a claim the member already confirmed or rejected is never silently flipped by
// a later enrichment run. Dry-run computes the exact diff and writes nothing
// (it also never creates canonical entities).
//
// supabase-js `.upsert(onConflict)` can't target our partial/expression dedup
// indexes, so we do explicit find-then-insert/update keyed on a natural key.

import {
	CLAIM_TABLES,
	type ClaimType,
	canonicalKey,
	ensureTagVocabulary,
	findOrganization,
	findProject,
	findSchool,
	findSkill,
	resolveOrganization,
	resolveProject,
	resolveSchool,
	resolveSkill,
	type SourceKind,
	tagSlug,
	updateProjectDetails,
} from "./beacon.js";
import { getSupabase } from "./supabase.js";

export type ClaimStatus = "confirmed" | "pending" | "rejected";

export interface ProposedEmployment {
	type: "employment";
	organizationName?: string | null;
	title?: string | null;
	startYear?: number | null;
	endYear?: number | null;
	isCurrent?: boolean;
	confidence: number;
	rawValue: string;
}
export interface ProposedEducation {
	type: "education";
	schoolName?: string | null;
	degree?: string | null;
	field?: string | null;
	startYear?: number | null;
	endYear?: number | null;
	confidence: number;
	rawValue: string;
}
export interface ProposedSkill {
	type: "skill";
	skillName: string;
	category?: string | null;
	proficiency?: string | null;
	confidence: number;
	rawValue: string;
}
export interface ProposedProject {
	type: "project";
	projectName: string;
	url?: string | null;
	description?: string | null;
	role?: string | null;
	confidence: number;
	rawValue: string;
}
export interface ProposedTag {
	type: "tag";
	tag: string;
	// When the tag is new to the vocabulary (e.g. discovered via web research),
	// these grow the controlled list rather than being dropped.
	label?: string | null;
	category?: string | null;
	confidence: number;
	rawValue: string;
}
export type ProposedClaim =
	| ProposedEmployment
	| ProposedEducation
	| ProposedSkill
	| ProposedProject
	| ProposedTag;

export const CONFIRM_THRESHOLD = 0.85;

// A claim auto-confirms ONLY when self-reported, or high-confidence from an
// identity-confirmed source (e.g. a matched LinkedIn). Name-based / web
// discovery (identity not confirmed) always lands as pending for review.
export function gateStatus(
	confidence: number,
	identityConfirmed: boolean,
	kind: SourceKind,
): ClaimStatus {
	if (kind === "self") return "confirmed";
	if (identityConfirmed && confidence >= CONFIRM_THRESHOLD) return "confirmed";
	return "pending";
}

export function normalizeYear(value: unknown): number | null {
	const n =
		typeof value === "number"
			? value
			: typeof value === "string" && /^\d{4}$/.test(value.trim())
				? Number(value.trim())
				: null;
	if (n === null) return null;
	return n >= 1900 && n <= 2100 ? n : null;
}

export type DiffAction = "add" | "update" | "skip";
export interface DiffItem {
	type: ClaimType;
	label: string;
	action: DiffAction;
	status?: ClaimStatus;
	reason?: string;
}
export interface ApplyResult {
	items: DiffItem[];
	added: number;
	updated: number;
	skipped: number;
}

interface ExistingRow {
	id: string;
	status: ClaimStatus;
	confidence: number;
	source_id: string | null;
	organization_id?: string | null;
	school_id?: string | null;
	skill_id?: string | null;
	project_id?: string | null;
	title?: string | null;
	degree?: string | null;
	tag?: string | null;
	raw_value?: string | null;
}

const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// Natural dedup key for an existing DB row (per type). Mirrors keyForProposed.
function keyForRow(type: ClaimType, r: ExistingRow): string {
	switch (type) {
		case "employment":
			return `${r.organization_id ?? `raw:${canonicalKey(r.raw_value ?? "")}`}|${lc(r.title)}`;
		case "education":
			return `${r.school_id ?? `raw:${canonicalKey(r.raw_value ?? "")}`}|${lc(r.degree)}`;
		case "skill":
			return r.skill_id ?? "";
		case "project":
			return r.project_id ?? "";
		case "tag":
			return r.tag ?? "";
	}
}

const SELECT_COLS: Record<ClaimType, string> = {
	employment: "id,status,confidence,source_id,organization_id,title,raw_value",
	education: "id,status,confidence,source_id,school_id,degree,raw_value",
	skill: "id,status,confidence,source_id,skill_id",
	project: "id,status,confidence,source_id,project_id",
	tag: "id,status,confidence,source_id,tag",
};

async function loadExisting(
	type: ClaimType,
	userId: string,
): Promise<Map<string, ExistingRow>> {
	const { data } = await getSupabase()
		.from(CLAIM_TABLES[type])
		.select(SELECT_COLS[type])
		.eq("user_id", userId);
	const map = new Map<string, ExistingRow>();
	for (const row of (data ?? []) as unknown as ExistingRow[]) {
		map.set(keyForRow(type, row), row);
	}
	return map;
}

// Resolve an entity name to an id. apply → create if missing; dry → find only
// (returns { id: null, willCreate: true } when it doesn't exist yet).
async function resolveEntity(
	type: "organization" | "school" | "skill" | "project",
	name: string,
	apply: boolean,
): Promise<{ id: string | null; willCreate: boolean }> {
	const finder = {
		organization: findOrganization,
		school: findSchool,
		skill: findSkill,
		project: findProject,
	}[type];
	const existing = await finder(name);
	if (existing) return { id: existing.id, willCreate: false };
	if (!apply) return { id: null, willCreate: true };
	const creator = {
		organization: resolveOrganization,
		school: resolveSchool,
		skill: resolveSkill,
		project: resolveProject,
	}[type];
	const created = await creator(name);
	return { id: created?.id ?? null, willCreate: false };
}

interface ApplyOptions {
	userId: string;
	sourceId: string | null;
	kind: SourceKind;
	identityConfirmed: boolean;
	apply: boolean;
}

// Build the column patch for an insert of a proposed claim.
function buildInsertCols(
	claim: ProposedClaim,
	entityId: string | null,
	status: ClaimStatus,
	sourceId: string | null,
): Record<string, unknown> {
	const base = {
		confidence: claim.confidence,
		status,
		source_id: sourceId,
		raw_value: claim.rawValue,
	};
	switch (claim.type) {
		case "employment":
			return {
				...base,
				organization_id: entityId,
				title: claim.title ?? null,
				start_year: normalizeYear(claim.startYear),
				end_year: normalizeYear(claim.endYear),
				is_current: claim.isCurrent ?? false,
			};
		case "education":
			return {
				...base,
				school_id: entityId,
				degree: claim.degree ?? null,
				field: claim.field ?? null,
				start_year: normalizeYear(claim.startYear),
				end_year: normalizeYear(claim.endYear),
			};
		case "skill":
			return {
				...base,
				skill_id: entityId,
				proficiency: claim.proficiency ?? null,
			};
		case "project":
			return { ...base, project_id: entityId, role: claim.role ?? null };
		case "tag":
			return { ...base, tag: tagSlug(claim.tag) };
	}
}

function labelFor(claim: ProposedClaim): string {
	switch (claim.type) {
		case "employment":
			return `${claim.title ?? "role"} @ ${claim.organizationName ?? "?"}`;
		case "education":
			return `${claim.degree ?? "study"} · ${claim.schoolName ?? "?"}`;
		case "skill":
			return claim.skillName;
		case "project":
			return claim.projectName;
		case "tag":
			return claim.tag;
	}
}

// Apply a list of proposed claims for one member from one source. Idempotent;
// respects member-confirmed/rejected rows. Returns a diff (dry-run safe).
export async function applyClaims(
	claims: ProposedClaim[],
	opts: ApplyOptions,
): Promise<ApplyResult> {
	const supabase = getSupabase();
	const items: DiffItem[] = [];
	const byType: Partial<Record<ClaimType, Map<string, ExistingRow>>> = {};

	for (const claim of claims) {
		const type = claim.type;
		if (!byType[type]) byType[type] = await loadExisting(type, opts.userId);
		const existingMap = byType[type] as Map<string, ExistingRow>;
		const label = labelFor(claim);

		// Resolve the entity reference (if any).
		let entityId: string | null = null;
		let willCreate = false;
		const entityName =
			claim.type === "employment"
				? claim.organizationName
				: claim.type === "education"
					? claim.schoolName
					: claim.type === "skill"
						? claim.skillName
						: claim.type === "project"
							? claim.projectName
							: null;
		if (entityName && claim.type !== "tag") {
			const entityKind =
				claim.type === "employment"
					? "organization"
					: claim.type === "education"
						? "school"
						: (claim.type as "skill" | "project");
			const r = await resolveEntity(entityKind, entityName, opts.apply);
			entityId = r.id;
			willCreate = r.willCreate;
			// Persist "what this project is" (description/url) onto the canonical
			// project so search + the assistant know it (e.g. NeatPass = iOS app).
			if (claim.type === "project" && opts.apply && entityId) {
				await updateProjectDetails(entityId, {
					description: claim.description,
					url: claim.url,
				});
			}
		}

		// skill/project/tag require an entity ref.
		if (
			(claim.type === "skill" || claim.type === "project") &&
			!entityId &&
			!willCreate
		) {
			items.push({ type, label, action: "skip", reason: "no entity" });
			continue;
		}

		// Grow the controlled vocabulary for (possibly new) tags so the FK insert
		// succeeds. Web research may propose tags not yet in the list.
		if (claim.type === "tag" && opts.apply) {
			await ensureTagVocabulary(
				tagSlug(claim.tag),
				claim.label,
				claim.category,
			);
		}

		// Natural-key match against existing rows.
		const key =
			claim.type === "employment"
				? `${entityId ?? `raw:${canonicalKey(entityName ?? "")}`}|${lc(claim.title)}`
				: claim.type === "education"
					? `${entityId ?? `raw:${canonicalKey(entityName ?? "")}`}|${lc(claim.degree)}`
					: claim.type === "skill" || claim.type === "project"
						? (entityId ?? `new:${canonicalKey(entityName ?? "")}`)
						: tagSlug(claim.tag);
		const existing = existingMap.get(key);
		const gated = gateStatus(
			claim.confidence,
			opts.identityConfirmed,
			opts.kind,
		);

		if (!existing) {
			items.push({ type, label, action: "add", status: gated });
			if (opts.apply) {
				const cols = buildInsertCols(claim, entityId, gated, opts.sourceId);
				const { error } = await supabase
					.from(CLAIM_TABLES[type])
					.insert({ user_id: opts.userId, ...cols });
				if (error && error.code !== "23505") throw error;
			}
			continue;
		}

		// Member already acted on this claim → respect it.
		if (existing.status === "rejected") {
			items.push({ type, label, action: "skip", reason: "member rejected" });
			continue;
		}

		// Update path: bump confidence, keep a confirmed status confirmed, only
		// re-gate a still-pending claim.
		const nextConfidence = Math.max(existing.confidence, claim.confidence);
		const nextStatus: ClaimStatus =
			existing.status === "confirmed" ? "confirmed" : gated;
		const raiseSource =
			claim.confidence >= existing.confidence || existing.source_id === null;

		items.push({
			type,
			label,
			action: "update",
			status: nextStatus,
			reason:
				existing.status === "confirmed"
					? "refresh (member-confirmed)"
					: undefined,
		});

		if (opts.apply) {
			const patch: Record<string, unknown> = {
				confidence: nextConfidence,
				status: nextStatus,
			};
			if (raiseSource) patch.source_id = opts.sourceId;
			const { error } = await supabase
				.from(CLAIM_TABLES[type])
				.update(patch)
				.eq("id", existing.id);
			if (error) throw error;
		}
	}

	return {
		items,
		added: items.filter((i) => i.action === "add").length,
		updated: items.filter((i) => i.action === "update").length,
		skipped: items.filter((i) => i.action === "skip").length,
	};
}
