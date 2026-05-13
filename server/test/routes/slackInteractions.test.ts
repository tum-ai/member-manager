import "../setup.js";
import assert from "node:assert";
import { createHmac } from "node:crypto";
import { after, afterEach, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	resetSlackNotifier,
	setReimbursementStatusSlackNotifier,
} from "../../src/lib/slackNotifier.js";
import { closeTestApp, getTestApp, resetDatabase } from "../helpers.js";
import { mockDatabase } from "../mocks/supabase.js";

const PDF_BASE64 = "JVBERi0xLjQ=";

async function waitForAssertion(assertion: () => void): Promise<void> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 50; attempt += 1) {
		try {
			assertion();
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}
	throw lastError;
}

function signedSlackPayload(payload: Record<string, unknown>, secret: string) {
	const body = new URLSearchParams({
		payload: JSON.stringify(payload),
	}).toString();
	const timestamp = String(Math.floor(Date.now() / 1000));
	const signature = `v0=${createHmac("sha256", secret)
		.update(`v0:${timestamp}:${body}`)
		.digest("hex")}`;

	return {
		body,
		headers: {
			"content-type": "application/x-www-form-urlencoded",
			"x-slack-request-timestamp": timestamp,
			"x-slack-signature": signature,
		},
	};
}

describe("Slack interaction routes", async () => {
	let app: FastifyInstance;
	const originalFetch = globalThis.fetch;
	const originalEnv = {
		signingSecret: process.env.SLACK_SIGNING_SECRET,
		slackBotToken: process.env.SLACK_BOT_TOKEN,
		bbClient: process.env.BUCHHALTUNGSBUTLER_API_CLIENT,
		bbSecret: process.env.BUCHHALTUNGSBUTLER_API_SECRET,
		bbKey: process.env.BUCHHALTUNGSBUTLER_API_KEY,
		bbBaseUrl: process.env.BUCHHALTUNGSBUTLER_API_BASE_URL,
		bbSyncEnabled: process.env.BUCHHALTUNGSBUTLER_SYNC_ENABLED,
	};

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		resetSlackNotifier();
		await closeTestApp();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		resetSlackNotifier();
		for (const [key, value] of Object.entries({
			SLACK_SIGNING_SECRET: originalEnv.signingSecret,
			SLACK_BOT_TOKEN: originalEnv.slackBotToken,
			BUCHHALTUNGSBUTLER_API_CLIENT: originalEnv.bbClient,
			BUCHHALTUNGSBUTLER_API_SECRET: originalEnv.bbSecret,
			BUCHHALTUNGSBUTLER_API_KEY: originalEnv.bbKey,
			BUCHHALTUNGSBUTLER_API_BASE_URL: originalEnv.bbBaseUrl,
			BUCHHALTUNGSBUTLER_SYNC_ENABLED: originalEnv.bbSyncEnabled,
		})) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	});

	test("rejects unsigned Slack interactions", async () => {
		resetDatabase();
		process.env.SLACK_SIGNING_SECRET = "test-secret";

		const response = await app.inject({
			method: "POST",
			url: "/api/slack/interactions",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				"x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)),
				"x-slack-signature": "v0=bad",
			},
			payload: new URLSearchParams({ payload: "{}" }).toString(),
		});

		assert.strictEqual(response.statusCode, 401);
	});

	test("lets finance reviewers approve from Slack", async () => {
		resetDatabase();
		process.env.SLACK_SIGNING_SECRET = "test-secret";
		process.env.SLACK_BOT_TOKEN = "xoxb-test";
		setReimbursementStatusSlackNotifier(async () => {});

		const delayedMessages: string[] = [];
		globalThis.fetch = (async (input, init) => {
			const url = String(input);
			if (url === "https://hooks.slack.test/response") {
				delayedMessages.push(
					String(JSON.parse(String(init?.body ?? "{}") || "{}").text ?? ""),
				);
				return new Response("ok", { status: 200 });
			}

			assert.strictEqual(url, "https://slack.com/api/users.info");
			return new Response(
				JSON.stringify({
					ok: true,
					user: { profile: { email: "admin@test.com" } },
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}) as typeof fetch;

		const signed = signedSlackPayload(
			{
				type: "block_actions",
				user: { id: "UADMIN" },
				response_url: "https://hooks.slack.test/response",
				actions: [
					{
						action_id: "reimbursement_approve",
						value: "reimbursement-older",
					},
				],
			},
			"test-secret",
		);

		const response = await app.inject({
			method: "POST",
			url: "/api/slack/interactions",
			headers: signed.headers,
			payload: signed.body,
		});

		assert.strictEqual(response.statusCode, 200);
		assert.match(JSON.parse(response.payload).text, /Processing/);
		await waitForAssertion(() => {
			assert.strictEqual(
				mockDatabase.reimbursements.find(
					(row) => row.id === "reimbursement-older",
				)?.approval_status,
				"approved",
			);
			assert.match(delayedMessages.at(-1) ?? "", /approved/);
		});
	});

	test("lets finance reviewers approve and sync to BuchhaltungsButler from Slack", async () => {
		resetDatabase();
		process.env.SLACK_SIGNING_SECRET = "test-secret";
		process.env.SLACK_BOT_TOKEN = "xoxb-test";
		process.env.BUCHHALTUNGSBUTLER_API_CLIENT = "client-id";
		process.env.BUCHHALTUNGSBUTLER_API_SECRET = "client-secret";
		process.env.BUCHHALTUNGSBUTLER_API_KEY = "customer-key";
		process.env.BUCHHALTUNGSBUTLER_API_BASE_URL = "https://bb.test/api/v1";
		process.env.BUCHHALTUNGSBUTLER_SYNC_ENABLED = "true";
		setReimbursementStatusSlackNotifier(async () => {});

		const bbRequests: string[] = [];
		const delayedMessages: string[] = [];
		globalThis.fetch = (async (input, init) => {
			const url = String(input);
			if (url === "https://hooks.slack.test/response") {
				delayedMessages.push(
					String(JSON.parse(String(init?.body ?? "{}") || "{}").text ?? ""),
				);
				return new Response("ok", { status: 200 });
			}

			if (url === "https://slack.com/api/users.info") {
				return new Response(
					JSON.stringify({
						ok: true,
						user: { profile: { email: "admin@test.com" } },
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}

			bbRequests.push(url);
			const body = new URLSearchParams(String(init?.body ?? ""));
			assert.strictEqual(body.get("api_key"), "customer-key");
			if (url.endsWith("/receipts/upload")) {
				assert.strictEqual(body.get("file"), PDF_BASE64);
				return new Response(
					JSON.stringify({
						success: true,
						message: "",
						id_by_customer: "654",
						filename: "receipt654",
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}

			assert.ok(url.endsWith("/comments/add"));
			return new Response(JSON.stringify({ success: true, message: "" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as typeof fetch;

		const signed = signedSlackPayload(
			{
				type: "block_actions",
				user: { id: "UADMIN" },
				response_url: "https://hooks.slack.test/response",
				actions: [
					{
						action_id: "reimbursement_approve_sync_bb",
						value: "reimbursement-newer",
					},
				],
			},
			"test-secret",
		);

		const response = await app.inject({
			method: "POST",
			url: "/api/slack/interactions",
			headers: signed.headers,
			payload: signed.body,
		});

		assert.strictEqual(response.statusCode, 200);
		assert.match(JSON.parse(response.payload).text, /Processing/);
		await waitForAssertion(() => {
			assert.deepStrictEqual(bbRequests, [
				"https://bb.test/api/v1/receipts/upload",
				"https://bb.test/api/v1/comments/add",
			]);
			const request = mockDatabase.reimbursements.find(
				(row) => row.id === "reimbursement-newer",
			);
			assert.strictEqual(request?.bb_sync_status, "synced");
			assert.strictEqual(request?.bb_receipt_id_by_customer, "654");
			assert.match(delayedMessages.at(-1) ?? "", /synced/);
		});
	});
});
