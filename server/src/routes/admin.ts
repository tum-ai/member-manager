import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getAuthEmails } from "../lib/authEmails.js";
import { DatabaseError } from "../lib/errors.js";
import {
	MEMBER_ROLES,
	memberRoleSchema,
	memberStatusSchema,
	normalizeNullableText,
	resolveDepartmentForMemberRole,
	statusToLegacyActive,
} from "../lib/memberMetadata.js";
import {
	decryptRecord,
	decryptRecordSafely,
	SENSITIVE_MEMBER_FIELDS,
	SENSITIVE_SEPA_FIELDS,
} from "../lib/sensitiveData.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const QuerySchema = z.object({
	page: z.string().transform(Number).default("1"),
	limit: z.string().transform(Number).default("10"),
	search: z.string().optional(),
	active: z.string().optional(),
	member_status: z.string().optional(),
	mandate_agreed: z.string().optional(),
	privacy_agreed: z.string().optional(),
	sort_by: z.string().default("surname"),
	sort_asc: z
		.string()
		.transform((val) => val === "true")
		.default("true"),
});

const StatusSchema = z.object({
	member_status: memberStatusSchema,
});

const RoleSchema = z.object({
	member_role: memberRoleSchema,
});
const DepartmentSchema = z.object({
	department: z.string().nullable().transform(normalizeNullableText),
});
const AccessRoleSchema = z.object({
	access_role: z.enum(["user", "admin"]),
});
const MemberUpdateSchema = z.object({
	department: z.string().nullable().transform(normalizeNullableText),
	member_role: memberRoleSchema,
	member_status: memberStatusSchema,
	access_role: z.enum(["user", "admin"]),
});
const MEMBER_DB_SORT_COLUMNS = new Set([
	"active",
	"batch",
	"created_at",
	"degree",
	"department",
	"given_name",
	"member_role",
	"phone",
	"school",
	"surname",
	"user_id",
	"member_status",
]);

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const DateOnlySchema = z
	.string()
	.regex(DATE_ONLY_REGEX, "Expected date in YYYY-MM-DD format")
	.refine((value) => {
		const [year, month, day] = value.split("-").map(Number);
		const date = new Date(Date.UTC(year, month - 1, day));
		return (
			date.getUTCFullYear() === year &&
			date.getUTCMonth() === month - 1 &&
			date.getUTCDate() === day
		);
	}, "Invalid calendar date");

const NullableDateOnlySchema = z
	.string()
	.optional()
	.nullable()
	.transform((value) => {
		const trimmed = value?.trim();
		return trimmed ? trimmed : null;
	})
	.pipe(DateOnlySchema.nullable());

const RoleHistoryCreateSchema = z
	.object({
		role: z.enum(MEMBER_ROLES),
		semester: z.string().optional().nullable(),
		started_at: NullableDateOnlySchema,
		ended_at: NullableDateOnlySchema,
		note: z.string().optional().nullable(),
	})
	.refine(
		(data) =>
			!(data.started_at && data.ended_at && data.ended_at < data.started_at),
		{
			message: "ended_at must be on or after started_at",
			path: ["ended_at"],
		},
	);

export async function adminRoutes(server: FastifyInstance) {
	server.get(
		"/admin/members",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, _reply) => {
			const query = QuerySchema.parse(request.query);
			const {
				page,
				limit,
				search,
				active,
				member_status,
				mandate_agreed,
				privacy_agreed,
				sort_by,
				sort_asc,
			} = query;
			const from = (page - 1) * limit;
			const to = from + limit - 1;
			const normalizedSearch = search?.trim().toLowerCase();
			const hasAgreementFilter =
				(mandate_agreed !== undefined && mandate_agreed !== "") ||
				(privacy_agreed !== undefined && privacy_agreed !== "");
			const needsFullEmailMap =
				Boolean(normalizedSearch) || sort_by === "email";
			const canUsePagedDbQuery =
				!normalizedSearch &&
				!hasAgreementFilter &&
				!needsFullEmailMap &&
				MEMBER_DB_SORT_COLUMNS.has(sort_by);

			try {
				const hydrateMembers = (
					// biome-ignore lint/suspicious/noExplicitAny: complex supabase return type
					rawMembers: any[],
					emailMap: Map<string, string> = new Map(),
				) =>
					rawMembers.map((member) => ({
						...decryptRecordSafely(
							member,
							SENSITIVE_MEMBER_FIELDS,
							({ field, error }) => {
								request.log.warn(
									{ err: error, userId: member.user_id, field },
									"Failed to decrypt member field; returning blank value",
								);
							},
						),
						email: emailMap.get(String(member.user_id)) ?? "",
						sepa: decryptRecordSafely(
							Array.isArray(member.sepa)
								? member.sepa[0] || {}
								: member.sepa || {},
							SENSITIVE_SEPA_FIELDS,
							({ field, error }) => {
								request.log.warn(
									{ err: error, userId: member.user_id, field },
									"Failed to decrypt SEPA field; returning blank value",
								);
							},
						),
					}));

				const attachAccessRoles = async (
					// biome-ignore lint/suspicious/noExplicitAny: complex supabase return type
					rows: any[],
				) => {
					if (rows.length === 0) {
						return rows;
					}

					const userIds = Array.from(
						new Set(
							rows
								.map((member) => String(member.user_id ?? ""))
								.filter((userId) => userId.length > 0),
						),
					);

					if (userIds.length === 0) {
						return rows.map((member) => ({
							...member,
							access_role: "user",
						}));
					}

					const { data: accessRoles, error: accessRolesError } =
						await getSupabase()
							.from("user_roles")
							.select("user_id, role")
							.in("user_id", userIds);

					if (accessRolesError) {
						request.log.error(
							{ err: accessRolesError },
							"Failed to fetch access roles",
						);
						throw new DatabaseError();
					}

					const accessRoleMap = new Map(
						(accessRoles || []).map((entry) => [
							String((entry as { user_id?: string }).user_id ?? ""),
							String((entry as { role?: string }).role ?? "user"),
						]),
					);

					return rows.map((member) => ({
						...member,
						access_role: accessRoleMap.get(String(member.user_id)) ?? "user",
					}));
				};

				if (canUsePagedDbQuery) {
					let membersQuery = getSupabase()
						.from("members")
						.select("*, sepa(*)", { count: "exact" });

					if (member_status !== undefined && member_status !== "") {
						membersQuery = membersQuery.eq("member_status", member_status);
					} else if (active !== undefined && active !== "") {
						membersQuery = membersQuery.eq("active", active === "true");
					}

					const {
						data: pagedMembers,
						error: membersError,
						count,
					} = await membersQuery
						.order(sort_by, { ascending: sort_asc })
						.range(from, to);

					if (membersError) {
						request.log.error({ err: membersError }, "Failed to fetch members");
						throw new DatabaseError();
					}

					const pageRows = hydrateMembers(pagedMembers || []);
					const emailMap = await getAuthEmails(
						pageRows.map((member) => String(member.user_id)),
					);

					return {
						data: await attachAccessRoles(
							pageRows.map((member) => ({
								...member,
								email: emailMap.get(String(member.user_id)) ?? "",
							})),
						),
						total: count ?? 0,
						page,
						limit,
					};
				}

				let membersQuery = getSupabase().from("members").select("*, sepa(*)");
				if (member_status !== undefined && member_status !== "") {
					membersQuery = membersQuery.eq("member_status", member_status);
				} else if (active !== undefined && active !== "") {
					membersQuery = membersQuery.eq("active", active === "true");
				}

				const { data: members, error: membersError } = await membersQuery;
				if (membersError) {
					request.log.error({ err: membersError }, "Failed to fetch members");
					throw new DatabaseError();
				}

				const fullEmailMap = needsFullEmailMap
					? await getAuthEmails(
							// biome-ignore lint/suspicious/noExplicitAny: Vercel type resolution workaround
							(members || []).map((member: any) => String(member.user_id)),
						)
					: new Map<string, string>();

				const joined = hydrateMembers(members || [], fullEmailMap);
				const filtered = joined.filter(
					// biome-ignore lint/suspicious/noExplicitAny: Vercel type resolution workaround
					(member: any) => {
						if (
							normalizedSearch &&
							!`${member.given_name} ${member.surname} ${member.email}`
								.toLowerCase()
								.includes(normalizedSearch)
						) {
							return false;
						}

						if (member_status !== undefined && member_status !== "") {
							if (member.member_status !== member_status) {
								return false;
							}
						} else if (active !== undefined && active !== "") {
							const isActive = active === "true";
							if (member.active !== isActive) {
								return false;
							}
						}

						if (mandate_agreed !== undefined && mandate_agreed !== "") {
							const hasMandate = Boolean(member.sepa?.mandate_agreed);
							if (hasMandate !== (mandate_agreed === "true")) {
								return false;
							}
						}

						if (privacy_agreed !== undefined && privacy_agreed !== "") {
							const hasPrivacyAgreement = Boolean(member.sepa?.privacy_agreed);
							if (hasPrivacyAgreement !== (privacy_agreed === "true")) {
								return false;
							}
						}

						return true;
					},
				);

				const getSortValue = (member: (typeof filtered)[number]) => {
					// biome-ignore lint/suspicious/noExplicitAny: dynamic admin sorting
					return (member as any)[sort_by] ?? member.sepa?.[sort_by] ?? "";
				};

				const sorted = [...filtered].sort((left, right) => {
					const leftValue = String(getSortValue(left));
					const rightValue = String(getSortValue(right));
					const comparison = leftValue.localeCompare(rightValue);
					return sort_asc ? comparison : comparison * -1;
				});
				const paged = sorted.slice(from, to + 1);

				if (!needsFullEmailMap) {
					const pageEmailMap = await getAuthEmails(
						paged.map((member) => String(member.user_id)),
					);

					return {
						data: await attachAccessRoles(
							paged.map((member) => ({
								...member,
								email: pageEmailMap.get(String(member.user_id)) ?? "",
							})),
						),
						total: filtered.length,
						page,
						limit,
					};
				}

				return {
					data: await attachAccessRoles(paged),
					total: filtered.length,
					page,
					limit,
				};
			} catch (authError) {
				request.log.error({ err: authError }, "Failed to fetch auth emails");
				throw new DatabaseError();
			}
		},
	);

	async function getCurrentAccessRole(
		userId: string,
		request: FastifyRequest,
	): Promise<"user" | "admin"> {
		const { data: accessRoleRow, error: accessRoleError } = await getSupabase()
			.from("user_roles")
			.select("role")
			.eq("user_id", userId)
			.single();

		if (accessRoleError && accessRoleError.code !== "PGRST116") {
			request.log.error(
				{ err: accessRoleError, userId },
				"Failed to fetch current access role",
			);
			throw new DatabaseError();
		}

		return (accessRoleRow as { role?: string } | null)?.role === "admin"
			? "admin"
			: "user";
	}

	async function ensureAdminRevocationIsSafe(
		currentAccessRole: "user" | "admin",
		nextAccessRole: "user" | "admin",
		reply: FastifyReply,
	): Promise<boolean> {
		if (!(currentAccessRole === "admin" && nextAccessRole === "user")) {
			return true;
		}

		const { data: adminRoles, error: adminRolesError } = await getSupabase()
			.from("user_roles")
			.select("user_id")
			.eq("role", "admin");

		if (adminRolesError) {
			throw new DatabaseError();
		}

		if ((adminRoles ?? []).length <= 1) {
			reply.status(409).send({
				error: "At least one admin must remain in the workspace",
			});
			return false;
		}

		return true;
	}

	server.patch<{ Params: { userId: string } }>(
		"/admin/members/:userId",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const { userId } = request.params;
			const parsed = MemberUpdateSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid member update payload",
					details: parsed.error.flatten(),
				});
			}

			const { data: existingMember, error: memberLookupError } =
				await getSupabase()
					.from("members")
					.select("department, member_role, member_status, active")
					.eq("user_id", userId)
					.single();

			if (memberLookupError) {
				if (memberLookupError.code === "PGRST116") {
					return reply.status(404).send({ error: "Member not found" });
				}
				request.log.error(
					{ err: memberLookupError },
					"Failed to fetch member before combined update",
				);
				throw new DatabaseError();
			}

			const currentAccessRole = await getCurrentAccessRole(userId, request);
			if (
				!(await ensureAdminRevocationIsSafe(
					currentAccessRole,
					parsed.data.access_role,
					reply,
				))
			) {
				return reply;
			}

			const memberUpdate = {
				department: resolveDepartmentForMemberRole(
					parsed.data.member_role,
					parsed.data.department,
				),
				member_role: parsed.data.member_role,
				member_status: parsed.data.member_status,
				active: statusToLegacyActive(parsed.data.member_status),
			};

			const { data: updatedMember, error: memberUpdateError } =
				await getSupabase()
					.from("members")
					.update(memberUpdate)
					.eq("user_id", userId)
					.select()
					.single();

			if (memberUpdateError) {
				if (memberUpdateError.code === "PGRST116") {
					return reply.status(404).send({ error: "Member not found" });
				}
				request.log.error(
					{ err: memberUpdateError },
					"Failed to update member profile",
				);
				throw new DatabaseError();
			}

			const { error: accessRoleUpdateError } = await getSupabase()
				.from("user_roles")
				.upsert(
					{
						user_id: userId,
						role: parsed.data.access_role,
					},
					{ onConflict: "user_id" },
				);

			if (accessRoleUpdateError) {
				request.log.error(
					{ err: accessRoleUpdateError },
					"Failed to update access role during combined member save",
				);
				const rollbackPayload = {
					department:
						(existingMember as { department?: string | null }).department ??
						null,
					member_role:
						(existingMember as { member_role?: string | null }).member_role ??
						null,
					member_status:
						(existingMember as { member_status?: string | null })
							.member_status ?? null,
					active: Boolean((existingMember as { active?: boolean }).active),
				};
				const { error: rollbackError } = await getSupabase()
					.from("members")
					.update(rollbackPayload)
					.eq("user_id", userId);
				if (rollbackError) {
					request.log.error(
						{ err: rollbackError },
						"Failed to roll back member after access role update error",
					);
				}
				throw new DatabaseError();
			}

			return {
				...decryptRecord(updatedMember, SENSITIVE_MEMBER_FIELDS),
				access_role: parsed.data.access_role,
			};
		},
	);

	server.patch<{ Params: { userId: string } }>(
		"/admin/members/:userId/role",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const { userId } = request.params;
			const parsed = RoleSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid member_role",
					details: parsed.error.flatten(),
				});
			}
			const role = parsed.data.member_role;
			const updatePayload: {
				member_role: string;
				department?: string | null;
			} = {
				member_role: role,
			};

			const { data, error } = await getSupabase()
				.from("members")
				.update(updatePayload)
				.eq("user_id", userId)
				.select()
				.single();

			if (error) {
				if (error.code === "PGRST116") {
					return reply.status(404).send({ error: "Member not found" });
				}
				request.log.error({ err: error }, "Failed to update member role");
				throw new DatabaseError();
			}

			return decryptRecord(data, SENSITIVE_MEMBER_FIELDS);
		},
	);

	server.patch<{ Params: { userId: string } }>(
		"/admin/members/:userId/department",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const { userId } = request.params;
			const parsed = DepartmentSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid department",
					details: parsed.error.flatten(),
				});
			}

			const { data: existingMember, error: memberLookupError } =
				await getSupabase()
					.from("members")
					.select("member_role")
					.eq("user_id", userId)
					.single();

			if (memberLookupError) {
				if (memberLookupError.code === "PGRST116") {
					return reply.status(404).send({ error: "Member not found" });
				}
				request.log.error(
					{ err: memberLookupError },
					"Failed to fetch member before department update",
				);
				throw new DatabaseError();
			}

			const { data, error } = await getSupabase()
				.from("members")
				.update({
					department: resolveDepartmentForMemberRole(
						(existingMember as { member_role?: string | null }).member_role,
						parsed.data.department,
					),
				})
				.eq("user_id", userId)
				.select()
				.single();

			if (error) {
				if (error.code === "PGRST116") {
					return reply.status(404).send({ error: "Member not found" });
				}
				request.log.error({ err: error }, "Failed to update member department");
				throw new DatabaseError();
			}

			return decryptRecord(data, SENSITIVE_MEMBER_FIELDS);
		},
	);

	server.patch<{ Params: { userId: string } }>(
		"/admin/members/:userId/access-role",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const { userId } = request.params;
			const parsed = AccessRoleSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid access_role",
					details: parsed.error.flatten(),
				});
			}

			const { data: existingMember, error: memberLookupError } =
				await getSupabase()
					.from("members")
					.select("user_id")
					.eq("user_id", userId)
					.single();

			if (memberLookupError || !existingMember) {
				if (memberLookupError?.code === "PGRST116") {
					return reply.status(404).send({ error: "Member not found" });
				}
				request.log.error(
					{ err: memberLookupError },
					"Failed to fetch member before access-role update",
				);
				throw new DatabaseError();
			}

			const currentAccessRole = await getCurrentAccessRole(userId, request);
			if (
				!(await ensureAdminRevocationIsSafe(
					currentAccessRole,
					parsed.data.access_role,
					reply,
				))
			) {
				return reply;
			}

			const { error } = await getSupabase().from("user_roles").upsert(
				{
					user_id: userId,
					role: parsed.data.access_role,
				},
				{ onConflict: "user_id" },
			);

			if (error) {
				request.log.error({ err: error }, "Failed to update access role");
				throw new DatabaseError();
			}

			return {
				user_id: userId,
				access_role: parsed.data.access_role,
			};
		},
	);

	// --- member_role_history CRUD (admin-only) ---
	//
	// History rows are ordered so the UI can render a timeline. Start/end dates
	// are optional strings (YYYY-MM-DD) because admins often only know the
	// semester label (e.g. "WS25/26").

	server.get<{ Params: { userId: string } }>(
		"/admin/members/:userId/role-history",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, _reply) => {
			const { userId } = request.params;
			const { data, error } = await getSupabase()
				.from("member_role_history")
				.select("*")
				.eq("user_id", userId)
				.order("started_at", { ascending: false });

			if (error) {
				request.log.error(
					{ err: error },
					"Failed to fetch member role history",
				);
				throw new DatabaseError();
			}
			return data ?? [];
		},
	);

	server.post<{ Params: { userId: string } }>(
		"/admin/members/:userId/role-history",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const { userId } = request.params;
			const parsed = RoleHistoryCreateSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid role history entry",
					details: parsed.error.flatten(),
				});
			}

			const payload = {
				user_id: userId,
				role: parsed.data.role,
				semester: parsed.data.semester ?? null,
				started_at: parsed.data.started_at ?? null,
				ended_at: parsed.data.ended_at ?? null,
				note: parsed.data.note ?? null,
			};

			const { data, error } = await getSupabase()
				.from("member_role_history")
				.insert(payload)
				.select()
				.single();

			if (error) {
				request.log.error(
					{ err: error },
					"Failed to insert member role history entry",
				);
				throw new DatabaseError();
			}

			return reply.status(201).send(data);
		},
	);

	server.delete<{ Params: { userId: string; id: string } }>(
		"/admin/members/:userId/role-history/:id",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const { userId, id } = request.params;
			const { error } = await getSupabase()
				.from("member_role_history")
				.delete()
				.eq("id", id)
				.eq("user_id", userId);

			if (error) {
				request.log.error(
					{ err: error },
					"Failed to delete member role history entry",
				);
				throw new DatabaseError();
			}
			return reply.status(204).send();
		},
	);

	server.patch(
		"/admin/members/:userId/status",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, _reply) => {
			const { userId } = request.params as { userId: string };
			const body = StatusSchema.parse(request.body);
			const isActive = statusToLegacyActive(body.member_status);

			const { error } = await getSupabase()
				.from("members")
				.update({
					member_status: body.member_status,
					active: isActive,
				})
				.eq("user_id", userId);

			if (error) {
				request.log.error({ err: error }, "Failed to update member status");
				throw new DatabaseError();
			}

			return { message: "Status updated successfully" };
		},
	);
}
