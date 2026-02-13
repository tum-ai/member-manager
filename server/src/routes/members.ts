import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ensureOwnerOrAdmin } from "../lib/auth.js";
import {
	DatabaseError,
	ForbiddenError,
	isNotFoundError,
	NotFoundError,
} from "../lib/errors.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const MemberSchema = z.object({
	user_id: z.string(),
	email: z.string().email(),
	given_name: z.string().optional().default(""),
	surname: z.string().optional().default(""),
	date_of_birth: z.string().optional().default("1900-01-01"),
	street: z.string().optional().default(""),
	number: z.string().optional().default(""),
	postal_code: z.string().optional().default(""),
	city: z.string().optional().default(""),
	country: z.string().optional().default(""),
	active: z.boolean().optional().default(true),
	salutation: z.string().optional().default(""),
	title: z.string().optional().default(""),
	batch: z
		.string()
		.nullish()
		.transform((v) => v || null),
	department: z
		.string()
		.nullish()
		.transform((v) => v || null),
	member_role: z
		.string()
		.nullish()
		.transform((v) => v || null),
	degree: z
		.string()
		.nullish()
		.transform((v) => v || null),
	school: z
		.string()
		.nullish()
		.transform((v) => v || null),
	skills: z
		.array(z.string())
		.nullish()
		.transform((v) => (v && v.length > 0 ? v : null)),
	profile_picture_url: z
		.string()
		.url()
		.nullish()
		.transform((v) => v || null),
});

const UpdateMemberSchema = MemberSchema.omit({
	user_id: true,
	active: true,
});

export async function memberRoutes(server: FastifyInstance) {
	server.post(
		"/members",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const body = MemberSchema.parse(request.body);
			const user = (request as AuthenticatedRequest).user;

			if (body.user_id !== user.id) {
				throw new ForbiddenError("User ID mismatch");
			}

			// Check if member exists
			const { data: existingMember, error: fetchError } = await getSupabase()
				.from("members")
				.select("user_id")
				.eq("user_id", body.user_id)
				.single();

			if (fetchError && !isNotFoundError(fetchError)) {
				request.log.error(
					{ err: fetchError },
					"Failed to check existing member",
				);
				throw new DatabaseError();
			}

			if (existingMember) {
				// If exists, just return the member
				const { data: memberData, error: roleError } = await getSupabase()
					.from("members")
					.select("*")
					.eq("user_id", body.user_id)
					.single();

				if (roleError) {
					request.log.error(
						{ err: roleError },
						"Failed to fetch existing member",
					);
					throw new DatabaseError();
				}
				return memberData;
			}

			const { ...memberData } = body;
			const { data, error } = await getSupabase()
				.from("members")
				.insert(memberData)
				.select()
				.single();

			if (error) {
				request.log.error({ err: error }, "Failed to insert member");
				throw new DatabaseError();
			}

			// Assign default role if it doesn't exist
			const { error: roleAssignmentError } = await getSupabase()
				.from("user_roles")
				.upsert(
					{ user_id: body.user_id, role: "user" },
					{ onConflict: "user_id", ignoreDuplicates: true },
				);

			if (roleAssignmentError) {
				request.log.error(
					{ err: roleAssignmentError },
					"Failed to assign default role",
				);
				throw new DatabaseError();
			}

			return data;
		},
	);

	server.get(
		"/members",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const { data, error } = await getSupabase()
				.from("members")
				.select(
					"user_id, given_name, surname, email, batch, department, member_role, degree, school, skills, profile_picture_url, active",
				)
				.eq("active", true)
				.order("surname", { ascending: true });

			if (error) {
				request.log.error({ err: error }, "Failed to fetch members");
				throw new DatabaseError();
			}

			return data;
		},
	);

	server.get<{ Params: { userId: string } }>(
		"/members/:userId",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;

			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only view your own profile",
			);

			const { data, error } = await getSupabase()
				.from("members")
				.select("*")
				.eq("user_id", userId)
				.single();

			if (isNotFoundError(error)) {
				throw new NotFoundError("Member not found");
			}
			if (error) {
				request.log.error({ err: error }, "Failed to fetch member");
				throw new DatabaseError();
			}

			return data;
		},
	);

	server.put<{ Params: { userId: string } }>(
		"/members/:userId",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;

			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only update your own profile",
			);

			const body = UpdateMemberSchema.parse(request.body);

			const memberData = {
				...body,
				user_id: userId,
			};

			const { data, error } = await getSupabase()
				.from("members")
				.upsert(memberData, { onConflict: "user_id" })
				.select()
				.single();

			if (isNotFoundError(error)) {
				throw new NotFoundError("Member not found");
			}
			if (error) {
				request.log.error({ err: error }, "Failed to upsert member");
				throw new DatabaseError();
			}

			return data;
		},
	);
}
