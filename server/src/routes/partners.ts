import {
	createPartnerSchema,
	partnerActivationResultSchema,
	partnerCreationResultSchema,
	partnerManagementDataSchema,
	updatePartnerSchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requestPartnerPortal } from "../lib/partnerPortal.js";
import { authenticate, requirePartnerManager } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const partnerIdParamsSchema = z.object({ id: z.string().uuid() });
const okSchema = z.object({ ok: z.literal(true) });

function parsePartnerId(params: unknown): string {
	const parsed = partnerIdParamsSchema.safeParse(params);
	if (!parsed.success) throw parsed.error;
	return parsed.data.id;
}

export async function partnerRoutes(server: FastifyInstance) {
	const preHandler = [authenticate, requirePartnerManager];

	server.get("/partners", { preHandler }, async () => {
		return requestPartnerPortal(
			"/api/internal/member-manager/partners",
			partnerManagementDataSchema,
		);
	});

	server.post("/partners", { preHandler }, async (request, reply) => {
		const parsed = createPartnerSchema.safeParse(request.body);
		if (!parsed.success) {
			return reply.status(400).send({
				error: "Invalid partner payload",
				details: parsed.error.flatten(),
			});
		}

		const user = (request as AuthenticatedRequest).user;
		const result = await requestPartnerPortal(
			"/api/internal/member-manager/partners",
			partnerCreationResultSchema,
			{ method: "POST", body: parsed.data, actorId: user.id },
		);
		return reply.status(201).send(result);
	});

	server.patch("/partners/:id", { preHandler }, async (request) => {
		const id = parsePartnerId(request.params);
		const input = updatePartnerSchema.safeParse(request.body);
		if (!input.success) throw input.error;
		return requestPartnerPortal(
			`/api/internal/member-manager/partners/${encodeURIComponent(id)}`,
			okSchema,
			{
				method: "PATCH",
				body: input.data,
				actorId: (request as AuthenticatedRequest).user.id,
			},
		);
	});

	server.delete("/partners/:id", { preHandler }, async (request) => {
		const id = parsePartnerId(request.params);
		return requestPartnerPortal(
			`/api/internal/member-manager/partners/${encodeURIComponent(id)}`,
			okSchema,
			{
				method: "DELETE",
				actorId: (request as AuthenticatedRequest).user.id,
			},
		);
	});

	server.post(
		"/partners/:id/activation-link",
		{ preHandler },
		async (request) => {
			const id = parsePartnerId(request.params);
			return requestPartnerPortal(
				`/api/internal/member-manager/partners/${encodeURIComponent(id)}/activation-link`,
				partnerActivationResultSchema,
				{
					method: "POST",
					actorId: (request as AuthenticatedRequest).user.id,
				},
			);
		},
	);
}
