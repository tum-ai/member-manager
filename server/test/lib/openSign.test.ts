import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
	downloadOpenSignPdf,
	revokeOpenSignDocument,
	sendOpenSignDocument,
} from "../../src/lib/openSign.js";

const originalFetch = globalThis.fetch;
const originalApiToken = process.env.OPENSIGN_API_TOKEN;
const originalBaseUrl = process.env.OPENSIGN_BASE_URL;
const originalFileHosts = process.env.OPENSIGN_FILE_HOSTS;

function restoreEnvironmentValue(
	name: string,
	value: string | undefined,
): void {
	if (value === undefined) {
		delete process.env[name];
		return;
	}
	process.env[name] = value;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
	restoreEnvironmentValue("OPENSIGN_API_TOKEN", originalApiToken);
	restoreEnvironmentValue("OPENSIGN_BASE_URL", originalBaseUrl);
	restoreEnvironmentValue("OPENSIGN_FILE_HOSTS", originalFileHosts);
});

describe("OpenSign contract files", () => {
	test("uses document specific signature widgets", async () => {
		process.env.OPENSIGN_API_TOKEN = "token";
		process.env.OPENSIGN_BASE_URL = "https://eu-app.opensignlabs.com/api/v1.2";
		let requestBody: Record<string, unknown> | null = null;
		globalThis.fetch = (async (_input, init) => {
			requestBody = JSON.parse(String(init?.body));
			return new Response(JSON.stringify({ objectId: "document-1" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) satisfies typeof fetch;
		const widgets = [
			{ type: "signature", page: 2, x: 10, y: 20, w: 100, h: 40 },
		];

		await sendOpenSignDocument({
			name: "Contract",
			pdf: Buffer.from("%PDF-1.7\n"),
			signer: { name: "Partner", email: "partner@example.com" },
			widgets,
		});

		const signers = requestBody?.signers as
			| Array<{ widgets?: unknown[] }>
			| undefined;
		assert.deepEqual(signers?.[0]?.widgets, widgets);
	});

	test("downloads a signed PDF only from an allowed host", async () => {
		process.env.OPENSIGN_FILE_HOSTS = "files.example.com";
		globalThis.fetch = (async () =>
			new Response(Buffer.from("%PDF-1.7\ncontract"), {
				status: 200,
				headers: { "content-type": "application/pdf" },
			})) satisfies typeof fetch;

		const pdf = await downloadOpenSignPdf(
			"https://files.example.com/signed.pdf?token=secret",
		);

		assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
	});

	test("rejects an untrusted signed PDF host before fetching", async () => {
		let called = false;
		globalThis.fetch = (async () => {
			called = true;
			return new Response();
		}) satisfies typeof fetch;

		await assert.rejects(
			downloadOpenSignPdf("https://internal.example/signed.pdf"),
			/untrusted PDF URL/,
		);
		assert.equal(called, false);
	});

	test("treats an already removed OpenSign document as revoked", async () => {
		process.env.OPENSIGN_API_TOKEN = "token";
		process.env.OPENSIGN_BASE_URL = "https://eu-app.opensignlabs.com/api/v1.2";
		let method: string | undefined;
		globalThis.fetch = (async (_input, init) => {
			method = init?.method;
			return new Response(null, { status: 404 });
		}) satisfies typeof fetch;

		await revokeOpenSignDocument("document-1");

		assert.equal(method, "DELETE");
	});
});
