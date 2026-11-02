import {
	type McpAccessEntry,
	mcpAccessDecisionSchema,
	type OwnMcpAccess,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ValidationError } from "../lib/errors.js";
import {
	decideMcpAccess,
	listMcpAccess,
	readOwnMcpAccess,
} from "../lib/mcpAccess.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const userParamsSchema = z.object({
	userId: z.string().trim().min(1),
});

/**
 * nomcp (TUM.ai Notion MCP) access approval (`lib/mcpAccess.ts`).
 *
 * - Admins list every request and approve (as reader or editor), change the
 *   role, deny or revoke.
 * - Members read their own status for /connected-apps.
 *
 * nomcp reads the decision through `public.mcp_principal()` on each new
 * token, and caches it for about a minute.
 */
export async function mcpAccessRoutes(server: FastifyInstance) {
	server.get(
		"/admin/mcp-access",
		{ preHandler: [authenticate, requireAdmin] },
		async (): Promise<McpAccessEntry[]> => listMcpAccess(),
	);

	server.patch<{ Params: { userId: string } }>(
		"/admin/mcp-access/:userId",
		{ preHandler: [authenticate, requireAdmin] },
		async (request): Promise<McpAccessEntry> => {
			const params = userParamsSchema.safeParse(request.params);
			if (!params.success) {
				throw new ValidationError("Invalid member id");
			}
			const body = mcpAccessDecisionSchema.safeParse(request.body);
			if (!body.success) {
				throw new ValidationError(
					body.error.issues[0]?.message ?? "Invalid decision",
				);
			}
			const admin = (request as AuthenticatedRequest).user;
			const entry = await decideMcpAccess(
				params.data.userId,
				body.data,
				admin.id,
			);
			request.log.info(
				{
					userId: params.data.userId,
					adminId: admin.id,
					action: body.data.action,
					status: entry.status,
					role: entry.role,
				},
				"Admin decided nomcp access",
			);
			return entry;
		},
	);

	server.get(
		"/mcp-access/me",
		{ preHandler: authenticate },
		async (request): Promise<OwnMcpAccess> =>
			readOwnMcpAccess((request as AuthenticatedRequest).user.id),
	);
}
