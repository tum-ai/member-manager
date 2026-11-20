import { profileUpdateSchema } from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { checkAdminRole, ensureOwnerOrAdmin } from "../lib/auth.js";
import { DatabaseError } from "../lib/errors.js";
import { loadProfile, saveProfile } from "../lib/profile/profileService.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

/**
 * The profile page's contract: one read model and one atomic, versioned write
 * for the member row, bank details and agreements. Rules live in
 * `lib/profile/`; this plugin only authenticates, validates and delegates.
 */
export async function profileRoutes(server: FastifyInstance) {
	server.get<{ Params: { userId: string } }>(
		"/profile/:userId",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;

			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only view your own profile",
			);

			return loadProfile(userId, request.log);
		},
	);

	server.put<{ Params: { userId: string } }>(
		"/profile/:userId",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;

			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only update your own profile",
			);

			const update = profileUpdateSchema.parse(request.body);

			let isAdmin: boolean;
			try {
				isAdmin = await checkAdminRole(user.id);
			} catch (error) {
				request.log.error(
					{ err: error, userId: user.id },
					"Failed to determine admin role for profile update",
				);
				throw new DatabaseError();
			}

			return saveProfile({ userId, isAdmin, update }, request.log);
		},
	);
}
