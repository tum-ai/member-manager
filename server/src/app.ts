import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import errorHandler from "./plugins/errorHandler.js";
import { adminRoutes } from "./routes/admin.js";
import { memberRoutes } from "./routes/members.js";
import { sepaRoutes } from "./routes/sepa.js";

export const buildApp = async () => {
	const server = Fastify({
		logger: true,
	});

	// Plugins
	await server.register(helmet);
	await server.register(rateLimit, {
		max: 100,
		timeWindow: "1 minute",
	});

	const allowedOrigins = process.env.CORS_ORIGIN
		? process.env.CORS_ORIGIN.split(",")
		: true;

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
		},
		{ prefix: "/api" },
	);

	return server;
};
