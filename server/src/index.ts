import dotenv from "dotenv";
import { buildApp } from "./app.js";

dotenv.config();

const start = async () => {
	try {
		const server = await buildApp();
		const PORT = Number(process.env.PORT) || 3000;
		await server.listen({ port: PORT, host: "0.0.0.0" });
		console.log(`Server listening on http://localhost:${PORT}`);
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
};

start();
