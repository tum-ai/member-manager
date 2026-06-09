import { isActiveMember } from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DatabaseError, ForbiddenError } from "../lib/errors.js";
import { fetchWithTimeout } from "../lib/fetchWithTimeout.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
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

function getPartnerPortalJobsApiUrl(): string {
	const value = process.env.PARTNER_PORTAL_JOBS_API_URL?.trim();
	if (!value) {
		throw new Error("PARTNER_PORTAL_JOBS_API_URL is not configured");
	}

	const url = new URL(value);
	if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
		throw new Error("PARTNER_PORTAL_JOBS_API_URL must use HTTPS in production");
	}

	return url.toString();
}

function getPartnerPortalJobsApiToken(): string {
	const value = process.env.PARTNER_PORTAL_JOBS_API_TOKEN?.trim();
	if (!value) {
		throw new Error("PARTNER_PORTAL_JOBS_API_TOKEN is not configured");
	}
	return value;
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

export async function jobRoutes(server: FastifyInstance) {
	server.get("/jobs", { preHandler: authenticate }, async (request, _reply) => {
		const user = (request as AuthenticatedRequest).user;
		await assertActiveMember(user.id);

		const parsedQuery = PublicJobsQuerySchema.parse(request.query);
		const upstreamUrl = new URL(getPartnerPortalJobsApiUrl());
		for (const [key, value] of Object.entries(parsedQuery)) {
			if (value !== undefined) {
				upstreamUrl.searchParams.set(key, String(value));
			}
		}

		try {
			const response = await fetchWithTimeout(upstreamUrl, {
				headers: {
					accept: "application/json",
					authorization: `Bearer ${getPartnerPortalJobsApiToken()}`,
				},
			});

			if (!response.ok) {
				request.log.error(
					{ status: response.status },
					"Partner Portal jobs API returned an error",
				);
				throw new DatabaseError();
			}

			return PublicJobsResponseSchema.parse(await response.json());
		} catch (error) {
			if (error instanceof DatabaseError) {
				throw error;
			}
			request.log.error({ err: error }, "Failed to load partner job postings");
			throw new DatabaseError();
		}
	});
}
