import type { FastifyReply, FastifyRequest } from "fastify";
import {
	checkAdminRole,
	checkBoardRole,
	checkContractsAdmin,
	checkReimbursementReviewer,
	checkTumaiDaysManager,
} from "../lib/auth.js";
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
	} catch (error) {
		request.log.error(
			{ err: error, userId: user?.id },
			"Failed to check admin role",
		);
		return reply.status(500).send({ error: "Internal Server Error" });
	}
}

export async function requireContractsAdmin(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const user = (request as AuthenticatedRequest).user;

	try {
		const allowed = await checkContractsAdmin(user.id);

		if (!allowed) {
			return reply
				.status(403)
				.send({ error: "Contracts admin access required" });
		}
	} catch (error) {
		request.log.error(
			{ err: error, userId: user?.id },
			"Failed to check contracts admin permission",
		);
		return reply.status(500).send({ error: "Internal Server Error" });
	}
}

export async function requireBoardMember(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const user = (request as AuthenticatedRequest).user;

	try {
		const allowed = await checkBoardRole(user.id);

		if (!allowed) {
			return reply.status(403).send({ error: "Board access required" });
		}
	} catch (error) {
		request.log.error(
			{ err: error, userId: user?.id },
			"Failed to check board role",
		);
		return reply.status(500).send({ error: "Internal Server Error" });
	}
}

export async function requireReimbursementReviewer(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const user = (request as AuthenticatedRequest).user;

	try {
		const canReview = await checkReimbursementReviewer(user.id);

		if (!canReview) {
			return reply
				.status(403)
				.send({ error: "Finance review access required" });
		}
	} catch (error) {
		request.log.error(
			{ err: error, userId: user?.id },
			"Failed to check reimbursement reviewer role",
		);
		return reply.status(500).send({ error: "Internal Server Error" });
	}
}

export async function requireTumaiDaysManager(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const user = (request as AuthenticatedRequest).user;

	try {
		const allowed = await checkTumaiDaysManager(user.id);

		if (!allowed) {
			return reply.status(403).send({
				error: "Unauthorized: TUM.ai Days management access required",
			});
		}
	} catch (error) {
		request.log.error(
			{ err: error, userId: user?.id },
			"Failed to check TUM.ai Days manager role",
		);
		return reply.status(500).send({ error: "Internal Server Error" });
	}
}

export async function requireCronOrTumaiDaysManager(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const authHeader = request.headers.authorization;
	const cronSecret = process.env.CRON_SECRET;

	if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
		return;
	}

	await authenticate(request, reply);
	if (reply.sent) return;

	await requireTumaiDaysManager(request, reply);
}
