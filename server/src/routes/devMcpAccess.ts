import {
	type DevMcpAccessEntry,
	type DevMcpCatalog,
	devMcpAccessActionSchema,
	devMcpAccessRequestBodySchema,
	type OwnDevMcpAccess,
	slackUserIdSchema,
} from "@member-manager/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { hasBearerToken } from "../lib/constantTimeEquals.js";
import {
	changeDevMcpAccess,
	listDevMcpAccess,
	readDevMcpAccessRecord,
	readOwnDevMcpAccess,
	requestDevMcpAccess,
} from "../lib/devMcpAccess.js";
import {
	getDevMcpCatalog,
	getDevMcpServiceToken,
} from "../lib/devMcpCatalog.js";
import { ValidationError } from "../lib/errors.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const userParamsSchema = z.object({
	userId: z.string().trim().min(1),
});

const slackParamsSchema = z.object({
	slackUserId: slackUserIdSchema,
});

/**
 * dev-mcp (Dev Claude's MCP server) access, for people (`lib/devMcpAccess.ts`).
 *
 * - Admins list every request, approve (with a role), change the role or the
 *   tools, suspend, deny and approve again; the tool catalog comes from
 *   dev-mcp.
 * - Members read their own status for /connected-apps.
 */
export async function devMcpAccessRoutes(server: FastifyInstance) {
	const adminOnly = { preHandler: [authenticate, requireAdmin] };

	server.get(
		"/admin/dev-mcp-access",
		adminOnly,
		async (): Promise<DevMcpAccessEntry[]> => listDevMcpAccess(),
	);

	server.get(
		"/admin/dev-mcp-access/catalog",
		adminOnly,
		async (): Promise<DevMcpCatalog> => getDevMcpCatalog(),
	);

	server.patch<{ Params: { userId: string } }>(
		"/admin/dev-mcp-access/:userId",
		adminOnly,
		async (request): Promise<DevMcpAccessEntry> => {
			const params = userParamsSchema.safeParse(request.params);
			if (!params.success) {
				throw new ValidationError("Invalid member id");
			}
			const body = devMcpAccessActionSchema.safeParse(request.body);
			if (!body.success) {
				throw new ValidationError(
					body.error.issues[0]?.message ?? "Invalid action",
				);
			}
			const admin = (request as AuthenticatedRequest).user;
			const entry = await changeDevMcpAccess(
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
				"Admin changed dev-mcp access",
			);
			return entry;
		},
	);

	server.get(
		"/dev-mcp-access/me",
		{ preHandler: authenticate },
		async (request): Promise<OwnDevMcpAccess> =>
			readOwnDevMcpAccess((request as AuthenticatedRequest).user.id),
	);
}

/**
 * Refuses a request that doesn't carry `DEV_MCP_SERVICE_TOKEN`, compared in
 * constant time. Unset, every request is refused.
 */
async function requireDevMcpServiceToken(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const expected = getDevMcpServiceToken();
	if (!expected) {
		request.log.error("DEV_MCP_SERVICE_TOKEN is not configured");
		return reply.status(401).send({ error: "unauthorized" });
	}
	if (!hasBearerToken(request.headers.authorization, expected)) {
		return reply.status(401).send({ error: "unauthorized" });
	}
}

const NOT_FOUND = { error: "not_found" } as const;

/**
 * The service API dev-mcp calls (contract in docs/deployment.md, "Dev MCP
 * access"), authenticated with `Authorization: Bearer <DEV_MCP_SERVICE_TOKEN>`,
 * not a member token. dev-mcp caches answers for up to a minute per Slack ID.
 */
export async function devMcpServiceRoutes(server: FastifyInstance) {
	// dev-mcp asks once per member per minute at most; leave headroom over the
	// global per-IP limit for a busy minute.
	const options = {
		preHandler: requireDevMcpServiceToken,
		config: { rateLimit: { max: 600, timeWindow: "1 minute" } },
	};

	server.get<{ Params: { slackUserId: string } }>(
		"/internal/dev-mcp/access/:slackUserId",
		options,
		async (request, reply) => {
			const params = slackParamsSchema.safeParse(request.params);
			if (!params.success) {
				return reply.status(404).send(NOT_FOUND);
			}
			const access = await readDevMcpAccessRecord(params.data.slackUserId);
			if (!access) {
				return reply.status(404).send(NOT_FOUND);
			}
			return reply.header("cache-control", "no-store").send({ access });
		},
	);

	server.post<{ Params: { slackUserId: string } }>(
		"/internal/dev-mcp/access/:slackUserId/request",
		options,
		async (request, reply) => {
			const params = slackParamsSchema.safeParse(request.params);
			if (!params.success) {
				return reply.status(404).send(NOT_FOUND);
			}
			const body = devMcpAccessRequestBodySchema.safeParse(request.body);
			if (!body.success) {
				throw new ValidationError(
					body.error.issues[0]?.message ?? "Invalid request body",
				);
			}
			const result = await requestDevMcpAccess(
				params.data.slackUserId,
				body.data.display_name || undefined,
			);
			if (!result) {
				return reply.status(404).send(NOT_FOUND);
			}
			if (result.created) {
				request.log.info(
					{ userId: result.access.user_id },
					"dev-mcp access requested through the service API",
				);
			}
			return reply
				.status(result.created ? 201 : 200)
				.header("cache-control", "no-store")
				.send(result);
		},
	);
}
