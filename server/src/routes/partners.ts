import {
	type CreatePartnerInput,
	createPartnerSchema,
	managedPartnerJobSchema,
	partnerActivationResultSchema,
	partnerCreationResultSchema,
	partnerJobInputSchema,
	partnerJobsDataSchema,
	partnerManagementDataSchema,
	type UpdatePartnerInput,
	updatePartnerSchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ServiceUnavailableError } from "../lib/errors.js";
import { requestPartnerPortal } from "../lib/partnerPortal.js";
import { authenticate, requirePartnerManager } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const partnerIdParamsSchema = z.object({ id: z.string().uuid() });
const partnerJobIdParamsSchema = z.object({
	id: z.string().uuid(),
	jobId: z.string().uuid(),
});
const okSchema = z.object({ ok: z.literal(true) });
const managedPartnerJobResultSchema = z.object({
	job: managedPartnerJobSchema,
});

function parsePartnerId(params: unknown): string {
	const parsed = partnerIdParamsSchema.safeParse(params);
	if (!parsed.success) throw parsed.error;
	return parsed.data.id;
}

function parsePartnerJobIds(params: unknown): {
	partnerId: string;
	jobId: string;
} {
	const parsed = partnerJobIdParamsSchema.safeParse(params);
	if (!parsed.success) throw parsed.error;
	return { partnerId: parsed.data.id, jobId: parsed.data.jobId };
}

async function normalizeSingleJobTier<
	T extends CreatePartnerInput | UpdatePartnerInput,
>(input: T): Promise<T> {
	if (input.partnerKind !== "single_job_buyer") return input;

	const management = await requestPartnerPortal(
		"/api/internal/member-manager/partners",
		partnerManagementDataSchema,
	);
	const bronze = management.tiers.find((tier) => tier.slug === "bronze");
	if (!bronze) {
		throw new ServiceUnavailableError(
			"Partner Portal Bronze compatibility tier is unavailable",
		);
	}
	return { ...input, tierId: bronze.id };
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
		const input = await normalizeSingleJobTier(parsed.data);
		const result = await requestPartnerPortal(
			"/api/internal/member-manager/partners",
			partnerCreationResultSchema,
			{ method: "POST", body: input, actorId: user.id },
		);
		return reply.status(201).send(result);
	});

	server.patch("/partners/:id", { preHandler }, async (request) => {
		const id = parsePartnerId(request.params);
		const input = updatePartnerSchema.safeParse(request.body);
		if (!input.success) throw input.error;
		const normalized = await normalizeSingleJobTier(input.data);
		return requestPartnerPortal(
			`/api/internal/member-manager/partners/${encodeURIComponent(id)}`,
			okSchema,
			{
				method: "PATCH",
				body: normalized,
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

	server.get("/partners/:id/jobs", { preHandler }, async (request) => {
		const id = parsePartnerId(request.params);
		return requestPartnerPortal(
			`/api/internal/member-manager/partners/${encodeURIComponent(id)}/jobs`,
			partnerJobsDataSchema,
		);
	});

	server.post("/partners/:id/jobs", { preHandler }, async (request, reply) => {
		const id = parsePartnerId(request.params);
		const input = partnerJobInputSchema.safeParse(request.body);
		if (!input.success) throw input.error;
		const result = await requestPartnerPortal(
			`/api/internal/member-manager/partners/${encodeURIComponent(id)}/jobs`,
			managedPartnerJobResultSchema,
			{
				method: "POST",
				body: input.data,
				actorId: (request as AuthenticatedRequest).user.id,
			},
		);
		return reply.status(201).send(result);
	});

	server.patch("/partners/:id/jobs/:jobId", { preHandler }, async (request) => {
		const { partnerId, jobId } = parsePartnerJobIds(request.params);
		const input = partnerJobInputSchema.safeParse(request.body);
		if (!input.success) throw input.error;
		return requestPartnerPortal(
			`/api/internal/member-manager/partners/${encodeURIComponent(partnerId)}/jobs/${encodeURIComponent(jobId)}`,
			managedPartnerJobResultSchema,
			{
				method: "PATCH",
				body: input.data,
				actorId: (request as AuthenticatedRequest).user.id,
			},
		);
	});

	server.delete(
		"/partners/:id/jobs/:jobId",
		{ preHandler },
		async (request) => {
			const { partnerId, jobId } = parsePartnerJobIds(request.params);
			return requestPartnerPortal(
				`/api/internal/member-manager/partners/${encodeURIComponent(partnerId)}/jobs/${encodeURIComponent(jobId)}`,
				okSchema,
				{
					method: "DELETE",
					actorId: (request as AuthenticatedRequest).user.id,
				},
			);
		},
	);
}
