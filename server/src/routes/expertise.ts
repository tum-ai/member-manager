// Beacon rich-profile API. A member curates their own expertise profile
// (editable headline/summary + confirm/edit/reject/delete of enriched claims +
// hard opt-out); other members get a confirmed-only read view (the directory).
//
// All access is service-role (getSupabase) gated by ensureOwnerOrAdmin. Claims
// carry provenance (source/confidence/status) so the UI can show where each fact
// came from and let the member review low-confidence / pending items.

import {
	CLAIM_STATUSES,
	claimFieldSchemas,
	expertiseProfileSchema,
	optOutSchema,
	profilePatchSchema,
	tagVocabularyResponseSchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { checkAdminRole, ensureOwnerOrAdmin } from "../lib/auth.js";
import {
	CLAIM_TABLES,
	type ClaimType,
	getExpertiseProfile,
	rebuildSearchChunks,
	resolveOrganization,
	resolveProject,
	resolveSchool,
	resolveSkill,
	setOptOut,
	upsertBeaconPerson,
} from "../lib/beacon.js";
import {
	DatabaseError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../lib/errors.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const StatusSchema = z.enum(CLAIM_STATUSES);

const UserParamsSchema = z.object({ userId: z.string().uuid() });
const ClaimParamsSchema = UserParamsSchema.extend({
	type: z.string().trim().min(1).max(32),
	claimId: z.string().uuid(),
});
const ClaimTypeParamsSchema = UserParamsSchema.extend({
	type: z.string().trim().min(1).max(32),
});

// Per-type editable fields for add (POST) and patch (PATCH). `status` is allowed
// on both; entity references are by free-text name (resolved to canonical ids).
function isClaimType(value: string): value is ClaimType {
	return value in CLAIM_TABLES;
}

function parseRequest<T>(
	schema: z.ZodType<T>,
	input: unknown,
	message: string,
): T {
	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		throw new ValidationError(message, parsed.error.flatten());
	}
	return parsed.data;
}

function parseResponse<T>(schema: z.ZodType<T>, input: unknown): T {
	const parsed = schema.safeParse(input);
	if (!parsed.success) throw new DatabaseError();
	return parsed.data;
}

function parseUserParams(input: unknown): { userId: string } {
	return parseRequest(UserParamsSchema, input, "Invalid expertise member id");
}

function parseClaimTypeParams(input: unknown): {
	userId: string;
	type: string;
} {
	return parseRequest(
		ClaimTypeParamsSchema,
		input,
		"Invalid expertise claim parameters",
	);
}

function parseClaimParams(input: unknown): {
	userId: string;
	type: string;
	claimId: string;
} {
	return parseRequest(
		ClaimParamsSchema,
		input,
		"Invalid expertise claim parameters",
	);
}

function parseClaimFields(
	type: ClaimType,
	input: unknown,
	message: string,
): Record<string, unknown> {
	return parseRequest(
		claimFieldSchemas[type] as z.ZodType<unknown>,
		input,
		message,
	) as Record<string, unknown>;
}

async function ensureOwnerOrAdminSafe(
	request: { log: { error: (obj: unknown, message: string) => void } },
	userId: string,
	targetId: string,
	message: string,
): Promise<void> {
	try {
		await ensureOwnerOrAdmin(userId, targetId, message);
	} catch (error) {
		if (error instanceof ForbiddenError) throw error;
		request.log.error({ err: error }, "Beacon authorization check failed");
		throw new DatabaseError();
	}
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
			return parseResponse(tagVocabularyResponseSchema, { tags: data ?? [] });
		},
	);

	// ---- GET aggregated profile -------------------------------------------
	server.get<{ Params: { userId: string } }>(
		"/expertise/:userId",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = parseUserParams(request.params);
			const user = (request as AuthenticatedRequest).user;
			const isOwner = user.id === userId;
			let isAdmin = false;
			if (!isOwner) {
				try {
					isAdmin = await checkAdminRole(user.id);
				} catch (error) {
					request.log.error({ err: error }, "Beacon admin check failed");
					throw new DatabaseError();
				}
			}
			const editable = isOwner || isAdmin;

			const profile = await getExpertiseProfile(userId, {
				confirmedOnly: !editable,
			});

			if (!profile) {
				// Opted out and viewer isn't owner/admin.
				return parseResponse(expertiseProfileSchema, {
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
				});
			}
			return parseResponse(expertiseProfileSchema, {
				...profile,
				editable,
				opted_out: false,
			});
		},
	);

	// ---- PUT editable profile fields --------------------------------------
	server.put<{ Params: { userId: string } }>(
		"/expertise/:userId",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = parseUserParams(request.params);
			const body = parseRequest(
				profilePatchSchema,
				request.body,
				"Invalid expertise profile update",
			);
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdminSafe(
				request,
				user.id,
				userId,
				"You can only edit your own profile",
			);
			let person: Record<string, unknown>;
			try {
				person = await upsertBeaconPerson(userId, body);
			} catch (error) {
				request.log.error({ err: error }, "Failed to update Beacon profile");
				throw new DatabaseError();
			}
			await rebuildSearchChunks(userId);
			return { person };
		},
	);

	// ---- POST opt-out toggle ----------------------------------------------
	server.post<{ Params: { userId: string } }>(
		"/expertise/:userId/opt-out",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = parseUserParams(request.params);
			const { opted_out } = parseRequest(
				optOutSchema,
				request.body,
				"Invalid Beacon opt-out payload",
			);
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdminSafe(
				request,
				user.id,
				userId,
				"You can only change your own opt-out",
			);
			try {
				await setOptOut(userId, opted_out);
			} catch (error) {
				request.log.error({ err: error }, "Failed to update Beacon opt-out");
				throw new DatabaseError();
			}
			await rebuildSearchChunks(userId);
			return { opted_out };
		},
	);

	// ---- POST add a claim (self-reported: confirmed, no source) -----------
	server.post<{ Params: { userId: string; type: string } }>(
		"/expertise/:userId/claims/:type",
		{ preHandler: authenticate },
		async (request, reply) => {
			const { userId, type } = parseClaimTypeParams(request.params);
			if (!isClaimType(type)) throw new NotFoundError("Unknown claim type");
			const fields = parseClaimFields(
				type,
				request.body ?? {},
				"Invalid Beacon claim payload",
			);
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdminSafe(
				request,
				user.id,
				userId,
				"You can only edit your own profile",
			);

			let cols: Record<string, unknown>;
			try {
				cols = await buildClaimColumns(type, fields);
			} catch (error) {
				if (error instanceof ValidationError) throw error;
				request.log.error({ err: error }, "Failed to resolve Beacon claim");
				throw new DatabaseError();
			}

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
			await rebuildSearchChunks(userId);
			return reply.status(201).send({ claim: data });
		},
	);

	// ---- PATCH edit / confirm / reject a claim ----------------------------
	server.patch<{ Params: { userId: string; type: string; claimId: string } }>(
		"/expertise/:userId/claims/:type/:claimId",
		{ preHandler: authenticate },
		async (request) => {
			const { userId, type, claimId } = parseClaimParams(request.params);
			if (!isClaimType(type)) throw new NotFoundError("Unknown claim type");
			const PatchSchema = claimFieldSchemas[type].extend({
				status: StatusSchema.optional(),
			});
			const fields = parseRequest(
				PatchSchema as z.ZodType<unknown>,
				request.body ?? {},
				"Invalid Beacon claim update",
			) as Record<string, unknown>;
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdminSafe(
				request,
				user.id,
				userId,
				"You can only edit your own profile",
			);
			const { status, ...entityFields } = fields as Record<string, unknown>;
			let cols: Record<string, unknown>;
			try {
				cols = await buildClaimColumns(type, entityFields);
			} catch (error) {
				if (error instanceof ValidationError) throw error;
				request.log.error({ err: error }, "Failed to resolve Beacon claim");
				throw new DatabaseError();
			}
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
			await rebuildSearchChunks(userId);
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
			const { userId, type, claimId } = parseClaimParams(request.params);
			if (!isClaimType(type)) throw new NotFoundError("Unknown claim type");
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdminSafe(
				request,
				user.id,
				userId,
				"You can only edit your own profile",
			);

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
			await rebuildSearchChunks(userId);
			return reply.status(204).send();
		},
	);
}
