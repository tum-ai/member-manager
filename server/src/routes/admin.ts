import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getAuthProfiles } from "../lib/authEmails.js";
import { DatabaseError } from "../lib/errors.js";
import {
	BOARD_MEMBER_ROLE,
	buildMemberNameSearchText,
	MEMBER_ROLES,
	memberRoleSchema,
	memberStatusSchema,
	normalizeMemberBatch,
	normalizeNullableText,
	normalizeOperationalDepartment,
	requiresDepartmentForMemberRole,
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

const ADMIN_PAGE_LIMIT_MAX = 200;
const ADMIN_EXPENSIVE_FILTER_SCAN_LIMIT = 5_000;

const PositiveIntFromString = z
	.string()
	.transform((value) => Number(value))
	.pipe(z.number().int().positive());

const QuerySchema = z.object({
	page: PositiveIntFromString.default(1),
	limit: PositiveIntFromString.pipe(
		z.number().max(ADMIN_PAGE_LIMIT_MAX),
	).default(10),
	search: z.string().optional(),
	active: z.string().optional(),
	member_status: z.string().optional(),
	mandate_agreed: z.string().optional(),
	privacy_agreed: z.string().optional(),
	data_privacy_notice_agreed: z.string().optional(),
	sort_by: z.string().default("surname"),
	sort_asc: z
		.string()
		.transform((val) => val === "true")
		.default(true),
});

const StatusSchema = z.object({
	member_status: memberStatusSchema,
});

const RoleSchema = z.object({
	member_role: memberRoleSchema,
});
const DepartmentSchema = z.object({
	department: z.string().nullable().transform(normalizeOperationalDepartment),
});
const BoardRoleSchema = z
	.string()
	.nullish()
	.transform((value) =>
		value === undefined ? undefined : normalizeNullableText(value),
	)
	.refine(
		(value) =>
			value === undefined || value === null || value === BOARD_MEMBER_ROLE,
		"Invalid board_role",
	);
const AccessRoleSchema = z.object({
	access_role: z.enum(["user", "admin"]),
});

const LINKEDIN_PROFILE_URL_REGEX =
	/^https:\/\/(www\.)?linkedin\.com\/in\/[^/?#]+\/?([?#].*)?$/i;

const OptionalTextUpdateSchema = z
	.string()
	.nullish()
	.transform((v) => (v === undefined ? undefined : v?.trim() || null))
	.optional();

const OptionalLinkedInProfileUrlUpdateSchema = z
	.union([
		z.string().trim().regex(LINKEDIN_PROFILE_URL_REGEX, {
			message: "Must be a valid LinkedIn profile URL",
		}),
		z.literal(""),
		z.null(),
		z.undefined(),
	])
	.transform((v) => (v === undefined ? undefined : v || null))
	// zod v4: a transform defeats the object's optional-key inference, so an
	// absent key would be rejected without an explicit .optional().
	.optional();

const MemberUpdateSchema = z.object({
	department: z.string().nullable().transform(normalizeNullableText),
	member_role: memberRoleSchema,
	board_role: BoardRoleSchema,
	member_status: memberStatusSchema,
	access_role: z.enum(["user", "admin"]),
	batch: z
		.string()
		.nullish()
		.transform((value) =>
			value === undefined ? undefined : normalizeMemberBatch(value),
		),
	research_project_id: z
		.string()
		.nullish()
		.transform((value) =>
			value === undefined ? undefined : normalizeNullableText(value),
		),
	// LinkedIn fields — admin-editable
	linkedin_profile_url: OptionalLinkedInProfileUrlUpdateSchema,
	public_location: OptionalTextUpdateSchema,
});
const MEMBER_DB_SORT_COLUMNS = new Set([
	"active",
	"batch",
	"created_at",
	"degree",
	"department",
	"board_role",
	"given_name",
	"member_role",
	"phone",
	"school",
	"surname",
	"user_id",
	"member_status",
	"linkedin_profile_url",
	"public_location",
]);

function orderAdminMembersQuery(
	// biome-ignore lint/suspicious/noExplicitAny: Supabase query builder type is not exported.
	query: any,
	sortBy: string,
	sortAsc: boolean,
) {
	const orderedQuery = query.order(sortBy, { ascending: sortAsc });
	if (sortBy === "user_id") {
		return orderedQuery;
	}
	return orderedQuery.order("user_id", { ascending: true });
}

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
		async (request, reply) => {
			const query = QuerySchema.parse(request.query);
			const {
				page,
				limit,
				search,
				active,
				member_status,
				mandate_agreed,
				privacy_agreed,
				data_privacy_notice_agreed,
				sort_by,
				sort_asc,
			} = query;
			const from = (page - 1) * limit;
			const to = from + limit - 1;
			const normalizedSearch = search?.trim().toLowerCase();
			const hasAgreementFilter =
				(mandate_agreed !== undefined && mandate_agreed !== "") ||
				(privacy_agreed !== undefined && privacy_agreed !== "") ||
				(data_privacy_notice_agreed !== undefined &&
					data_privacy_notice_agreed !== "");
			const needsFullProfileMap =
				Boolean(normalizedSearch) || sort_by === "email";
			const canUsePagedDbQuery =
				!normalizedSearch &&
				!hasAgreementFilter &&
				!needsFullProfileMap &&
				MEMBER_DB_SORT_COLUMNS.has(sort_by);

			try {
				const hydrateMembers = (
					// biome-ignore lint/suspicious/noExplicitAny: complex supabase return type
					rawMembers: any[],
					profileMap: Awaited<ReturnType<typeof getAuthProfiles>> = new Map(),
				) =>
					rawMembers.map((member) => {
						const profile = profileMap.get(String(member.user_id));
						const decryptedMember = decryptRecordSafely(
							member,
							SENSITIVE_MEMBER_FIELDS,
							({ field, error }) => {
								request.log.warn(
									{ err: error, userId: member.user_id, field },
									"Failed to decrypt member field; returning blank value",
								);
							},
						);
						return {
							...decryptedMember,
							given_name:
								decryptedMember.given_name || profile?.given_name || "",
							surname: decryptedMember.surname || profile?.surname || "",
							department: normalizeOperationalDepartment(member.department),
							email: profile?.email ?? "",
							avatar_url: profile?.avatar_url ?? "",
							sepa: (() => {
								const sepa = decryptRecordSafely(
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
								);
								const agreements = Array.isArray(member.member_agreements)
									? member.member_agreements[0] || {}
									: member.member_agreements || {};
								return {
									...sepa,
									mandate_agreed:
										agreements.sepa_mandate_agreed ??
										Boolean(sepa.mandate_agreed),
									privacy_agreed:
										agreements.privacy_policy_agreed ??
										Boolean(sepa.privacy_agreed),
									data_privacy_notice_agreed: Boolean(
										agreements.data_privacy_notice_agreed,
									),
								};
							})(),
						};
					});

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
						.select("*, sepa(*), member_agreements(*)", { count: "exact" });

					if (member_status !== undefined && member_status !== "") {
						membersQuery = membersQuery.eq("member_status", member_status);
					} else if (active !== undefined && active !== "") {
						membersQuery = membersQuery.eq("active", active === "true");
					}

					const {
						data: pagedMembers,
						error: membersError,
						count,
					} = await orderAdminMembersQuery(
						membersQuery,
						sort_by,
						sort_asc,
					).range(from, to);

					if (membersError) {
						request.log.error({ err: membersError }, "Failed to fetch members");
						throw new DatabaseError();
					}

					const profileMap = await getAuthProfiles(
						(pagedMembers || []).map((member) => String(member.user_id)),
					);
					const pageRows = hydrateMembers(pagedMembers || [], profileMap);

					return {
						data: await attachAccessRoles(pageRows),
						total: count ?? 0,
						page,
						limit,
					};
				}

				const members: Array<Record<string, unknown>> = [];
				let totalMemberCount: number | null = null;
				let scanOffset = 0;
				while (scanOffset < ADMIN_EXPENSIVE_FILTER_SCAN_LIMIT) {
					let membersQuery = getSupabase()
						.from("members")
						.select(
							"*, sepa(*), member_agreements(*)",
							scanOffset === 0 ? { count: "exact" } : undefined,
						);
					if (member_status !== undefined && member_status !== "") {
						membersQuery = membersQuery.eq("member_status", member_status);
					} else if (active !== undefined && active !== "") {
						membersQuery = membersQuery.eq("active", active === "true");
					}

					const {
						data: memberChunkData,
						error: membersError,
						count,
					} = await membersQuery
						.order("user_id", { ascending: true })
						.range(
							scanOffset,
							Math.min(
								scanOffset + ADMIN_PAGE_LIMIT_MAX - 1,
								ADMIN_EXPENSIVE_FILTER_SCAN_LIMIT - 1,
							),
						);
					if (membersError) {
						request.log.error({ err: membersError }, "Failed to fetch members");
						throw new DatabaseError();
					}
					if (scanOffset === 0 && typeof count === "number") {
						totalMemberCount = count;
						if (count > ADMIN_EXPENSIVE_FILTER_SCAN_LIMIT) {
							return reply.status(413).send({
								error:
									"Admin filters are too broad. Narrow the member filters before searching or sorting by derived fields.",
							});
						}
					}

					const memberChunk = (memberChunkData ?? []) as Array<
						Record<string, unknown>
					>;
					members.push(...memberChunk);
					if (
						(totalMemberCount !== null && members.length >= totalMemberCount) ||
						memberChunk.length < ADMIN_PAGE_LIMIT_MAX
					) {
						break;
					}
					scanOffset += ADMIN_PAGE_LIMIT_MAX;
				}
				if (scanOffset >= ADMIN_EXPENSIVE_FILTER_SCAN_LIMIT) {
					return reply.status(413).send({
						error:
							"Admin filters are too broad. Narrow the member filters before searching or sorting by derived fields.",
					});
				}

				const fullProfileMap = needsFullProfileMap
					? await getAuthProfiles(
							members.map((member) => String(member.user_id)),
						)
					: new Map();

				const joined = hydrateMembers(members, fullProfileMap);
				const filtered = joined.filter(
					// biome-ignore lint/suspicious/noExplicitAny: Vercel type resolution workaround
					(member: any) => {
						const searchableText = [
							buildMemberNameSearchText(member.given_name, member.surname),
							member.email,
						]
							.join(" ")
							.toLowerCase();

						if (
							normalizedSearch &&
							!searchableText.includes(normalizedSearch)
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

						if (
							data_privacy_notice_agreed !== undefined &&
							data_privacy_notice_agreed !== ""
						) {
							const hasDataPrivacyNoticeAgreement = Boolean(
								member.sepa?.data_privacy_notice_agreed,
							);
							if (
								hasDataPrivacyNoticeAgreement !==
								(data_privacy_notice_agreed === "true")
							) {
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

				if (!needsFullProfileMap) {
					const pageProfileMap = await getAuthProfiles(
						paged.map((member) => String(member.user_id)),
					);
					const pagedWithProfiles = hydrateMembers(paged, pageProfileMap);

					return {
						data: await attachAccessRoles(pagedWithProfiles),
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
				request.log.error({ err: authError }, "Failed to fetch auth profiles");
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

	async function memberHasAuthUser(
		userId: string,
		request: FastifyRequest,
	): Promise<boolean> {
		// biome-ignore lint/suspicious/noExplicitAny: Vercel type resolution workaround
		const { data, error } = await (getSupabase().auth as any).admin.getUserById(
			userId,
		);

		if (!error) {
			return Boolean(data?.user);
		}

		if ((error as { status?: number }).status === 404) {
			return false;
		}

		request.log.error(
			{ err: error, userId },
			"Failed to check auth user before access-role update",
		);
		throw new DatabaseError();
	}

	async function ensureAccessRoleCanBePersisted(
		userId: string,
		request: FastifyRequest,
		reply: FastifyReply,
	): Promise<boolean> {
		if (await memberHasAuthUser(userId, request)) {
			return true;
		}

		reply.status(409).send({
			error: "Member must sign in before their access role can be changed",
		});
		return false;
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
					.select(
						"department, member_role, board_role, member_status, active, batch, research_project_id, linkedin_profile_url, public_location",
					)
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
			const shouldUpdateAccessRole =
				currentAccessRole !== parsed.data.access_role;
			if (shouldUpdateAccessRole) {
				if (
					!(await ensureAdminRevocationIsSafe(
						currentAccessRole,
						parsed.data.access_role,
						reply,
					))
				) {
					return reply;
				}

				if (!(await ensureAccessRoleCanBePersisted(userId, request, reply))) {
					return reply;
				}
			}

			const effectiveDepartment = resolveDepartmentForMemberRole(
				parsed.data.member_role,
				parsed.data.department,
			);
			const currentMemberRole =
				typeof (existingMember as { member_role?: unknown }).member_role ===
				"string"
					? (existingMember as { member_role: string }).member_role || "Member"
					: "Member";
			const currentDepartment = resolveDepartmentForMemberRole(
				currentMemberRole,
				(existingMember as { department?: string | null }).department ?? null,
			);
			const roleChanged = parsed.data.member_role !== currentMemberRole;
			const isPreservingMissingRequiredDepartment =
				!roleChanged &&
				!parsed.data.department &&
				!currentDepartment &&
				!effectiveDepartment;
			if (
				requiresDepartmentForMemberRole(parsed.data.member_role) &&
				!effectiveDepartment &&
				!isPreservingMissingRequiredDepartment
			) {
				return reply.status(400).send({
					error: "Department is required for Member and Team Lead roles",
				});
			}

			const memberUpdate: Record<string, unknown> = {
				department: effectiveDepartment,
				member_status: parsed.data.member_status,
				active: statusToLegacyActive(parsed.data.member_status),
				research_project_id:
					effectiveDepartment === "Research"
						? (parsed.data.research_project_id ?? null)
						: null,
			};
			if (roleChanged || effectiveDepartment) {
				memberUpdate.member_role = parsed.data.member_role;
			}
			if (parsed.data.batch !== undefined) {
				memberUpdate.batch = parsed.data.batch;
			}
			if (parsed.data.board_role !== undefined) {
				memberUpdate.board_role = parsed.data.board_role;
			}
			// Persist LinkedIn fields when provided
			if (parsed.data.linkedin_profile_url !== undefined) {
				memberUpdate.linkedin_profile_url = parsed.data.linkedin_profile_url;
			}
			if (parsed.data.public_location !== undefined) {
				memberUpdate.public_location = parsed.data.public_location;
			}

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

			if (shouldUpdateAccessRole) {
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
						board_role:
							(existingMember as { board_role?: string | null }).board_role ??
							null,
						member_status:
							(existingMember as { member_status?: string | null })
								.member_status ?? null,
						active: Boolean((existingMember as { active?: boolean }).active),
						batch: (existingMember as { batch?: string | null }).batch ?? null,
						research_project_id:
							(existingMember as { research_project_id?: string | null })
								.research_project_id ?? null,
						linkedin_profile_url:
							(existingMember as { linkedin_profile_url?: string | null })
								.linkedin_profile_url ?? null,
						public_location:
							(existingMember as { public_location?: string | null })
								.public_location ?? null,
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

			const { data: existingMember, error: existingMemberError } =
				await getSupabase()
					.from("members")
					.select("department")
					.eq("user_id", userId)
					.single();

			if (existingMemberError) {
				if (existingMemberError.code === "PGRST116") {
					return reply.status(404).send({ error: "Member not found" });
				}
				request.log.error(
					{ err: existingMemberError },
					"Failed to fetch member before role update",
				);
				throw new DatabaseError();
			}

			const effectiveDepartment = resolveDepartmentForMemberRole(
				role,
				(existingMember as { department?: string | null }).department,
			);
			if (requiresDepartmentForMemberRole(role) && !effectiveDepartment) {
				return reply.status(400).send({
					error: "Department is required for Member and Team Lead roles",
				});
			}

			const { data, error } = await getSupabase()
				.from("members")
				.update({ member_role: role, department: effectiveDepartment })
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

			const { data: existingMember, error: existingMemberError } =
				await getSupabase()
					.from("members")
					.select("member_role")
					.eq("user_id", userId)
					.single();

			if (existingMemberError) {
				if (existingMemberError.code === "PGRST116") {
					return reply.status(404).send({ error: "Member not found" });
				}
				request.log.error(
					{ err: existingMemberError },
					"Failed to fetch member before department update",
				);
				throw new DatabaseError();
			}

			const memberRole = String(
				(existingMember as { member_role?: string | null }).member_role ??
					"Member",
			);
			const effectiveDepartment = resolveDepartmentForMemberRole(
				memberRole,
				parsed.data.department,
			);
			if (requiresDepartmentForMemberRole(memberRole) && !effectiveDepartment) {
				return reply.status(400).send({
					error: "Department is required for Member and Team Lead roles",
				});
			}

			const { data, error } = await getSupabase()
				.from("members")
				.update({
					department: effectiveDepartment,
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
			if (currentAccessRole === parsed.data.access_role) {
				return {
					user_id: userId,
					access_role: parsed.data.access_role,
				};
			}

			if (
				!(await ensureAdminRevocationIsSafe(
					currentAccessRole,
					parsed.data.access_role,
					reply,
				))
			) {
				return reply;
			}

			if (!(await ensureAccessRoleCanBePersisted(userId, request, reply))) {
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
