import type { FastifyReply, FastifyRequest } from "fastify";
import { checkAdminRole } from "../lib/auth.js";
import { getSupabase } from "../lib/supabase.js";
import type { AuthenticatedRequest } from "../types/index.js";

export async function authenticate(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const authHeader = request.headers.authorization;

	if (!authHeader) {
		return reply.status(401).send({ error: "Missing Authorization header" });
	}

	const token = authHeader.replace("Bearer ", "");
	const {
		data: { user },
		error,
		// biome-ignore lint/suspicious/noExplicitAny: Vercel type resolution workaround
	} = await (getSupabase().auth as any).getUser(token);

	if (error || !user) {
		return reply.status(401).send({ error: "Invalid token" });
	}

	// Attach user to request
	(request as AuthenticatedRequest).user = user;
}

export async function requireAdmin(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const user = (request as AuthenticatedRequest).user;

	try {
		const isAdmin = await checkAdminRole(user.id);

		if (!isAdmin) {
			return reply
				.status(403)
				.send({ error: "Unauthorized: Admin access required" });
		}
	} catch (_error) {
		return reply.status(500).send({ error: "Internal Server Error" });
	}
}
