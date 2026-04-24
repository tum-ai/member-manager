import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DatabaseError } from "../lib/errors.js";
import { notifyAdminsOfCertificateRequest } from "../lib/slackNotifier.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
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

const EngagementEntrySchema = z
	.object({
		id: z.string().min(1),
		startDate: z.string().refine(isValidDate, "Invalid start date"),
		endDate: z
			.string()
			.optional()
			.refine(
				(value) => value === undefined || value === "" || isValidDate(value),
				{
					message: "Invalid end date",
				},
			),
		isStillActive: z.boolean(),
		weeklyHours: z.string().min(1),
		department: z.string().min(1),
		isTeamLead: z.boolean(),
		tasksDescription: z.string().trim().min(1).max(1000),
	})
	.refine(
		(entry) => {
			if (entry.isStillActive) {
				return true;
			}

			const endDate = entry.endDate;
			return (
				typeof endDate === "string" &&
				endDate !== "" &&
				endDate >= entry.startDate
			);
		},
		{
			message: "End date must be on or after start date",
			path: ["endDate"],
		},
	);

const CreateCertificateRequestSchema = z.object({
	engagements: z.array(EngagementEntrySchema).min(1).max(5),
});

const ReviewCertificateRequestSchema = z.object({
	decision: z.enum(["approved", "rejected"]),
	review_note: z.string().trim().min(1).max(500).optional(),
});

type StoredCertificateRequest = {
	id: string;
	user_id: string;
	status: string;
};

function buildAdminReviewUrl(requestId: string): string | undefined {
	const baseUrl = process.env.APP_BASE_URL?.trim();
	if (!baseUrl) {
		return undefined;
	}

	return `${baseUrl.replace(/\/$/, "")}/admin?engagementCertificateRequest=${requestId}`;
}

export async function engagementCertificateRoutes(server: FastifyInstance) {
	server.post(
		"/engagement-certificates",
		{ preHandler: authenticate },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const parsed = CreateCertificateRequestSchema.parse(request.body);

			const { data: member, error: memberError } = await getSupabase()
				.from("members")
				.select("given_name, surname, member_status, active")
				.eq("user_id", user.id)
				.single();

			if (memberError) {
				request.log.error(
					{ err: memberError },
					"Failed to fetch member for certificate request",
				);
				throw new DatabaseError();
			}

			const memberStatus = String(
				(member as { member_status?: string; active?: boolean })
					.member_status ??
					((member as { active?: boolean }).active ? "active" : "inactive"),
			);
			if (memberStatus !== "active") {
				return reply.status(403).send({
					error: "Only active members can request engagement certificates",
				});
			}

			const { data, error } = await getSupabase()
				.from("engagement_certificate_requests")
				.insert({
					user_id: user.id,
					status: "pending",
					engagements: parsed.engagements,
				})
				.select()
				.single();

			if (error) {
				request.log.error(
					{ err: error },
					"Failed to create engagement certificate request",
				);
				throw new DatabaseError();
			}

			const memberName = [
				String((member as { given_name?: string }).given_name ?? "").trim(),
				String((member as { surname?: string }).surname ?? "").trim(),
			]
				.filter(Boolean)
				.join(" ");

			try {
				await notifyAdminsOfCertificateRequest({
					requestId: String((data as { id?: string }).id ?? ""),
					requesterUserId: user.id,
					requesterEmail: user.email ?? "",
					requesterName: memberName,
					adminReviewUrl: buildAdminReviewUrl(
						String((data as { id?: string }).id ?? ""),
					),
				});
			} catch (notificationError) {
				request.log.warn(
					{ err: notificationError, userId: user.id },
					"Failed to notify admins about engagement certificate request",
				);
			}

			return reply.status(201).send(data);
		},
	);

	server.get(
		"/engagement-certificates",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const user = (request as AuthenticatedRequest).user;
			const { data, error } = await getSupabase()
				.from("engagement_certificate_requests")
				.select("*")
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			if (error) {
				request.log.error(
					{ err: error },
					"Failed to list engagement certificate requests",
				);
				throw new DatabaseError();
			}

			return data ?? [];
		},
	);

	server.get(
		"/admin/engagement-certificate-requests",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, _reply) => {
			const { data, error } = await getSupabase()
				.from("engagement_certificate_requests")
				.select("*")
				.order("created_at", { ascending: false });

			if (error) {
				request.log.error(
					{ err: error },
					"Failed to list admin engagement certificate requests",
				);
				throw new DatabaseError();
			}

			return data ?? [];
		},
	);

	server.patch<{ Params: { requestId: string } }>(
		"/admin/engagement-certificate-requests/:requestId",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const { requestId } = request.params;
			const review = ReviewCertificateRequestSchema.parse(request.body);

			const { data: requestRow, error: fetchError } = await getSupabase()
				.from("engagement_certificate_requests")
				.select("*")
				.eq("id", requestId)
				.single();

			if (fetchError) {
				if (fetchError.code === "PGRST116") {
					return reply
						.status(404)
						.send({ error: "Engagement certificate request not found" });
				}
				request.log.error(
					{ err: fetchError },
					"Failed to fetch engagement certificate request",
				);
				throw new DatabaseError();
			}

			const certificateRequest = requestRow as StoredCertificateRequest;
			if (certificateRequest.status !== "pending") {
				return reply
					.status(409)
					.send({ error: "Engagement certificate request already reviewed" });
			}

			const { data, error } = await getSupabase()
				.from("engagement_certificate_requests")
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
				request.log.error(
					{ err: error },
					"Failed to update engagement certificate request",
				);
				throw new DatabaseError();
			}

			return data;
		},
	);
}
