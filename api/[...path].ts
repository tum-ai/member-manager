import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../server/src/app.js";

let appPromise: ReturnType<typeof buildApp> | undefined;

async function getApp() {
	if (!appPromise) {
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
