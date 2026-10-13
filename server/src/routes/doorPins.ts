import {
	type DoorPinImportResult,
	doorPinImportRequestSchema,
	type MemberDoorPin,
	setDoorPinSchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ensureOwnerOrAdmin } from "../lib/auth.js";
import { getAuthProfiles, listAuthUserIdsByEmail } from "../lib/authEmails.js";
import {
	deleteDoorPin,
	findPinHolder,
	planDoorPinImport,
	readAllDoorPins,
	readDoorPin,
	readDoorPinMembers,
	toAvailableDoorPin,
	writeDoorPins,
} from "../lib/doorPins.js";
import {
	ConflictError,
	DatabaseError,
	NotFoundError,
	ValidationError,
} from "../lib/errors.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const userParamsSchema = z.object({
	userId: z.string().trim().min(1),
});

const NOT_ASSIGNED: MemberDoorPin = { status: "not_assigned" };
const WELCOME_REQUIRED: MemberDoorPin = { status: "welcome_required" };

/** Whether the member has saved a decision on /welcome. */
async function hasCompletedWelcome(userId: string): Promise<boolean> {
	const { data, error } = await getSupabase()
		.from("member_agreements")
		.select("consents_decided_at")
		.eq("user_id", userId)
		.maybeSingle();
	if (error) throw new DatabaseError();
	return Boolean(
		(data as { consents_decided_at?: unknown } | null)?.consents_decided_at,
	);
}

async function assertMemberExists(userId: string): Promise<void> {
	const { data, error } = await getSupabase()
		.from("members")
		.select("user_id")
		.eq("user_id", userId)
		.maybeSingle();
	if (error) throw new DatabaseError();
	if (!data) throw new NotFoundError("Member not found");
}

/**
 * Door PINs for the office key cabinet (see `lib/doorPins.ts`).
 *
 * - Members read their own PIN once they have saved a decision on /welcome.
 * - Admins read, set and clear any member's PIN, and import the cabinet's user
 *   sheet.
 *
 * Every response is `private, no-store`: a PIN must never come back from a
 * shared or browser cache.
 */
export async function doorPinRoutes(server: FastifyInstance) {
	server.addHook("onSend", async (_request, reply, payload) => {
		reply.header("Cache-Control", "private, no-store");
		return payload;
	});

	server.get<{ Params: { userId: string } }>(
		"/members/:userId/door-pin",
		{ preHandler: authenticate },
		async (request): Promise<MemberDoorPin> => {
			const { userId } = userParamsSchema.parse(request.params);
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only view your own door PIN",
			);

			// Members get their PIN as part of finishing /welcome. Admins looking
			// at someone else's PIN (support, a forgotten PIN) are not gated.
			if (user.id === userId && !(await hasCompletedWelcome(userId))) {
				return WELCOME_REQUIRED;
			}

			const stored = await readDoorPin(userId, request.log);
			if (stored && user.id !== userId) {
				request.log.info(
					{ userId, adminId: user.id },
					"Admin viewed a member's door PIN",
				);
			}
			return stored ? toAvailableDoorPin(stored) : NOT_ASSIGNED;
		},
	);

	server.put<{ Params: { userId: string } }>(
		"/admin/members/:userId/door-pin",
		{ preHandler: [authenticate, requireAdmin] },
		async (request): Promise<MemberDoorPin> => {
			const { userId } = userParamsSchema.parse(request.params);
			const admin = (request as AuthenticatedRequest).user;
			const body = setDoorPinSchema.safeParse(request.body);
			if (!body.success) {
				throw new ValidationError(
					body.error.issues[0]?.message ?? "Invalid door PIN",
				);
			}

			await assertMemberExists(userId);
			const pins = await readAllDoorPins(request.log);
			if (findPinHolder(pins, body.data.pin, userId)) {
				throw new ConflictError("Another member already has this door PIN");
			}

			const [stored] = await writeDoorPins(
				[{ user_id: userId, pin: body.data.pin }],
				admin.id,
			);
			request.log.info(
				{ userId, adminId: admin.id },
				"Admin set a member's door PIN",
			);
			return toAvailableDoorPin(stored);
		},
	);

	server.delete<{ Params: { userId: string } }>(
		"/admin/members/:userId/door-pin",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const { userId } = userParamsSchema.parse(request.params);
			const admin = (request as AuthenticatedRequest).user;
			await deleteDoorPin(userId);
			request.log.info(
				{ userId, adminId: admin.id },
				"Admin cleared a member's door PIN",
			);
			return reply.status(204).send();
		},
	);

	server.post(
		"/admin/door-pins/import",
		{ preHandler: [authenticate, requireAdmin] },
		async (request): Promise<DoorPinImportResult> => {
			const admin = (request as AuthenticatedRequest).user;
			const body = doorPinImportRequestSchema.parse(request.body);

			const [userIdsByEmail, members, existingPins] = await Promise.all([
				listAuthUserIdsByEmail(),
				readDoorPinMembers(),
				readAllDoorPins(request.log),
			]);
			// listAuthUserIdsByEmail just refreshed the auth cache, so this is
			// served from memory.
			const profiles = await getAuthProfiles(
				members.map((member) => member.user_id),
			);
			const emailsByUserId = new Map(
				[...profiles].map(([userId, profile]) => [userId, profile.email]),
			);

			const plan = planDoorPinImport({
				rows: body.rows,
				userIdsByEmail,
				members,
				existingPins,
				emailsByUserId,
			});

			if (!body.dry_run) {
				await writeDoorPins(plan.writes, admin.id);
				request.log.info(
					{
						adminId: admin.id,
						rows: plan.result.total,
						created: plan.result.created,
						updated: plan.result.updated,
					},
					"Admin imported door PINs",
				);
			}

			return { dry_run: body.dry_run, ...plan.result };
		},
	);
}
