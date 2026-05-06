import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { checkAdminRole, ensureOwnerOrAdmin } from "../lib/auth.js";
import { getAuthEmail, getAuthProfiles } from "../lib/authEmails.js";
import {
	DatabaseError,
	ForbiddenError,
	isNotFoundError,
	NotFoundError,
} from "../lib/errors.js";
import {
	isLocalAdminBootstrapEnabled,
	isLocalAdminEmail,
} from "../lib/localAdmin.js";
import {
	DEFAULT_MEMBER_ROLE,
	DEFAULT_MEMBER_STATUS,
	memberRoleSchema,
	normalizeMemberBatch,
	normalizeOperationalDepartment,
	requiresDepartmentForMemberRole,
	resolveDepartmentForMemberRole,
} from "../lib/memberMetadata.js";
import {
	decryptRecordSafely,
	encryptRecord,
	SENSITIVE_MEMBER_FIELDS,
	SENSITIVE_SEPA_FIELDS,
} from "../lib/sensitiveData.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

function isValidDate(dateString: string): boolean {
	const regex = /^\d{4}-\d{2}-\d{2}$/;
	if (!regex.test(dateString)) {
		return false;
	}

	const date = new Date(dateString);
	if (Number.isNaN(date.getTime())) {
		return false;
	}

	return date.toISOString().slice(0, 10) === dateString;
}

const MemberSchema = z.object({
	user_id: z.string(),
	given_name: z.string().optional().default(""),
	surname: z.string().optional().default(""),
	date_of_birth: z
		.string()
		.refine(
			(value) => value.trim() === "" || isValidDate(value),
			"Invalid date_of_birth",
		)
		.optional()
		.default(""),
	street: z
		.string()
		.nullish()
		.transform((value) => value || ""),
	number: z
		.string()
		.nullish()
		.transform((value) => value || ""),
	postal_code: z
		.string()
		.nullish()
		.transform((value) => value || ""),
	city: z
		.string()
		.nullish()
		.transform((value) => value || ""),
	country: z
		.string()
		.nullish()
		.transform((value) => value || ""),
	salutation: z.string().optional().default(""),
	title: z.string().optional().default(""),
	batch: z
		.string()
		.nullish()
		.transform((v) => normalizeMemberBatch(v)),
	degree: z
		.string()
		.nullish()
		.transform((v) => v || null),
	school: z
		.string()
		.nullish()
		.transform((v) => v || null),
});

const UpdateMemberSchema = z.object({
	given_name: z.string().optional(),
	surname: z.string().optional(),
	date_of_birth: z
		.string()
		.refine(
			(value) => value.trim() === "" || isValidDate(value),
			"Invalid date_of_birth",
		)
		.optional(),
	street: z.string().optional(),
	number: z.string().optional(),
	postal_code: z.string().optional(),
	city: z.string().optional(),
	country: z.string().optional(),
	salutation: z.string().optional(),
	title: z.string().optional(),
	batch: z
		.string()
		.nullish()
		.transform((v) => (v === undefined ? undefined : normalizeMemberBatch(v))),
	department: z
		.string()
		.nullish()
		.transform((v) => (v === undefined ? undefined : v || null)),
	member_role: memberRoleSchema.optional(),
	degree: z
		.string()
		.nullish()
		.transform((v) => (v === undefined ? undefined : v || null)),
	school: z
		.string()
		.nullish()
		.transform((v) => (v === undefined ? undefined : v || null)),
});

const LOCAL_ADMIN_BANK_DETAILS = {
	iban: "DE89370400440532013000",
	bic: "COBADEFFXXX",
	bank_name: "Commerzbank",
	mandate_agreed: true,
	privacy_agreed: true,
} as const;

export async function memberRoutes(server: FastifyInstance) {
	server.post(
		"/members/bootstrap-local-admin",
		{ preHandler: authenticate },
		async (request, reply) => {
			if (!isLocalAdminBootstrapEnabled()) {
				return reply.status(404).send({ error: "Not found" });
			}

			const user = (request as AuthenticatedRequest).user;
			if (!isLocalAdminEmail(user.email)) {
				return reply.status(403).send({
					error: "This account is not in the local admin allowlist",
				});
			}

			const supabase = getSupabase();
			const { error } = await supabase.from("user_roles").upsert(
				{
					user_id: user.id,
					role: "admin",
				},
				{ onConflict: "user_id" },
			);

			if (error) {
				request.log.error({ err: error }, "Failed to bootstrap local admin");
				throw new DatabaseError();
			}

			const defaultMember = encryptRecord(
				{
					user_id: user.id,
					given_name: "Local",
					surname: "Admin",
					date_of_birth: "",
					street: "",
					number: "",
					postal_code: "",
					city: "",
					country: "",
					salutation: "",
					title: "",
					batch: "WS22",
					department: "Legal & Finance",
					member_role: "President",
					member_status: "active",
					active: true,
					degree: null,
					school: "TUM",
				},
				SENSITIVE_MEMBER_FIELDS,
			);
			const { error: memberError } = await supabase
				.from("members")
				.upsert(defaultMember, {
					onConflict: "user_id",
					ignoreDuplicates: true,
				});

			if (memberError) {
				request.log.error(
					{ err: memberError },
					"Failed to bootstrap local admin member profile",
				);
				throw new DatabaseError();
			}

			const { data: existingSepa, error: sepaFetchError } = await supabase
				.from("sepa")
				.select("user_id, iban, bic, bank_name, mandate_agreed, privacy_agreed")
				.eq("user_id", user.id)
				.single();

			if (sepaFetchError && !isNotFoundError(sepaFetchError)) {
				request.log.error(
					{ err: sepaFetchError },
					"Failed to check local admin SEPA profile",
				);
				throw new DatabaseError();
			}

			const sepaRecord = existingSepa as {
				iban?: string | null;
				bic?: string | null;
				bank_name?: string | null;
				mandate_agreed?: boolean | null;
				privacy_agreed?: boolean | null;
			} | null;
			if (!sepaRecord?.iban || !sepaRecord?.bic) {
				const localAdminSepa = encryptRecord(
					{
						user_id: user.id,
						iban: sepaRecord?.iban || LOCAL_ADMIN_BANK_DETAILS.iban,
						bic: sepaRecord?.bic || LOCAL_ADMIN_BANK_DETAILS.bic,
						bank_name:
							sepaRecord?.bank_name || LOCAL_ADMIN_BANK_DETAILS.bank_name,
						mandate_agreed:
							sepaRecord?.mandate_agreed ??
							LOCAL_ADMIN_BANK_DETAILS.mandate_agreed,
						privacy_agreed:
							sepaRecord?.privacy_agreed ??
							LOCAL_ADMIN_BANK_DETAILS.privacy_agreed,
					},
					SENSITIVE_SEPA_FIELDS,
				);
				const { error: sepaError } = await supabase
					.from("sepa")
					.upsert(localAdminSepa, { onConflict: "user_id" });

				if (sepaError) {
					request.log.error(
						{ err: sepaError },
						"Failed to bootstrap local admin SEPA profile",
					);
					throw new DatabaseError();
				}
			}

			return { granted: true, role: "admin" };
		},
	);

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
				return {
					...decryptRecordSafely(
						memberData,
						SENSITIVE_MEMBER_FIELDS,
						({ field, error }) => {
							request.log.warn(
								{ err: error, userId: body.user_id, field },
								"Failed to decrypt member field; returning blank value",
							);
						},
					),
					email: user.email ?? "",
				};
			}

			const memberData = encryptRecord(
				{
					...body,
					department: null,
					member_role: DEFAULT_MEMBER_ROLE,
					member_status: DEFAULT_MEMBER_STATUS,
					active: true,
				},
				SENSITIVE_MEMBER_FIELDS,
			);
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

			return {
				...decryptRecordSafely(
					data,
					SENSITIVE_MEMBER_FIELDS,
					({ field, error }) => {
						request.log.warn(
							{ err: error, userId: body.user_id, field },
							"Failed to decrypt member field; returning blank value",
						);
					},
				),
				email: user.email ?? "",
			};
		},
	);

	server.get(
		"/members",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const { data, error } = await getSupabase()
				.from("members")
				.select(
					"user_id, given_name, surname, batch, department, member_role, board_role, degree, school, active, member_status",
				)
				.eq("member_status", DEFAULT_MEMBER_STATUS)
				.order("surname", { ascending: true });

			if (error) {
				request.log.error({ err: error }, "Failed to fetch members");
				throw new DatabaseError();
			}

			try {
				const profileMap = await getAuthProfiles(
					// biome-ignore lint/suspicious/noExplicitAny: Vercel type resolution workaround
					(data || []).map((member: any) => String(member.user_id)),
				);

				// biome-ignore lint/suspicious/noExplicitAny: Vercel type resolution workaround
				return (data || []).map((member: any) => {
					const profile = profileMap.get(String(member.user_id));
					return {
						...member,
						department: normalizeOperationalDepartment(member.department),
						email: profile?.email ?? "",
						avatar_url: profile?.avatar_url ?? "",
					};
				});
			} catch (authError) {
				request.log.error({ err: authError }, "Failed to fetch auth profiles");
				throw new DatabaseError();
			}
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

			try {
				const email = await getAuthEmail(userId);

				return {
					...decryptRecordSafely(
						data,
						SENSITIVE_MEMBER_FIELDS,
						({ field, error }) => {
							request.log.warn(
								{ err: error, userId, field },
								"Failed to decrypt member field; returning blank value",
							);
						},
					),
					email,
				};
			} catch (authError) {
				request.log.error({ err: authError }, "Failed to fetch auth email");
				throw new DatabaseError();
			}
		},
	);

	server.put<{ Params: { userId: string } }>(
		"/members/:userId",
		{ preHandler: authenticate },
		async (request, reply) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;

			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only update your own profile",
			);

			const body = UpdateMemberSchema.parse(request.body);
			let isAdmin = false;
			try {
				isAdmin = await checkAdminRole(user.id);
			} catch (roleError) {
				request.log.error(
					{ err: roleError, userId: user.id },
					"Failed to determine admin role for profile update",
				);
				throw new DatabaseError();
			}

			const updatePayload: Record<string, unknown> = {
				...body,
				user_id: userId,
			};
			if (!isAdmin) {
				delete updatePayload.department;
				delete updatePayload.member_role;
			} else if (
				Object.hasOwn(body, "department") ||
				Object.hasOwn(body, "member_role")
			) {
				const { data: existingMember, error: existingMemberError } =
					await getSupabase()
						.from("members")
						.select("member_role, department")
						.eq("user_id", userId)
						.single();

				if (existingMemberError && !isNotFoundError(existingMemberError)) {
					request.log.error(
						{ err: existingMemberError, userId },
						"Failed to fetch existing member before admin profile update",
					);
					throw new DatabaseError();
				}

				const nextRole =
					body.member_role ??
					String(
						(existingMember as { member_role?: string | null } | null)
							?.member_role ?? DEFAULT_MEMBER_ROLE,
					);
				const requestedDepartment = Object.hasOwn(body, "department")
					? body.department
					: (existingMember as { department?: string | null } | null)
							?.department;
				const effectiveDepartment = resolveDepartmentForMemberRole(
					nextRole,
					requestedDepartment,
				);
				if (requiresDepartmentForMemberRole(nextRole) && !effectiveDepartment) {
					return reply.status(400).send({
						error: "Department is required for Member and Team Lead roles",
					});
				}

				updatePayload.member_role = nextRole;
				updatePayload.department = effectiveDepartment;
			}

			const memberData = encryptRecord(updatePayload, SENSITIVE_MEMBER_FIELDS);

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

			try {
				const email = await getAuthEmail(userId);

				return {
					...decryptRecordSafely(
						data,
						SENSITIVE_MEMBER_FIELDS,
						({ field, error }) => {
							request.log.warn(
								{ err: error, userId, field },
								"Failed to decrypt member field; returning blank value",
							);
						},
					),
					email,
				};
			} catch (authError) {
				request.log.error({ err: authError }, "Failed to fetch auth email");
				throw new DatabaseError();
			}
		},
	);
}
