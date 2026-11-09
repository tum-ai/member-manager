import "../setup.js";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createDevMcpCatalogClient,
	readDevMcpConfig,
} from "../../src/lib/devMcpCatalog.js";
import { AppError } from "../../src/lib/errors.js";

const CONFIG = { url: "https://dev-mcp.test", serviceToken: "secret" };
const TOOL = {
	name: "whoami",
	title: "Who am I",
	description: "Shows your access",
	minRole: "member",
	requestableBy: null,
	destructive: false,
	maxCallsPerDay: null,
};

function fakeFetch(respond: () => Response | Promise<Response>) {
	const calls: Array<{ url: string; init: RequestInit; timeoutMs: number }> =
		[];
	const fetch = async (url: string, init: RequestInit, timeoutMs: number) => {
		calls.push({ url, init, timeoutMs });
		return respond();
	};
	return { fetch, calls };
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

async function statusOf(promise: Promise<unknown>): Promise<number> {
	try {
		await promise;
	} catch (error) {
		assert.ok(error instanceof AppError);
		return error.statusCode;
	}
	return 200;
}

describe("readDevMcpConfig", () => {
	test("trims values and the URL's trailing slash", () => {
		assert.deepEqual(
			readDevMcpConfig({
				DEV_MCP_URL: " https://tumai-dev-mcp.vercel.app/ ",
				DEV_MCP_SERVICE_TOKEN: " token ",
			}),
			{ url: "https://tumai-dev-mcp.vercel.app", serviceToken: "token" },
		);
		assert.deepEqual(readDevMcpConfig({ DEV_MCP_URL: " " }), {
			url: null,
			serviceToken: null,
		});
	});
});

describe("the dev-mcp catalog client", () => {
	test("fetches the catalog with the service token and a timeout", async () => {
		const { fetch, calls } = fakeFetch(() => json({ tools: [TOOL] }));
		const client = createDevMcpCatalogClient({
			config: CONFIG,
			fetch,
			timeoutMs: 1234,
		});

		assert.deepEqual(await client.getCatalog(), { tools: [TOOL] });
		assert.equal(calls[0].url, "https://dev-mcp.test/service/catalog");
		assert.deepEqual(calls[0].init.headers, {
			accept: "application/json",
			authorization: "Bearer secret",
		});
		assert.equal(calls[0].timeoutMs, 1234);
	});

	test("caches the catalog for its lifetime, then fetches again", async () => {
		let time = 0;
		const { fetch, calls } = fakeFetch(() => json({ tools: [TOOL] }));
		const client = createDevMcpCatalogClient({
			config: CONFIG,
			fetch,
			ttlMs: 1000,
			now: () => time,
		});

		await Promise.all([client.getCatalog(), client.getCatalog()]);
		time = 999;
		await client.getCatalog();
		assert.equal(calls.length, 1);
		time = 1000;
		await client.getCatalog();
		assert.equal(calls.length, 2);
	});

	test("answers 503 while unconfigured or unreachable, without caching", async () => {
		const unconfigured = createDevMcpCatalogClient({
			config: { url: null, serviceToken: "secret" },
			fetch: fakeFetch(() => json({ tools: [] })).fetch,
		});
		assert.equal(await statusOf(unconfigured.getCatalog()), 503);

		let down = true;
		const { fetch, calls } = fakeFetch(() => {
			if (down) throw new Error("ECONNREFUSED");
			return json({ tools: [TOOL] });
		});
		const client = createDevMcpCatalogClient({ config: CONFIG, fetch });
		assert.equal(await statusOf(client.getCatalog()), 503);
		down = false;
		assert.equal(await statusOf(client.getCatalog()), 200);
		assert.equal(calls.length, 2);
	});

	test("answers 502 for an error status or an unexpected body", async () => {
		for (const response of [
			() => json({ error: "unauthorized" }, 401),
			() => new Response("<html>", { status: 200 }),
			() => json({ tools: [{ ...TOOL, minRole: "owner" }] }),
		]) {
			const client = createDevMcpCatalogClient({
				config: CONFIG,
				fetch: fakeFetch(response).fetch,
			});
			assert.equal(await statusOf(client.getCatalog()), 502);
		}
	});
});
