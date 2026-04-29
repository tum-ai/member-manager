import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import errorHandler from "./plugins/errorHandler.js";
import { adminRoutes } from "./routes/admin.js";
import { changeRequestRoutes } from "./routes/changeRequests.js";
import { engagementCertificateRoutes } from "./routes/engagementCertificates.js";
import { memberRoutes } from "./routes/members.js";
import { reimbursementRoutes } from "./routes/reimbursements.js";
import { researchProjectRoutes } from "./routes/researchProjects.js";
import { sepaRoutes } from "./routes/sepa.js";

export const buildApp = async (): Promise<FastifyInstance> => {
	const server = Fastify({
		logger: true,
	});

	// Plugins
	await server.register(helmet);
	await server.register(rateLimit, {
		max: 100,
		timeWindow: "1 minute",
	});

	// Fallback to true (allow all) in development if CORS_ORIGIN is not set
	const allowedOrigins = process.env.CORS_ORIGIN
		? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
		: true;

	if (allowedOrigins === true) {
		server.log.warn("CORS_ORIGIN not set: defaulting to allow all origins.");
	}

	await server.register(cors, {
		origin: allowedOrigins,
	});

	await server.register(errorHandler);

	// Routes
	server.get("/health", async () => {
		return { status: "ok" };
	});

	await server.register(
		async (api) => {
			await api.register(memberRoutes);
			await api.register(sepaRoutes);
			await api.register(adminRoutes);
			await api.register(changeRequestRoutes);
			await api.register(engagementCertificateRoutes);
			await api.register(reimbursementRoutes);
			await api.register(researchProjectRoutes);
		},
		{ prefix: "/api" },
	);

	return server;
};
