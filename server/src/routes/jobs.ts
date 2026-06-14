import { isActiveMember } from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DatabaseError, ForbiddenError } from "../lib/errors.js";
import { fetchWithTimeout } from "../lib/fetchWithTimeout.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const PUBLIC_JOB_TYPES = [
	"internship",
	"working_student",
	"full_time",
	"thesis",
	"other",
] as const;

const PublicJobsQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(200).optional(),
	cursor: z.string().trim().min(1).optional(),
	since: z.string().datetime({ offset: true }).optional(),
	job_type: z.enum(PUBLIC_JOB_TYPES).optional(),
});

const PublicJobSchema = z.object({
	id: z.string(),
	title: z.string(),
	partner: z.object({
		name: z.string(),
		logo_url: z.string().nullable(),
	}),
	logo_url: z.string().nullable(),
	description_markdown: z.string(),
	call_to_action: z.string(),
	job_type: z.enum(PUBLIC_JOB_TYPES),
	location: z.string(),
	contact: z.object({
		name: z.string(),
		email: z.string(),
		role: z.string().nullable(),
	}),
	external_url: z.string().nullable(),
	published_at: z.string(),
	expires_at: z.string().nullable(),
});

const PublicJobsResponseSchema = z.object({
	data: z.array(PublicJobSchema),
	next_cursor: z.string().nullable(),
});

function isHttpUrl(value: string): boolean {
	if (!URL.canParse(value)) return false;
	const url = new URL(value);
	return url.protocol === "https:" || url.protocol === "http:";
}

const OptionalUrlSchema = z
	.string()
	.trim()
	.optional()
	.nullable()
	.transform((value) => value || null)
	.refine((value) => value === null || isHttpUrl(value), {
		message: "Must be a valid HTTP or HTTPS URL",
	});

const OptionalTextSchema = z
	.string()
	.trim()
	.max(140)
	.optional()
	.nullable()
	.transform((value) => value || null);

const OptionalExpiresAtSchema = z
	.string()
	.trim()
	.optional()
	.nullable()
	.transform((value, context) => {
		if (!value) return null;
		const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
			? `${value}T23:59:59.000Z`
			: value;
		const date = new Date(normalized);
		if (Number.isNaN(date.getTime())) {
			context.addIssue({
				code: "custom",
				message: "Must be a valid date",
			});
			return z.NEVER;
		}
		return date.toISOString();
	});

const CreateJobRequestSchema = z.object({
	title: z.string().trim().min(3).max(140),
	organization_name: z.string().trim().min(2).max(140),
	logo_url: OptionalUrlSchema,
	description_markdown: z.string().trim().min(20).max(5_000),
	call_to_action: z
		.string()
		.trim()
		.max(80)
		.optional()
		.nullable()
		.transform((value) => value || "Apply now"),
	job_type: z.enum(PUBLIC_JOB_TYPES),
	location: z.string().trim().min(2).max(140),
	contact_name: z.string().trim().min(2).max(140),
	contact_email: z.string().trim().email().max(254),
	contact_role: OptionalTextSchema,
	external_url: OptionalUrlSchema,
	expires_at: OptionalExpiresAtSchema,
});

const ReviewJobRequestSchema = z.object({
	decision: z.enum(["approved", "rejected"]),
	review_note: z.string().trim().min(1).max(500).optional(),
});

type PublicJob = z.infer<typeof PublicJobSchema>;
type PublicJobsResponse = z.infer<typeof PublicJobsResponseSchema>;
type PublicJobsQuery = z.infer<typeof PublicJobsQuerySchema>;

type JobPostingRequestRow = {
	id: string;
	user_id: string;
	status: "pending" | "approved" | "rejected";
	title: string;
	organization_name: string;
	logo_url: string | null;
	description_markdown: string;
	call_to_action: string | null;
	job_type: (typeof PUBLIC_JOB_TYPES)[number];
	location: string;
	contact_name: string;
	contact_email: string;
	contact_role: string | null;
	external_url: string | null;
	expires_at: string | null;
	published_at: string | null;
	created_at: string;
};

type JobsCursorState = {
	memberOffset: number;
	partnerCursor?: string;
	partnerSkip: number;
	partnerExhausted: boolean;
};

let hasLoggedPartnerConfigWarning = false;

const MEMBER_MANAGER_JOBS_CURSOR_PREFIX = "mm:";

function getPartnerPortalJobsApiConfig(): { url: URL; token: string } | null {
	const urlValue = process.env.PARTNER_PORTAL_JOBS_API_URL?.trim();
	const token = process.env.PARTNER_PORTAL_JOBS_API_TOKEN?.trim();
	if (!urlValue || !token) {
		return null;
	}

	const url = new URL(urlValue);
	if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
		return null;
	}

	return { url, token };
}

function warnOnceAboutPartnerConfig(
	request: AuthenticatedRequest,
	message: string,
): void {
	if (hasLoggedPartnerConfigWarning) return;
	hasLoggedPartnerConfigWarning = true;
	request.log.warn(message);
}

function isMissingJobPostingRequestsTable(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const code = "code" in error ? String(error.code) : "";
	const message = "message" in error ? String(error.message).toLowerCase() : "";
	return (
		code === "PGRST205" ||
		code === "42P01" ||
		message.includes("could not find the table") ||
		message.includes("could not find table") ||
		message.includes('relation "public.job_posting_requests" does not exist') ||
		message.includes('relation "job_posting_requests" does not exist')
	);
}

function decodeJobsCursor(cursor?: string): JobsCursorState {
	if (!cursor) {
		return { memberOffset: 0, partnerSkip: 0, partnerExhausted: false };
	}

	if (!cursor.startsWith(MEMBER_MANAGER_JOBS_CURSOR_PREFIX)) {
		return {
			memberOffset: Number.MAX_SAFE_INTEGER,
			partnerCursor: cursor,
			partnerSkip: 0,
			partnerExhausted: false,
		};
	}

	const cursorParts = cursor.split(":", 5);
	const [, offsetValue = "", skipValue = ""] = cursorParts;
	const exhaustedValue = cursorParts.length >= 5 ? cursorParts[3] : "0";
	const encodedPartnerCursor =
		cursorParts.length >= 5 ? cursorParts[4] : (cursorParts[3] ?? "");
	const parsedOffset = Number(offsetValue);
	const parsedSkip = Number(skipValue);
	let partnerCursor: string | undefined;
	try {
		partnerCursor = encodedPartnerCursor
			? decodeURIComponent(encodedPartnerCursor)
			: undefined;
	} catch {
		partnerCursor = undefined;
	}
	return {
		memberOffset:
			Number.isInteger(parsedOffset) && parsedOffset >= 0
				? parsedOffset
				: Number.MAX_SAFE_INTEGER,
		partnerSkip:
			Number.isInteger(parsedSkip) && parsedSkip >= 0 ? parsedSkip : 0,
		partnerCursor,
		partnerExhausted: exhaustedValue === "1",
	};
}

function encodeJobsCursor(
	memberOffset: number,
	partnerSkip: number,
	partnerExhausted: boolean,
	partnerCursor?: string | null,
): string {
	return `${MEMBER_MANAGER_JOBS_CURSOR_PREFIX}${memberOffset}:${partnerSkip}:${partnerExhausted ? "1" : "0"}:${encodeURIComponent(
		partnerCursor ?? "",
	)}`;
}

async function assertActiveMember(userId: string): Promise<void> {
	const { data, error } = await getSupabase()
		.from("members")
		.select("active, member_status")
		.eq("user_id", userId)
		.maybeSingle();

	if (error) {
		throw new DatabaseError();
	}

	if (
		!isActiveMember(
			data as { active?: boolean | null; member_status?: string | null } | null,
		)
	) {
		throw new ForbiddenError("Only active members can view job postings");
	}
}

function rowToPublicJob(row: JobPostingRequestRow): PublicJob {
	return {
		id: row.id,
		title: row.title,
		partner: {
			name: row.organization_name,
			logo_url: row.logo_url,
		},
		logo_url: row.logo_url,
		description_markdown: row.description_markdown,
		call_to_action: row.call_to_action?.trim() || "Apply now",
		job_type: row.job_type,
		location: row.location,
		contact: {
			name: row.contact_name,
			email: row.contact_email,
			role: row.contact_role,
		},
		external_url: row.external_url,
		published_at: row.published_at ?? row.created_at,
		expires_at: row.expires_at,
	};
}

function isUnexpiredJob(row: JobPostingRequestRow, now = Date.now()): boolean {
	if (!row.expires_at) return true;
	const expiresAt = new Date(row.expires_at).getTime();
	return Number.isNaN(expiresAt) || expiresAt >= now;
}

async function fetchApprovedMemberJobs(
	request: AuthenticatedRequest,
	query: PublicJobsQuery,
): Promise<PublicJob[]> {
	const { data, error } = await getSupabase()
		.from("job_posting_requests")
		.select("*")
		.eq("status", "approved")
		.order("published_at", { ascending: false });

	if (error) {
		if (isMissingJobPostingRequestsTable(error)) {
			request.log.warn(
				{ err: error },
				"Job posting requests table is not available; serving partner jobs only",
			);
			return [];
		}
		request.log.error({ err: error }, "Failed to fetch approved member jobs");
		throw new DatabaseError();
	}

	const sinceTime = query.since ? new Date(query.since).getTime() : null;

	return ((data ?? []) as JobPostingRequestRow[])
		.filter((row) => isUnexpiredJob(row))
		.filter((row) => !query.job_type || row.job_type === query.job_type)
		.filter((row) => {
			if (sinceTime === null) return true;
			const publishedAt = row.published_at ?? row.created_at;
			const publishedTime = new Date(publishedAt).getTime();
			return !Number.isNaN(publishedTime) && publishedTime >= sinceTime;
		})
		.map(rowToPublicJob);
}

async function fetchPartnerJobs(
	request: AuthenticatedRequest,
	query: PublicJobsQuery,
): Promise<PublicJobsResponse> {
	let config: { url: URL; token: string } | null = null;
	try {
		config = getPartnerPortalJobsApiConfig();
	} catch (error) {
		request.log.warn(
			{ err: error },
			"Partner Portal jobs API config is invalid; serving member jobs only",
		);
		return { data: [], next_cursor: null };
	}

	if (!config) {
		warnOnceAboutPartnerConfig(
			request,
			"Partner Portal jobs API is not configured; serving member jobs only",
		);
		return { data: [], next_cursor: null };
	}

	const upstreamUrl = new URL(config.url);
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined) {
			upstreamUrl.searchParams.set(key, String(value));
		}
	}

	try {
		const response = await fetchWithTimeout(upstreamUrl, {
			headers: {
				accept: "application/json",
				authorization: `Bearer ${config.token}`,
			},
		});

		if (!response.ok) {
			request.log.warn(
				{ status: response.status },
				"Partner Portal jobs API returned an error; serving member jobs only",
			);
			return { data: [], next_cursor: null };
		}

		return PublicJobsResponseSchema.parse(await response.json());
	} catch (error) {
		request.log.warn(
			{ err: error },
			"Failed to load partner job postings; serving member jobs only",
		);
		return { data: [], next_cursor: null };
	}
}

export async function jobRoutes(server: FastifyInstance) {
	server.get("/jobs", { preHandler: authenticate }, async (request, _reply) => {
		const user = (request as AuthenticatedRequest).user;
		await assertActiveMember(user.id);

		const parsedQuery = PublicJobsQuerySchema.parse(request.query);
		const authenticatedRequest = request as AuthenticatedRequest;
		const cursorState = decodeJobsCursor(parsedQuery.cursor);
		const memberJobs =
			cursorState.memberOffset === Number.MAX_SAFE_INTEGER
				? []
				: await fetchApprovedMemberJobs(authenticatedRequest, parsedQuery);
		const pageLimit = parsedQuery.limit;
		const partnerFetchLimit =
			pageLimit === undefined ? undefined : pageLimit + cursorState.partnerSkip;
		const partnerJobs = cursorState.partnerExhausted
			? { data: [], next_cursor: null }
			: await fetchPartnerJobs(authenticatedRequest, {
					...parsedQuery,
					cursor: cursorState.partnerCursor,
					limit: partnerFetchLimit ?? parsedQuery.limit,
				});
		const availablePartnerJobs = partnerJobs.data.slice(
			cursorState.partnerSkip,
		);
		const mergeCandidates = [
			...memberJobs.slice(cursorState.memberOffset).map((job) => ({
				source: "member" as const,
				job,
			})),
			...availablePartnerJobs.map((job) => ({
				source: "partner" as const,
				job,
			})),
		].sort(
			(left, right) =>
				new Date(right.job.published_at).getTime() -
				new Date(left.job.published_at).getTime(),
		);
		const pageCandidates =
			pageLimit === undefined
				? mergeCandidates
				: mergeCandidates.slice(0, pageLimit);
		const consumedMemberCount = pageCandidates.filter(
			(candidate) => candidate.source === "member",
		).length;
		const consumedPartnerCount = pageCandidates.filter(
			(candidate) => candidate.source === "partner",
		).length;
		const nextMemberOffset = cursorState.memberOffset + consumedMemberCount;
		const nextPartnerSkip = cursorState.partnerSkip + consumedPartnerCount;
		const hasMoreMemberJobs = nextMemberOffset < memberJobs.length;
		const hasUnconsumedPartnerJobs =
			availablePartnerJobs.length > consumedPartnerCount;
		const nextPartnerCursor = hasUnconsumedPartnerJobs
			? cursorState.partnerCursor
			: partnerJobs.next_cursor;
		const partnerExhausted =
			cursorState.partnerExhausted ||
			(!hasUnconsumedPartnerJobs && !partnerJobs.next_cursor);
		const encodedPartnerSkip =
			hasUnconsumedPartnerJobs && !partnerExhausted ? nextPartnerSkip : 0;
		const nextCursor =
			hasMoreMemberJobs ||
			(hasUnconsumedPartnerJobs && !partnerExhausted) ||
			nextPartnerCursor
				? encodeJobsCursor(
						nextMemberOffset,
						encodedPartnerSkip,
						partnerExhausted,
						nextPartnerCursor,
					)
				: null;

		return {
			data: pageCandidates.map((candidate) => candidate.job),
			next_cursor: nextCursor,
		};
	});

	server.get(
		"/jobs/requests",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const user = (request as AuthenticatedRequest).user;
			await assertActiveMember(user.id);

			const { data, error } = await getSupabase()
				.from("job_posting_requests")
				.select("*")
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			if (error) {
				if (isMissingJobPostingRequestsTable(error)) {
					request.log.warn(
						{ err: error },
						"Job posting requests table is not available; returning empty job request list",
					);
					return [];
				}
				request.log.error({ err: error }, "Failed to list job requests");
				throw new DatabaseError();
			}

			return data ?? [];
		},
	);

	server.post(
		"/jobs/requests",
		{ preHandler: authenticate },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			await assertActiveMember(user.id);
			const parsed = CreateJobRequestSchema.parse(request.body);

			const { data, error } = await getSupabase()
				.from("job_posting_requests")
				.insert({
					user_id: user.id,
					status: "pending",
					...parsed,
				})
				.select()
				.single();

			if (error) {
				if (isMissingJobPostingRequestsTable(error)) {
					return reply
						.status(503)
						.send({ error: "Job submissions are not available yet" });
				}
				request.log.error({ err: error }, "Failed to create job request");
				throw new DatabaseError();
			}

			return reply.status(201).send(data);
		},
	);

	server.get(
		"/admin/job-requests",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, _reply) => {
			const { data, error } = await getSupabase()
				.from("job_posting_requests")
				.select("*")
				.order("created_at", { ascending: false });

			if (error) {
				if (isMissingJobPostingRequestsTable(error)) {
					request.log.warn(
						{ err: error },
						"Job posting requests table is not available; returning empty admin job request list",
					);
					return [];
				}
				request.log.error({ err: error }, "Failed to list admin job requests");
				throw new DatabaseError();
			}

			return data ?? [];
		},
	);

	server.patch<{ Params: { requestId: string } }>(
		"/admin/job-requests/:requestId",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const { requestId } = request.params;
			const review = ReviewJobRequestSchema.parse(request.body);

			const { data: requestRow, error: fetchError } = await getSupabase()
				.from("job_posting_requests")
				.select("*")
				.eq("id", requestId)
				.single();

			if (fetchError) {
				if (
					typeof fetchError === "object" &&
					fetchError !== null &&
					"code" in fetchError &&
					fetchError.code === "PGRST116"
				) {
					return reply.status(404).send({ error: "Job request not found" });
				}
				request.log.error({ err: fetchError }, "Failed to fetch job request");
				throw new DatabaseError();
			}

			if ((requestRow as JobPostingRequestRow).status !== "pending") {
				return reply
					.status(409)
					.send({ error: "Job request already reviewed" });
			}

			const reviewedAt = new Date().toISOString();
			const { data, error } = await getSupabase()
				.from("job_posting_requests")
				.update({
					status: review.decision,
					review_note: review.review_note ?? null,
					reviewed_by: user.id,
					reviewed_at: reviewedAt,
					published_at: review.decision === "approved" ? reviewedAt : null,
				})
				.eq("id", requestId)
				.eq("status", "pending")
				.select()
				.single();

			if (error) {
				if (
					typeof error === "object" &&
					error !== null &&
					"code" in error &&
					error.code === "PGRST116"
				) {
					return reply
						.status(409)
						.send({ error: "Job request already reviewed" });
				}
				request.log.error({ err: error }, "Failed to update job request");
				throw new DatabaseError();
			}

			return data;
		},
	);
}
