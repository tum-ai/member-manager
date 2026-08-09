import {
	type ApprovedEducationalCourseParticipant,
	createEducationalCoursePeriodSchema,
	type EducationalCourseApplication,
	type EducationalCourseParticipant,
	type EducationalCourseParticipantCandidate,
	type EducationalCoursePeriod,
	educationalCourseApplicationStatusSchema,
	getEducationalCourseDateOnly,
	isActiveMember,
	reviewEducationalCourseApplicationSchema,
	searchEducationalCourseParticipantCandidatesSchema,
	updateEducationalCoursePeriodSchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { type AuthProfile, getAuthProfiles } from "../lib/authEmails.js";
import {
	ConflictError,
	DatabaseError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../lib/errors.js";
import { getSupabase } from "../lib/supabase.js";
import {
	authenticate,
	requireAdmin,
	requireEducationalCourseAccess,
	requireEducationalCourseAdministrator,
	requireEducationalCourseParticipant,
} from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const userParamsSchema = z.object({ userId: z.string().guid() }).strict();
const periodParamsSchema = z.object({ periodId: z.string().uuid() }).strict();
const applicationParamsSchema = z
	.object({ applicationId: z.string().uuid() })
	.strict();
const emptyQuerySchema = z.object({}).strict();
const emptyBodySchema = z.union([
	z.undefined(),
	z.null(),
	z.object({}).strict(),
]);
const PARTICIPANT_CANDIDATE_LIMIT = 12;
const PARTICIPANT_CANDIDATE_SCAN_LIMIT = PARTICIPANT_CANDIDATE_LIMIT * 2;

interface MemberRow {
	user_id: string;
	given_name: string | null;
	surname: string | null;
	educational_course_role?: string | null;
	member_status?: string | null;
	active?: boolean | null;
}

interface PeriodRow {
	id: string;
	starts_on: string;
	ends_on: string;
	capacity: number;
	applications_open: boolean;
	created_at: string;
	updated_at: string;
}

interface ApplicationRow {
	id: string;
	period_id: string;
	applicant_user_id: string;
	status: string;
	reviewed_at: string | null;
	created_at: string;
	updated_at: string;
}

function parseInput<T>(
	schema: z.ZodType<T>,
	value: unknown,
	message: string,
): T {
	const parsed = schema.safeParse(value);
	if (!parsed.success) {
		throw new ValidationError(message, parsed.error.flatten());
	}
	return parsed.data;
}

function databaseErrorCode(error: unknown): string | null {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return null;
	}
	return typeof error.code === "string" ? error.code : null;
}

function participantFromMember(row: MemberRow): EducationalCourseParticipant {
	return {
		userId: row.user_id,
		givenName: row.given_name ?? "",
		surname: row.surname ?? "",
		active: isActiveMember(row),
	};
}

function candidateFromMember(
	row: MemberRow,
	profile: AuthProfile | undefined,
): EducationalCourseParticipantCandidate {
	return {
		userId: row.user_id,
		givenName: row.given_name || profile?.given_name || "",
		surname: row.surname || profile?.surname || "",
		email: profile?.email ?? "",
	};
}

function displayName(row: MemberRow | undefined): string {
	if (!row) return "";
	return [row.given_name?.trim(), row.surname?.trim()]
		.filter((part): part is string => Boolean(part))
		.join(" ");
}

function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, "\\$&");
}

function applicationFromRow(
	row: ApplicationRow,
	membersById: Map<string, MemberRow>,
): EducationalCourseApplication {
	const member = membersById.get(row.applicant_user_id);
	const parsedStatus = educationalCourseApplicationStatusSchema.safeParse(
		row.status,
	);
	if (!parsedStatus.success) {
		throw new DatabaseError("Educational course application status is invalid");
	}

	return {
		id: row.id,
		periodId: row.period_id,
		userId: row.applicant_user_id,
		givenName: member?.given_name ?? "",
		surname: member?.surname ?? "",
		status: parsedStatus.data,
		reviewedAt: row.reviewed_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function periodFromRow(
	row: PeriodRow,
	applications: ApplicationRow[],
	membersById: Map<string, MemberRow>,
	currentUserId: string,
): EducationalCoursePeriod {
	const periodApplications = applications.filter(
		(application) => application.period_id === row.id,
	);
	const approvedParticipants: ApprovedEducationalCourseParticipant[] =
		periodApplications
			.filter((application) => application.status === "approved")
			.map((application) => ({
				userId: application.applicant_user_id,
				displayName: displayName(
					membersById.get(application.applicant_user_id),
				),
			}));
	const ownApplication = periodApplications.find(
		(application) => application.applicant_user_id === currentUserId,
	);

	return {
		id: row.id,
		startsOn: row.starts_on,
		endsOn: row.ends_on,
		capacity: row.capacity,
		applicationsOpen: row.applications_open,
		approvedParticipants,
		myApplication: ownApplication
			? applicationFromRow(ownApplication, membersById)
			: null,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

async function loadMember(userId: string): Promise<MemberRow | null> {
	const { data, error } = await getSupabase()
		.from("members")
		.select(
			"user_id, given_name, surname, educational_course_role, member_status, active",
		)
		.eq("user_id", userId)
		.maybeSingle();

	if (error) {
		throw new DatabaseError("Failed to load educational course member");
	}
	return data as MemberRow | null;
}

async function loadMembersById(
	userIds: string[],
): Promise<Map<string, MemberRow>> {
	const uniqueIds = [...new Set(userIds)];
	if (uniqueIds.length === 0) return new Map();

	const { data, error } = await getSupabase()
		.from("members")
		.select("user_id, given_name, surname")
		.in("user_id", uniqueIds);
	if (error) {
		throw new DatabaseError("Failed to load educational course identities");
	}

	return new Map(
		((data ?? []) as MemberRow[]).map((member) => [member.user_id, member]),
	);
}

async function loadPeriod(periodId: string): Promise<PeriodRow | null> {
	const { data, error } = await getSupabase()
		.from("educational_course_periods")
		.select(
			"id, starts_on, ends_on, capacity, applications_open, created_at, updated_at",
		)
		.eq("id", periodId)
		.maybeSingle();
	if (error) {
		throw new DatabaseError("Failed to load educational course period");
	}
	return data as PeriodRow | null;
}

async function loadApplications(
	periodIds: string[],
): Promise<ApplicationRow[]> {
	if (periodIds.length === 0) return [];

	const { data, error } = await getSupabase()
		.from("educational_course_applications")
		.select(
			"id, period_id, applicant_user_id, status, reviewed_at, created_at, updated_at",
		)
		.in("period_id", periodIds)
		.order("created_at", { ascending: true });
	if (error) {
		throw new DatabaseError("Failed to load educational course applications");
	}
	return (data ?? []) as ApplicationRow[];
}

async function searchParticipantCandidates(
	search: string,
): Promise<EducationalCourseParticipantCandidate[]> {
	const pattern = `%${escapeLikePattern(search)}%`;
	const candidateColumns = ["given_name", "surname"] as const;
	const results = await Promise.all(
		candidateColumns.map(async (column) => {
			const { data, error } = await getSupabase()
				.from("members")
				.select("user_id, given_name, surname, member_status, active")
				.is("educational_course_role", null)
				.ilike(column, pattern)
				.order("surname", { ascending: true })
				.limit(PARTICIPANT_CANDIDATE_SCAN_LIMIT);
			if (error) {
				throw new DatabaseError("Failed to search participant candidates");
			}
			return (data ?? []) as MemberRow[];
		}),
	);

	const candidateRows = [
		...new Map(
			results
				.flat()
				.filter(isActiveMember)
				.map((member) => [member.user_id, member]),
		).values(),
	].slice(0, PARTICIPANT_CANDIDATE_LIMIT);
	const profiles = await getAuthProfiles(
		candidateRows.map((member) => member.user_id),
	);
	return candidateRows.map((member) =>
		candidateFromMember(member, profiles.get(member.user_id)),
	);
}

async function loadPeriodData(periodRows: PeriodRow[]): Promise<{
	applications: ApplicationRow[];
	membersById: Map<string, MemberRow>;
}> {
	const applications = await loadApplications(
		periodRows.map((period) => period.id),
	);
	const membersById = await loadMembersById(
		applications.map((application) => application.applicant_user_id),
	);
	return { applications, membersById };
}

async function setMemberEducationRole(
	userId: string,
	role: "participant" | "administrator" | null,
): Promise<MemberRow> {
	const { data, error } = await getSupabase()
		.from("members")
		.update({ educational_course_role: role })
		.eq("user_id", userId)
		.select(
			"user_id, given_name, surname, educational_course_role, member_status, active",
		)
		.maybeSingle();
	if (error) {
		throw new DatabaseError("Failed to update educational course role");
	}
	if (!data) {
		throw new NotFoundError("Member not found");
	}
	return data as MemberRow;
}

function ensureAssignableMember(member: MemberRow | null): MemberRow {
	if (!member) {
		throw new NotFoundError("Member not found");
	}
	if (!isActiveMember(member)) {
		throw new ConflictError(
			"Educational course roles can only be assigned to active members",
		);
	}
	return member;
}

export async function educationalCourseRoutes(server: FastifyInstance) {
	server.put(
		"/admin/education/administrators/:userId",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const { userId } = parseInput(
				userParamsSchema,
				request.params,
				"Invalid educational course administrator",
			);
			parseInput(
				emptyBodySchema,
				request.body,
				"Administrator assignment does not accept a payload",
			);
			ensureAssignableMember(await loadMember(userId));
			const administrator = await setMemberEducationRole(
				userId,
				"administrator",
			);
			return reply.status(200).send(participantFromMember(administrator));
		},
	);

	server.delete(
		"/admin/education/administrators/:userId",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const { userId } = parseInput(
				userParamsSchema,
				request.params,
				"Invalid educational course administrator",
			);
			parseInput(
				emptyBodySchema,
				request.body,
				"Administrator removal does not accept a payload",
			);
			const member = await loadMember(userId);
			if (member?.educational_course_role !== "administrator") {
				throw new NotFoundError("Educational course administrator not found");
			}
			await setMemberEducationRole(userId, null);
			return reply.status(204).send();
		},
	);

	server.get(
		"/education/participants",
		{ preHandler: [authenticate, requireEducationalCourseAdministrator] },
		async (request) => {
			parseInput(
				emptyQuerySchema,
				request.query,
				"Invalid participant roster query",
			);
			const { data, error } = await getSupabase()
				.from("members")
				.select(
					"user_id, given_name, surname, educational_course_role, member_status, active",
				)
				.eq("educational_course_role", "participant")
				.order("surname", { ascending: true });
			if (error) {
				throw new DatabaseError("Failed to load participant roster");
			}
			const participants = ((data ?? []) as MemberRow[]).map(
				participantFromMember,
			);

			return { participants };
		},
	);

	server.get(
		"/education/participant-candidates",
		{ preHandler: [authenticate, requireEducationalCourseAdministrator] },
		async (request) => {
			const input = parseInput(
				searchEducationalCourseParticipantCandidatesSchema,
				request.query,
				"Invalid participant candidate search",
			);
			return { candidates: await searchParticipantCandidates(input.search) };
		},
	);

	server.put(
		"/education/participants/:userId",
		{ preHandler: [authenticate, requireEducationalCourseAdministrator] },
		async (request) => {
			const { userId } = parseInput(
				userParamsSchema,
				request.params,
				"Invalid educational course participant",
			);
			parseInput(
				emptyBodySchema,
				request.body,
				"Participant assignment does not accept a payload",
			);
			const member = ensureAssignableMember(await loadMember(userId));
			if (member.educational_course_role === "administrator") {
				throw new ConflictError(
					"Global administrators must remove the educational course administrator role first",
				);
			}
			return participantFromMember(
				await setMemberEducationRole(userId, "participant"),
			);
		},
	);

	server.delete(
		"/education/participants/:userId",
		{ preHandler: [authenticate, requireEducationalCourseAdministrator] },
		async (request, reply) => {
			const { userId } = parseInput(
				userParamsSchema,
				request.params,
				"Invalid educational course participant",
			);
			parseInput(
				emptyBodySchema,
				request.body,
				"Participant removal does not accept a payload",
			);
			const member = await loadMember(userId);
			if (member?.educational_course_role !== "participant") {
				throw new NotFoundError("Educational course participant not found");
			}
			await setMemberEducationRole(userId, null);
			return reply.status(204).send();
		},
	);

	server.get(
		"/education/periods",
		{ preHandler: [authenticate, requireEducationalCourseAccess] },
		async (request) => {
			parseInput(
				emptyQuerySchema,
				request.query,
				"Invalid educational course periods query",
			);
			const user = (request as AuthenticatedRequest).user;
			const { data, error } = await getSupabase()
				.from("educational_course_periods")
				.select(
					"id, starts_on, ends_on, capacity, applications_open, created_at, updated_at",
				)
				// Chronological order, matching how the periods list renders them so
				// the default selection is the first card the user sees.
				.order("starts_on", { ascending: true });
			if (error) {
				throw new DatabaseError("Failed to load educational course periods");
			}
			const rows = (data ?? []) as PeriodRow[];
			const { applications, membersById } = await loadPeriodData(rows);
			return {
				periods: rows.map((period) =>
					periodFromRow(period, applications, membersById, user.id),
				),
			};
		},
	);

	server.post(
		"/education/periods",
		{ preHandler: [authenticate, requireEducationalCourseAdministrator] },
		async (request, reply) => {
			const input = parseInput(
				createEducationalCoursePeriodSchema,
				request.body,
				"Invalid educational course period",
			);
			if (input.startsOn <= getEducationalCourseDateOnly()) {
				throw new ValidationError(
					"Educational course periods must start in the future",
				);
			}
			const user = (request as AuthenticatedRequest).user;
			const { data, error } = await getSupabase()
				.from("educational_course_periods")
				.insert({
					starts_on: input.startsOn,
					ends_on: input.endsOn,
					capacity: input.capacity,
					applications_open: true,
					created_by: user.id,
				})
				.select(
					"id, starts_on, ends_on, capacity, applications_open, created_at, updated_at",
				)
				.single();
			if (error || !data) {
				if (databaseErrorCode(error) === "23P01") {
					throw new ConflictError("Educational course periods cannot overlap");
				}
				throw new DatabaseError("Failed to create educational course period");
			}
			return reply
				.status(201)
				.send(periodFromRow(data as PeriodRow, [], new Map(), user.id));
		},
	);

	server.get(
		"/education/periods/:periodId",
		{ preHandler: [authenticate, requireEducationalCourseAdministrator] },
		async (request) => {
			const { periodId } = parseInput(
				periodParamsSchema,
				request.params,
				"Invalid educational course period",
			);
			parseInput(
				emptyQuerySchema,
				request.query,
				"Invalid educational course period query",
			);
			const row = await loadPeriod(periodId);
			if (!row) {
				throw new NotFoundError("Educational course period not found");
			}
			const user = (request as AuthenticatedRequest).user;
			const { applications, membersById } = await loadPeriodData([row]);
			return {
				period: periodFromRow(row, applications, membersById, user.id),
				applications: applications.map((application) =>
					applicationFromRow(application, membersById),
				),
			};
		},
	);

	server.patch(
		"/education/periods/:periodId",
		{ preHandler: [authenticate, requireEducationalCourseAdministrator] },
		async (request) => {
			const { periodId } = parseInput(
				periodParamsSchema,
				request.params,
				"Invalid educational course period",
			);
			const input = parseInput(
				updateEducationalCoursePeriodSchema,
				request.body,
				"Invalid educational course period update",
			);
			const currentPeriod = await loadPeriod(periodId);
			if (!currentPeriod) {
				throw new NotFoundError("Educational course period not found");
			}
			if (
				input.applicationsOpen &&
				currentPeriod.starts_on <= getEducationalCourseDateOnly()
			) {
				throw new ConflictError(
					"Applications cannot be reopened after a course period has started",
				);
			}
			const { data, error } = await getSupabase()
				.from("educational_course_periods")
				.update({ applications_open: input.applicationsOpen })
				.eq("id", periodId)
				.select(
					"id, starts_on, ends_on, capacity, applications_open, created_at, updated_at",
				)
				.maybeSingle();
			if (error) {
				throw new DatabaseError("Failed to update educational course period");
			}
			if (!data) {
				throw new NotFoundError("Educational course period not found");
			}
			const user = (request as AuthenticatedRequest).user;
			const row = data as PeriodRow;
			const { applications, membersById } = await loadPeriodData([row]);
			return periodFromRow(row, applications, membersById, user.id);
		},
	);

	server.delete(
		"/education/periods/:periodId",
		{ preHandler: [authenticate, requireEducationalCourseAdministrator] },
		async (request, reply) => {
			const { periodId } = parseInput(
				periodParamsSchema,
				request.params,
				"Invalid educational course period",
			);
			parseInput(
				emptyBodySchema,
				request.body,
				"Period removal does not accept a payload",
			);
			if (!(await loadPeriod(periodId))) {
				throw new NotFoundError("Educational course period not found");
			}
			const applications = await loadApplications([periodId]);
			if (applications.length > 0) {
				throw new ConflictError(
					"Educational course periods with applications cannot be deleted",
				);
			}
			const { error } = await getSupabase()
				.from("educational_course_periods")
				.delete()
				.eq("id", periodId);
			if (error) {
				if (databaseErrorCode(error) === "23503") {
					throw new ConflictError(
						"Educational course periods with applications cannot be deleted",
					);
				}
				throw new DatabaseError("Failed to delete educational course period");
			}
			return reply.status(204).send();
		},
	);

	server.post(
		"/education/periods/:periodId/applications",
		{ preHandler: [authenticate, requireEducationalCourseParticipant] },
		async (request, reply) => {
			const { periodId } = parseInput(
				periodParamsSchema,
				request.params,
				"Invalid educational course period",
			);
			parseInput(
				emptyBodySchema,
				request.body,
				"Educational course applications do not accept a payload",
			);
			const user = (request as AuthenticatedRequest).user;
			const { data, error } = await getSupabase()
				.rpc("apply_educational_course_period", {
					p_period_id: periodId,
					p_applicant_user_id: user.id,
				})
				.single();
			if (error) {
				switch (databaseErrorCode(error)) {
					case "23505":
						throw new ConflictError(
							"You have already applied for this educational course period",
						);
					case "P0002":
						throw new NotFoundError("Educational course period not found");
					case "42501":
						throw new ForbiddenError(
							"Educational course participant access required",
						);
					case "55000":
						throw new ConflictError(
							"Applications are closed for this educational course period",
						);
					default:
						throw new DatabaseError(
							"Failed to create educational course application",
						);
				}
			}
			if (!data) {
				throw new DatabaseError(
					"Failed to create educational course application",
				);
			}
			const member = await loadMember(user.id);
			const membersById = new Map<string, MemberRow>();
			if (member) membersById.set(member.user_id, member);
			return reply
				.status(201)
				.send(applicationFromRow(data as ApplicationRow, membersById));
		},
	);

	server.delete(
		"/education/periods/:periodId/applications/me",
		{ preHandler: [authenticate, requireEducationalCourseParticipant] },
		async (request, reply) => {
			const { periodId } = parseInput(
				periodParamsSchema,
				request.params,
				"Invalid educational course period",
			);
			parseInput(
				emptyBodySchema,
				request.body,
				"Application withdrawal does not accept a payload",
			);
			const user = (request as AuthenticatedRequest).user;
			const { data: existing, error: existingError } = await getSupabase()
				.from("educational_course_applications")
				.select("id, status")
				.eq("period_id", periodId)
				.eq("applicant_user_id", user.id)
				.maybeSingle();
			if (existingError) {
				throw new DatabaseError(
					"Failed to load educational course application",
				);
			}
			if (!existing) {
				throw new NotFoundError("Educational course application not found");
			}
			if ((existing as { status?: unknown }).status !== "pending") {
				throw new ConflictError(
					"Only pending educational course applications can be withdrawn",
				);
			}
			const { data: deleted, error } = await getSupabase()
				.from("educational_course_applications")
				.delete()
				.eq("period_id", periodId)
				.eq("applicant_user_id", user.id)
				.eq("status", "pending")
				.select("id")
				.maybeSingle();
			if (error) {
				throw new DatabaseError(
					"Failed to withdraw educational course application",
				);
			}
			if (!deleted) {
				throw new ConflictError(
					"Only pending educational course applications can be withdrawn",
				);
			}
			return reply.status(204).send();
		},
	);

	server.patch(
		"/education/applications/:applicationId",
		{ preHandler: [authenticate, requireEducationalCourseAdministrator] },
		async (request) => {
			const { applicationId } = parseInput(
				applicationParamsSchema,
				request.params,
				"Invalid educational course application",
			);
			const input = parseInput(
				reviewEducationalCourseApplicationSchema,
				request.body,
				"Invalid educational course application review",
			);
			const user = (request as AuthenticatedRequest).user;
			const { data, error } = await getSupabase()
				.rpc("review_educational_course_application", {
					p_application_id: applicationId,
					p_status: input.decision,
					p_reviewer_user_id: user.id,
				})
				.single();
			if (error) {
				switch (databaseErrorCode(error)) {
					case "23514":
						throw new ConflictError(
							"Educational course period capacity has been reached",
						);
					case "P0002":
						throw new NotFoundError("Educational course application not found");
					case "42501":
						throw new ForbiddenError(
							"Educational course administrator access required",
						);
					case "55000":
						throw new ConflictError(
							"The applicant is no longer an active educational course participant",
						);
					case "22023":
						throw new ValidationError(
							"Invalid educational course application decision",
						);
					default:
						throw new DatabaseError(
							"Failed to review educational course application",
						);
				}
			}
			if (!data) {
				throw new NotFoundError("Educational course application not found");
			}
			const application = data as ApplicationRow;
			const membersById = await loadMembersById([
				application.applicant_user_id,
			]);
			return applicationFromRow(application, membersById);
		},
	);
}
