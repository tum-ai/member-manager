import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DatabaseError } from "../lib/errors.js";
import {
	memberRoleSchema,
	normalizeNullableText,
	requiresDepartmentForMemberRole,
	resolveDepartmentForMemberRole,
} from "../lib/memberMetadata.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const ChangeFieldsSchema = z
	.object({
		department: z
			.string()
			.nullish()
			.transform(normalizeNullableText)
			.optional(),
		member_role: memberRoleSchema.optional(),
		degree: z.string().nullish().transform(normalizeNullableText).optional(),
		school: z.string().nullish().transform(normalizeNullableText).optional(),
		batch: z.string().nullish().transform(normalizeNullableText).optional(),
	})
	.refine(
		(changes) => Object.values(changes).some((value) => value !== undefined),
		"At least one requested change is required",
	);

const CreateChangeRequestSchema = z.object({
	changes: ChangeFieldsSchema,
	reason: z.string().trim().min(1).max(500).optional(),
});

const ReviewChangeRequestSchema = z.object({
	decision: z.enum(["approved", "rejected"]),
	review_note: z.string().trim().min(1).max(500).optional(),
});

type StoredChangeRequest = {
	id: string;
	user_id: string;
	status: string;
	changes: Record<string, unknown>;
	reason?: string | null;
	review_note?: string | null;
};

function compactRequestedChanges(
	changes: z.infer<typeof ChangeFieldsSchema>,
): Record<string, unknown> {
	const compacted = Object.fromEntries(
		Object.entries(changes).filter(([, value]) => value !== undefined),
	);
	const requestedRole =
		typeof compacted.member_role === "string"
			? compacted.member_role
			: undefined;

	if (requestedRole || Object.hasOwn(compacted, "department")) {
		compacted.department = resolveDepartmentForMemberRole(
			requestedRole,
			compacted.department as string | null | undefined,
		);
	}

	return compacted;
}

function hasValidDepartmentForRequestedRole(
	role: string | undefined,
	department: unknown,
): boolean {
	return !(
		requiresDepartmentForMemberRole(role) &&
		!resolveDepartmentForMemberRole(
			role,
			typeof department === "string" || department === null
				? department
				: undefined,
		)
	);
}

export async function changeRequestRoutes(server: FastifyInstance) {
	server.post(
		"/member-change-requests",
		{ preHandler: authenticate },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const parsed = CreateChangeRequestSchema.parse(request.body);
			const requestedRole = parsed.changes.member_role;
			if (
				requestedRole &&
				Object.hasOwn(parsed.changes, "department") &&
				!hasValidDepartmentForRequestedRole(
					requestedRole,
					parsed.changes.department,
				)
			) {
				return reply.status(400).send({
					error: "Department is required for Member and Team Lead roles",
				});
			}

			const { data, error } = await getSupabase()
				.from("member_change_requests")
				.insert({
					user_id: user.id,
					status: "pending",
					changes: compactRequestedChanges(parsed.changes),
					reason: parsed.reason ?? null,
				})
				.select()
				.single();

			if (error) {
				request.log.error(
					{ err: error },
					"Failed to create member change request",
				);
				throw new DatabaseError();
			}

			return reply.status(201).send(data);
		},
	);

	server.get(
		"/member-change-requests",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const user = (request as AuthenticatedRequest).user;
			const { data, error } = await getSupabase()
				.from("member_change_requests")
				.select("*")
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			if (error) {
				request.log.error(
					{ err: error },
					"Failed to list member change requests",
				);
				throw new DatabaseError();
			}

			return data ?? [];
		},
	);

	server.get(
		"/admin/member-change-requests",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, _reply) => {
			const { data, error } = await getSupabase()
				.from("member_change_requests")
				.select("*")
				.eq("status", "pending")
				.order("created_at", { ascending: false });

			if (error) {
				request.log.error(
					{ err: error },
					"Failed to list admin change requests",
				);
				throw new DatabaseError();
			}

			return data ?? [];
		},
	);

	server.patch<{ Params: { requestId: string } }>(
		"/admin/member-change-requests/:requestId",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const { requestId } = request.params;
			const review = ReviewChangeRequestSchema.parse(request.body);

			const { data: requestRow, error: fetchError } = await getSupabase()
				.from("member_change_requests")
				.select("*")
				.eq("id", requestId)
				.single();

			if (fetchError) {
				if (fetchError.code === "PGRST116") {
					return reply.status(404).send({ error: "Change request not found" });
				}
				request.log.error(
					{ err: fetchError },
					"Failed to fetch change request",
				);
				throw new DatabaseError();
			}

			const changeRequest = requestRow as StoredChangeRequest;
			if (changeRequest.status !== "pending") {
				return reply
					.status(409)
					.send({ error: "Change request already reviewed" });
			}

			if (review.decision === "approved") {
				const { data: existingMember, error: memberLookupError } =
					await getSupabase()
						.from("members")
						.select("member_role, department")
						.eq("user_id", changeRequest.user_id)
						.single();

				if (memberLookupError) {
					request.log.error(
						{ err: memberLookupError },
						"Failed to fetch member before applying change request",
					);
					throw new DatabaseError();
				}

				const rawChanges = changeRequest.changes;
				const requestedRole =
					typeof rawChanges.member_role === "string"
						? rawChanges.member_role
						: undefined;
				const hasRequestedDepartment = Object.hasOwn(rawChanges, "department");
				const nextRole =
					requestedRole ??
					String(
						(existingMember as { member_role?: string | null }).member_role ??
							"Member",
					);
				const approvedChanges: Record<string, unknown> = { ...rawChanges };

				if (requestedRole || hasRequestedDepartment) {
					approvedChanges.department = resolveDepartmentForMemberRole(
						nextRole,
						hasRequestedDepartment
							? (rawChanges.department as string | null | undefined)
							: (existingMember as { department?: string | null }).department,
					);
					if (
						requiresDepartmentForMemberRole(nextRole) &&
						!approvedChanges.department
					) {
						return reply.status(400).send({
							error: "Department is required for Member and Team Lead roles",
						});
					}
				}

				const { error: memberError } = await getSupabase()
					.from("members")
					.update(approvedChanges)
					.eq("user_id", changeRequest.user_id);

				if (memberError) {
					request.log.error(
						{ err: memberError },
						"Failed to apply approved member change request",
					);
					throw new DatabaseError();
				}
			}

			const { data, error } = await getSupabase()
				.from("member_change_requests")
				.update({
					status: review.decision,
					review_note: review.review_note ?? null,
					reviewed_by: user.id,
					reviewed_at: new Date().toISOString(),
				})
				.eq("id", requestId)
				.select()
				.single();

			if (error) {
				request.log.error({ err: error }, "Failed to update change request");
				throw new DatabaseError();
			}

			return data;
		},
	);
}
