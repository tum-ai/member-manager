import { isActiveMember } from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthProfiles } from "../lib/authEmails.js";
import { DatabaseError } from "../lib/errors.js";
import { getSupabase } from "../lib/supabase.js";
import { sendPendingTumaiDayMessages } from "../lib/tumaiDaysScheduler.js";
import {
	authenticate,
	requireCronOrTumaiDaysManager,
	requireTumaiDaysManager,
} from "../middleware/auth.js";

const CreateEventSchema = z.object({
	agenda: z.string().min(1),
	scheduledAt: z.string().datetime(),
});

const UpdateEventSchema = z.object({
	agenda: z.string().min(1).optional(),
	scheduledAt: z.string().datetime().optional(),
});

export async function tumaiDaysRoutes(server: FastifyInstance) {
	// List all TUM.ai Days
	server.get(
		"/tum-ai-days",
		{ preHandler: [authenticate, requireTumaiDaysManager] },
		async (request) => {
			try {
				const { data, error } = await getSupabase()
					.from("tumai_days")
					.select("*")
					.order("scheduled_at", { ascending: false });

				if (error) throw error;
				return { events: data };
			} catch (error) {
				request.log.error(error, "Failed to fetch TUM.ai Days");
				throw new DatabaseError();
			}
		},
	);

	// Create/Schedule a new TUM.ai Day
	server.post(
		"/tum-ai-days",
		{ preHandler: [authenticate, requireTumaiDaysManager] },
		async (request, reply) => {
			const parsed = CreateEventSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid payload",
					details: parsed.error.flatten(),
				});
			}

			try {
				const { data, error } = await getSupabase()
					.from("tumai_days")
					.insert({
						agenda: parsed.data.agenda,
						scheduled_at: parsed.data.scheduledAt,
					})
					.select()
					.single();

				if (error) throw error;
				return reply.status(201).send(data);
			} catch (error) {
				request.log.error(error, "Failed to create TUM.ai Day");
				throw new DatabaseError();
			}
		},
	);

	// Update/Reschedule a TUM.ai Day
	server.put(
		"/tum-ai-days/:id",
		{ preHandler: [authenticate, requireTumaiDaysManager] },
		async (request, reply) => {
			const { id } = request.params as { id: string };
			const parsed = UpdateEventSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid payload",
					details: parsed.error.flatten(),
				});
			}

			try {
				const updates: Record<string, unknown> = {};
				if (parsed.data.agenda !== undefined)
					updates.agenda = parsed.data.agenda;
				if (parsed.data.scheduledAt !== undefined)
					updates.scheduled_at = parsed.data.scheduledAt;

				// If scheduledAt is modified, we allow resetting sent_at to null so it can be re-sent if they reschedule
				if (parsed.data.scheduledAt !== undefined) {
					updates.sent_at = null;
				}

				const { data, error } = await getSupabase()
					.from("tumai_days")
					.update(updates)
					.eq("id", id)
					.select()
					.single();

				if (error) throw error;
				return data;
			} catch (error) {
				request.log.error(
					{ err: error, tumaiDayId: id },
					"Failed to update TUM.ai Day",
				);
				throw new DatabaseError();
			}
		},
	);

	// Delete a TUM.ai Day
	server.delete(
		"/tum-ai-days/:id",
		{ preHandler: [authenticate, requireTumaiDaysManager] },
		async (request, reply) => {
			const { id } = request.params as { id: string };
			try {
				const { error } = await getSupabase()
					.from("tumai_days")
					.delete()
					.eq("id", id);

				if (error) throw error;
				return reply.status(204).send();
			} catch (error) {
				request.log.error(
					{ err: error, tumaiDayId: id },
					"Failed to delete TUM.ai Day",
				);
				throw new DatabaseError();
			}
		},
	);

	// Audit RSVP responses for a specific event
	server.get(
		"/tum-ai-days/:id/responses",
		{ preHandler: [authenticate, requireTumaiDaysManager] },
		async (request) => {
			const { id } = request.params as { id: string };
			try {
				// 1. Fetch event metadata
				const { data: event, error: eventError } = await getSupabase()
					.from("tumai_days")
					.select("*")
					.eq("id", id)
					.single();

				if (eventError) throw eventError;

				// 2. Fetch all members
				const { data: members, error: membersError } = await getSupabase()
					.from("members")
					.select(
						"user_id, given_name, surname, active, member_status, department",
					);

				if (membersError) throw membersError;

				// Filter to only active members (matching Victor's requirement of "active member list")
				const activeMembers = (members ?? []).filter(isActiveMember);
				const activeUserIds = activeMembers.map((m) => m.user_id);

				// 3. Fetch all RSVP responses
				const { data: responses, error: responsesError } = await getSupabase()
					.from("tumai_day_responses")
					.select("*")
					.eq("tumai_day_id", id);

				if (responsesError) throw responsesError;

				const responseMap = new Map<string, (typeof responses)[number]>();
				for (const res of responses ?? []) {
					responseMap.set(res.user_id, res);
				}

				// 4. Fetch user email/auth profiles
				const authProfiles = await getAuthProfiles(activeUserIds);

				// 5. Combine data
				const auditList = activeMembers.map((m) => {
					const response = responseMap.get(m.user_id);
					const profile = authProfiles.get(m.user_id);
					return {
						userId: m.user_id,
						givenName: m.given_name || profile?.given_name || "",
						surname: m.surname || profile?.surname || "",
						email: profile?.email || "",
						department: m.department || "",
						status: response ? response.status : "pending",
						reason: response ? response.reason : null,
						votedAt: response ? response.updated_at : null,
					};
				});

				// Calculate statistics
				const stats = {
					yes: auditList.filter((a) => a.status === "yes").length,
					no: auditList.filter((a) => a.status === "no").length,
					pending: auditList.filter((a) => a.status === "pending").length,
					total: auditList.length,
				};

				return { event, stats, responses: auditList };
			} catch (error) {
				request.log.error(
					{ err: error, tumaiDayId: id },
					"Failed to load responses for TUM.ai Day",
				);
				throw new DatabaseError();
			}
		},
	);

	// Manual trigger or Vercel Cron trigger to send pending messages (also returns how many were sent).
	// Vercel Cron invokes the path with a GET request, so the route must accept both methods.
	server.route({
		method: ["GET", "POST"],
		url: "/tum-ai-days/send-pending",
		config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
		preHandler: [requireCronOrTumaiDaysManager],
		handler: async (request) => {
			try {
				const sentCount = await sendPendingTumaiDayMessages(request.log);
				return { status: "success", sentCount };
			} catch (error) {
				request.log.error(error, "Failed to run manual send-pending trigger");
				throw new DatabaseError();
			}
		},
	});
}
