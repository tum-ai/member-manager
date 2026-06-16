import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import errorHandler from "./plugins/errorHandler.js";
import { adminRoutes } from "./routes/admin.js";
import { assistantRoutes } from "./routes/assistant.js";
import { avatarProxyRoutes } from "./routes/avatarProxy.js";
import { bugReportRoutes } from "./routes/bugReports.js";
import { changeRequestRoutes } from "./routes/changeRequests.js";
import { contractRoutes } from "./routes/contracts.js";
import { cvRoutes, partnerExportRoutes } from "./routes/cv.js";
import { engagementCertificateRoutes } from "./routes/engagementCertificates.js";
import { expertiseRoutes } from "./routes/expertise.js";
import { jobRoutes } from "./routes/jobs.js";
import { memberRoutes } from "./routes/members.js";
import { permissionRoutes } from "./routes/permissions.js";
import { reimbursementRoutes } from "./routes/reimbursements.js";
import { researchProjectRoutes } from "./routes/researchProjects.js";
import { searchRoutes } from "./routes/search.js";
import { sepaRoutes } from "./routes/sepa.js";
import { slackInteractionRoutes } from "./routes/slackInteractions.js";
import { tumaiDaysRoutes } from "./routes/tumaiDays.js";

const API_BODY_LIMIT_BYTES = 20 * 1024 * 1024;

function getVercelPreviewOrigin(): string | null {
	if (process.env.VERCEL_ENV !== "preview") {
		return null;
	}

	const vercelUrl = process.env.VERCEL_URL?.trim();
	if (!vercelUrl) {
		return null;
	}

	return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
}

export const buildApp = async (): Promise<FastifyInstance> => {
	const server = Fastify({
		logger: true,
		bodyLimit: API_BODY_LIMIT_BYTES,
	});

	// Plugins
	await server.register(helmet);
	await server.register(rateLimit, {
		max: 100,
		timeWindow: "1 minute",
	});

	const configuredCorsOrigins = process.env.CORS_ORIGIN?.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);
	const vercelPreviewOrigin = getVercelPreviewOrigin();
	const allowedOrigins =
		configuredCorsOrigins && configuredCorsOrigins.length > 0
			? configuredCorsOrigins
			: vercelPreviewOrigin
				? [vercelPreviewOrigin]
				: process.env.NODE_ENV === "production"
					? null
					: true;

	if (allowedOrigins === null) {
		throw new Error("CORS_ORIGIN must be set in production");
	}

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
			await api.register(slackInteractionRoutes);
			await api.register(avatarProxyRoutes);
			await api.register(bugReportRoutes);
			await api.register(memberRoutes);
			await api.register(cvRoutes);
			await api.register(partnerExportRoutes);
			await api.register(sepaRoutes);
			await api.register(adminRoutes);
			await api.register(permissionRoutes);
			await api.register(changeRequestRoutes);
			await api.register(contractRoutes);
			await api.register(engagementCertificateRoutes);
			await api.register(expertiseRoutes);
			await api.register(searchRoutes);
			await api.register(assistantRoutes);
			await api.register(jobRoutes);
			await api.register(reimbursementRoutes);
			await api.register(researchProjectRoutes);
			await api.register(tumaiDaysRoutes);
		},
		{ prefix: "/api" },
	);

	return server;
};
