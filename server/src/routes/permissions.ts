import {
	isActiveMember,
	isPermission,
	PERMISSIONS,
	type Permission,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { checkAdminRole } from "../lib/auth.js";
import {
	fetchDepartmentPermissionMap,
	fetchDepartmentPermissions,
	setDepartmentPermissions,
} from "../lib/departmentPermissions.js";
import { DatabaseError } from "../lib/errors.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const permissionSchema = z.custom<Permission>(isPermission, {
	message: "Unknown permission",
});

const UpdateDepartmentPermissionsSchema = z.object({
	assignments: z.record(z.string().min(1), z.array(permissionSchema)),
});

export async function permissionRoutes(server: FastifyInstance) {
	// The current user's effective tool permissions. Admins inherit everything;
	// other members inherit their active department's permissions. The client
	// gates tool visibility and route access off this list.
	server.get(
		"/me/tool-access",
		{ preHandler: [authenticate] },
		async (request) => {
			const user = (request as AuthenticatedRequest).user;

			try {
				if (await checkAdminRole(user.id)) {
					return { permissions: [...PERMISSIONS] };
				}

				const { data, error } = await getSupabase()
					.from("members")
					.select("department, member_status, active")
					.eq("user_id", user.id)
					.maybeSingle();

				if (error) {
					throw error;
				}

				const member = data as {
					department?: string | null;
					member_status?: string | null;
					active?: boolean | null;
				} | null;

				if (!member || !isActiveMember(member) || !member.department) {
					return { permissions: [] as Permission[] };
				}

				const permissions = await fetchDepartmentPermissions(member.department);
				return { permissions };
			} catch (error) {
				request.log.error(
					{ err: error, userId: user.id },
					"Failed to load tool access",
				);
				throw new DatabaseError();
			}
		},
	);

	server.get(
		"/admin/department-permissions",
		{ preHandler: [authenticate, requireAdmin] },
		async (request) => {
			try {
				const assignments = await fetchDepartmentPermissionMap();
				return { assignments };
			} catch (error) {
				request.log.error(
					{ err: error },
					"Failed to load department permissions",
				);
				throw new DatabaseError();
			}
		},
	);

	server.put(
		"/admin/department-permissions",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const parsed = UpdateDepartmentPermissionsSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid department permissions payload",
					details: parsed.error.flatten(),
				});
			}

			const user = (request as AuthenticatedRequest).user;

			try {
				const assignments = await setDepartmentPermissions(
					parsed.data.assignments,
					user.id,
				);
				return { assignments };
			} catch (error) {
				request.log.error(
					{ err: error, userId: user.id },
					"Failed to update department permissions",
				);
				throw new DatabaseError();
			}
		},
	);
}
