import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ensureOwnerOrAdmin } from "../lib/auth.js";
import { getAuthProfiles } from "../lib/authEmails.js";
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
import { decryptMemberForResponse } from "../lib/memberDecryption.js";
import {
	DEFAULT_MEMBER_ROLE,
	DEFAULT_MEMBER_STATUS,
	normalizeMemberBatch,
	normalizeOperationalDepartment,
} from "../lib/memberMetadata.js";
import {
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
	department: z
		.string()
		.nullish()
		.transform((v) => normalizeOperationalDepartment(v)),
	degree: z
		.string()
		.nullish()
		.transform((v) => v || null),
	school: z
		.string()
		.nullish()
		.transform((v) => v || null),
	research_project_id: z
		.string()
		.nullish()
		.transform((v) => v || null),
	reimbursement_slack_notifications_enabled: z
		.boolean()
		.optional()
		.default(false),
});

const LOCAL_ADMIN_BANK_DETAILS = {
	iban: "DE89370400440532013000",
	bic: "COBADEFFXXX",
	bank_name: "Commerzbank",
	mandate_agreed: true,
	privacy_agreed: true,
	data_privacy_notice_agreed: true,
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

			const { data: existingAgreements, error: agreementFetchError } =
				await supabase
					.from("member_agreements")
					.select(
						"user_id, sepa_mandate_agreed, privacy_policy_agreed, data_privacy_notice_agreed",
					)
					.eq("user_id", user.id)
					.maybeSingle();

			if (agreementFetchError && !isNotFoundError(agreementFetchError)) {
				request.log.error(
					{ err: agreementFetchError },
					"Failed to check local admin member agreement profile",
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
			const agreementRecord = existingAgreements as {
				sepa_mandate_agreed?: boolean | null;
				privacy_policy_agreed?: boolean | null;
				data_privacy_notice_agreed?: boolean | null;
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

			if (
				!agreementRecord?.sepa_mandate_agreed ||
				!agreementRecord?.privacy_policy_agreed ||
				!agreementRecord?.data_privacy_notice_agreed
			) {
				const { error: agreementError } = await supabase
					.from("member_agreements")
					.upsert(
						{
							user_id: user.id,
							sepa_mandate_agreed:
								agreementRecord?.sepa_mandate_agreed ??
								LOCAL_ADMIN_BANK_DETAILS.mandate_agreed,
							privacy_policy_agreed:
								agreementRecord?.privacy_policy_agreed ??
								LOCAL_ADMIN_BANK_DETAILS.privacy_agreed,
							data_privacy_notice_agreed:
								agreementRecord?.data_privacy_notice_agreed ??
								LOCAL_ADMIN_BANK_DETAILS.data_privacy_notice_agreed,
							updated_at: new Date().toISOString(),
						},
						{ onConflict: "user_id" },
					);

				if (agreementError) {
					request.log.error(
						{ err: agreementError },
						"Failed to bootstrap local admin member agreement profile",
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
					...decryptMemberForResponse(memberData, body.user_id, request),
					email: user.email ?? "",
				};
			}

			// Department is admin-managed: it gates access to department-internal
			// tools, so members cannot self-assign it (not even at creation). New
			// profiles start without a department and request one through
			// member_change_requests for an admin to approve.
			const memberData = encryptRecord(
				{
					...body,
					department: null,
					research_project_id: null,
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
				...decryptMemberForResponse(data, body.user_id, request),
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
					"user_id, given_name, surname, batch, department, member_role, board_role, research_project_id, degree, school, active, member_status, linkedin_profile_url, public_location",
				)
				.in("member_status", ["active", "alumni"])
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
						user_id: member.user_id,
						given_name: member.given_name || profile?.given_name || "",
						surname: member.surname || profile?.surname || "",
						batch: member.batch,
						department: normalizeOperationalDepartment(member.department),
						member_role: member.member_role,
						board_role: member.board_role,
						research_project_id: member.research_project_id,
						degree: member.degree,
						school: member.school,
						active: member.active,
						member_status: member.member_status,
						linkedin_profile_url: member.linkedin_profile_url,
						public_location: member.public_location,
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
				const profile = (await getAuthProfiles([userId])).get(userId);

				return {
					...decryptMemberForResponse(data, userId, request),
					email: profile?.email ?? "",
					// Slack profile picture (from auth metadata) so the profile page
					// can render the member's avatar.
					avatar_url: profile?.avatar_url ?? "",
				};
			} catch (authError) {
				request.log.error({ err: authError }, "Failed to fetch auth profile");
				throw new DatabaseError();
			}
		},
	);
}
