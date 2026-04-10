import type { IncomingMessage, ServerResponse } from "node:http";

let appPromise: Promise<any> | undefined;

async function getApp() {
	if (!appPromise) {
		// Dynamic import() required: the server package is ESM but Vercel
		// compiles this API route as CommonJS.
		const { buildApp } = await import("../server/src/app.js");
		appPromise = buildApp();
	}

	const app = await appPromise;
	await app.ready();
	return app;
}

export default async function handler(
	request: IncomingMessage,
	response: ServerResponse,
) {
	const app = await getApp();

	app.server.emit("request", request, response);
}
