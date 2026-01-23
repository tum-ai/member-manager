import cors from "@fastify/cors";
import dotenv from "dotenv";
import Fastify from "fastify";
import { adminRoutes } from "./routes/admin.js";
import { memberRoutes } from "./routes/members.js";
import { sepaRoutes } from "./routes/sepa.js";

dotenv.config();

const server = Fastify({
	logger: true,
});

server.register(cors, {
	origin: true, // Allow all for dev, tighten for prod
});

server.get("/health", async (_request, _reply) => {
	return { status: "ok" };
});

server.register(memberRoutes, { prefix: "/api" });
server.register(sepaRoutes, { prefix: "/api" });
server.register(adminRoutes, { prefix: "/api" });

const start = async () => {
	try {
		const PORT = parseInt(process.env.PORT || "3000", 10);
		await server.listen({ port: PORT, host: "0.0.0.0" });
		console.log(`Server listening on http://localhost:${PORT}`);
	} catch (err) {
		server.log.error(err);
		process.exit(1);
	}
};

start();
