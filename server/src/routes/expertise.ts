// Beacon rich-profile API. A member curates their own expertise profile
// (editable headline/summary + confirm/edit/reject/delete of enriched claims +
// hard opt-out); other members get a confirmed-only read view (the directory).
//
// All access is service-role (getSupabase) gated by ensureOwnerOrAdmin. Claims
// carry provenance (source/confidence/status) so the UI can show where each fact
// came from and let the member review low-confidence / pending items.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { checkAdminRole, ensureOwnerOrAdmin } from "../lib/auth.js";
import {
	CLAIM_STATUSES,
	CLAIM_TABLES,
	type ClaimType,
	getExpertiseProfile,
	markSearchIndexStale,
	resolveOrganization,
	resolveProject,
	resolveSchool,
	resolveSkill,
	setOptOut,
	upsertBeaconPerson,
} from "../lib/beacon.js";
import {
	DatabaseError,
	NotFoundError,
	ValidationError,
} from "../lib/errors.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const StatusSchema = z.enum(CLAIM_STATUSES);
const YearSchema = z.number().int().min(1900).max(2100);

// Per-type editable fields for add (POST) and patch (PATCH). `status` is allowed
// on both; entity references are by free-text name (resolved to canonical ids).
const ClaimFieldSchemas = {
	employment: z.object({
		organization_name: z.string().trim().min(1).max(200).optional(),
		title: z.string().trim().max(200).optional(),
		start_year: YearSchema.optional(),
		end_year: YearSchema.optional(),
		is_current: z.boolean().optional(),
	}),
	education: z.object({
		school_name: z.string().trim().min(1).max(200).optional(),
		degree: z.string().trim().max(120).optional(),
		field: z.string().trim().max(200).optional(),
		start_year: YearSchema.optional(),
		end_year: YearSchema.optional(),
	}),
	skill: z.object({
		skill_name: z.string().trim().min(1).max(120).optional(),
		proficiency: z
			.enum(["beginner", "intermediate", "advanced", "expert"])
			.optional(),
	}),
	project: z.object({
		project_name: z.string().trim().min(1).max(200).optional(),
		url: z.string().trim().url().max(500).optional(),
		description: z.string().trim().max(2000).optional(),
		role: z.string().trim().max(200).optional(),
	}),
	tag: z.object({
		tag: z.string().trim().min(1).max(120).optional(),
	}),
} as const;

function isClaimType(value: string): value is ClaimType {
	return value in CLAIM_TABLES;
}

// Resolve any entity-name fields on a claim body into the canonical *_id columns,
// returning the DB row patch. Mutates nothing; returns only columns to write.
async function buildClaimColumns(
	type: ClaimType,
	fields: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const cols: Record<string, unknown> = {};
	if (type === "employment") {
		if (fields.organization_name) {
			const org = await resolveOrganization(fields.organization_name as string);
			cols.organization_id = org?.id ?? null;
			cols.raw_value = fields.organization_name;
		}
		for (const k of ["title", "start_year", "end_year", "is_current"]) {
			if (k in fields) cols[k] = fields[k];
		}
	} else if (type === "education") {
		if (fields.school_name) {
			const school = await resolveSchool(fields.school_name as string);
			cols.school_id = school?.id ?? null;
			cols.raw_value = fields.school_name;
		}
		for (const k of ["degree", "field", "start_year", "end_year"]) {
			if (k in fields) cols[k] = fields[k];
		}
	} else if (type === "skill") {
		if (fields.skill_name) {
			const skill = await resolveSkill(fields.skill_name as string);
			if (!skill) throw new ValidationError("Invalid skill name");
			cols.skill_id = skill.id;
			cols.raw_value = fields.skill_name;
		}
		if ("proficiency" in fields) cols.proficiency = fields.proficiency;
	} else if (type === "project") {
		if (fields.project_name) {
			const project = await resolveProject(fields.project_name as string);
			if (!project) throw new ValidationError("Invalid project name");
			cols.project_id = project.id;
			cols.raw_value = fields.project_name;
		}
		if ("role" in fields) cols.role = fields.role;
		// url/description live on the canonical project; update there if given.
		if (fields.project_name && (fields.url || fields.description)) {
			await getSupabase()
				.from("beacon_project")
				.update({
					...(fields.url ? { url: fields.url } : {}),
					...(fields.description ? { description: fields.description } : {}),
				})
				.eq("id", cols.project_id as string);
		}
	} else if (type === "tag") {
		if (fields.tag) {
			cols.tag = fields.tag;
			cols.raw_value = fields.tag;
		}
	}
	return cols;
}

export async function expertiseRoutes(server: FastifyInstance) {
	// ---- GET controlled tag vocabulary (reference data) -------------------
	// 3-segment path: never collides with the 2-segment /expertise/:userId.
	server.get(
		"/expertise/meta/tags",
		{ preHandler: authenticate },
		async (request) => {
			const { data, error } = await getSupabase()
				.from("beacon_tag_vocabulary")
				.select("tag, label, category, description")
				.order("category", { ascending: true })
				.order("label", { ascending: true });
			if (error) {
				request.log.error({ err: error }, "Failed to read tag vocabulary");
				throw new DatabaseError();
			}
			return { tags: data ?? [] };
		},
	);

	// ---- GET aggregated profile -------------------------------------------
	server.get<{ Params: { userId: string } }>(
		"/expertise/:userId",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;
			const isOwner = user.id === userId;
			const isAdmin = isOwner ? false : await checkAdminRole(user.id);
			const editable = isOwner || isAdmin;

			const profile = await getExpertiseProfile(userId, {
				confirmedOnly: !editable,
			});

			if (!profile) {
				// Opted out and viewer isn't owner/admin.
				return {
					user_id: userId,
					editable: false,
					opted_out: true,
					person: null,
					member: null,
					employment: [],
					education: [],
					skills: [],
					projects: [],
					tags: [],
					counts: { confirmed: 0, pending: 0, rejected: 0 },
				};
			}
			return { ...profile, editable, opted_out: false };
		},
	);

	// ---- PUT editable profile fields --------------------------------------
	const ProfilePatchSchema = z.object({
		headline: z.string().trim().max(200).nullish(),
		summary: z.string().trim().max(4000).nullish(),
	});
	server.put<{ Params: { userId: string } }>(
		"/expertise/:userId",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only edit your own profile",
			);
			const body = ProfilePatchSchema.parse(request.body);
			const person = await upsertBeaconPerson(userId, body);
			return { person };
		},
	);

	// ---- POST opt-out toggle ----------------------------------------------
	const OptOutSchema = z.object({ opted_out: z.boolean() });
	server.post<{ Params: { userId: string } }>(
		"/expertise/:userId/opt-out",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only change your own opt-out",
			);
			const { opted_out } = OptOutSchema.parse(request.body);
			await setOptOut(userId, opted_out);
			return { opted_out };
		},
	);

	// ---- POST add a claim (self-reported: confirmed, no source) -----------
	server.post<{ Params: { userId: string; type: string } }>(
		"/expertise/:userId/claims/:type",
		{ preHandler: authenticate },
		async (request, reply) => {
			const { userId, type } = request.params;
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only edit your own profile",
			);
			if (!isClaimType(type)) throw new NotFoundError("Unknown claim type");

			const fields = ClaimFieldSchemas[type].parse(request.body ?? {});
			const cols = await buildClaimColumns(type, fields);

			// Required entity ref per type.
			if (type === "skill" && !cols.skill_id)
				throw new ValidationError("skill_name is required");
			if (type === "project" && !cols.project_id)
				throw new ValidationError("project_name is required");
			if (type === "tag" && !cols.tag)
				throw new ValidationError("tag is required");

			const insert = {
				user_id: userId,
				...cols,
				source_id: null, // self-reported
				confidence: 1,
				status: "confirmed",
			};
			const { data, error } = await getSupabase()
				.from(CLAIM_TABLES[type])
				.insert(insert)
				.select("*")
				.single();
			if (error) {
				// Unique violation (already have this skill/tag/etc.)
				if (error.code === "23505")
					throw new ValidationError("You already have this entry");
				request.log.error({ err: error }, "Failed to add beacon claim");
				throw new DatabaseError();
			}
			void markSearchIndexStale(userId); // fire-and-forget; never blocks the write
			return reply.status(201).send({ claim: data });
		},
	);

	// ---- PATCH edit / confirm / reject a claim ----------------------------
	server.patch<{ Params: { userId: string; type: string; claimId: string } }>(
		"/expertise/:userId/claims/:type/:claimId",
		{ preHandler: authenticate },
		async (request) => {
			const { userId, type, claimId } = request.params;
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only edit your own profile",
			);
			if (!isClaimType(type)) throw new NotFoundError("Unknown claim type");

			const PatchSchema = ClaimFieldSchemas[type].extend({
				status: StatusSchema.optional(),
			});
			const fields = PatchSchema.parse(request.body ?? {});
			const { status, ...entityFields } = fields as Record<string, unknown>;
			const cols = await buildClaimColumns(type, entityFields);
			if (status !== undefined) cols.status = status;
			if (Object.keys(cols).length === 0)
				throw new ValidationError("No fields to update");

			const supabase = getSupabase();
			const { data, error } = await supabase
				.from(CLAIM_TABLES[type])
				.update(cols)
				.eq("id", claimId)
				.eq("user_id", userId) // ownership scope: can't touch others' rows
				.select("*")
				.maybeSingle();
			if (error) {
				request.log.error({ err: error }, "Failed to update beacon claim");
				throw new DatabaseError();
			}
			if (!data) throw new NotFoundError("Claim not found");
			void markSearchIndexStale(userId); // fire-and-forget; never blocks the write
			return { claim: data };
		},
	);

	// ---- DELETE a claim ---------------------------------------------------
	server.delete<{
		Params: { userId: string; type: string; claimId: string };
	}>(
		"/expertise/:userId/claims/:type/:claimId",
		{ preHandler: authenticate },
		async (request, reply) => {
			const { userId, type, claimId } = request.params;
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only edit your own profile",
			);
			if (!isClaimType(type)) throw new NotFoundError("Unknown claim type");

			const { error, count } = await getSupabase()
				.from(CLAIM_TABLES[type])
				.delete({ count: "exact" })
				.eq("id", claimId)
				.eq("user_id", userId);
			if (error) {
				request.log.error({ err: error }, "Failed to delete beacon claim");
				throw new DatabaseError();
			}
			if (!count) throw new NotFoundError("Claim not found");
			void markSearchIndexStale(userId); // fire-and-forget; never blocks the write
			return reply.status(204).send();
		},
	);
}
