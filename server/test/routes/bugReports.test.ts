import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	type BugReportSlackNotification,
	resetSlackNotifier,
	setBugReportSlackNotifier,
} from "../../src/lib/slackNotifier.js";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";

describe("Bug Report Routes", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		resetSlackNotifier();
		await closeTestApp();
	});

	test("member can submit a bug report to Slack", async () => {
		resetDatabase();
		const notifications: BugReportSlackNotification[] = [];
		setBugReportSlackNotifier(async (payload) => {
			notifications.push(payload);
		});

		try {
			const response = await app.inject({
				method: "POST",
				url: "/api/bug-reports",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
					"user-agent": "node-test-agent",
				},
				payload: JSON.stringify({
					message: "The profile form does not save my department.",
					stepsToReproduce: "Open profile, change department, save.",
					pageUrl: "https://members.tum-ai.com/profile",
				}),
			});

			assert.strictEqual(response.statusCode, 202);
			assert.deepStrictEqual(JSON.parse(response.payload), { ok: true });
			assert.strictEqual(notifications.length, 1);
			assert.strictEqual(notifications[0].reporterUserId, testUserIds.user);
			assert.strictEqual(notifications[0].reporterEmail, "user@test.com");
			assert.match(notifications[0].message, /profile form/i);
			assert.strictEqual(
				notifications[0].stepsToReproduce,
				"Open profile, change department, save.",
			);
			assert.strictEqual(
				notifications[0].pageUrl,
				"https://members.tum-ai.com/profile",
			);
			assert.strictEqual(notifications[0].userAgent, "node-test-agent");
		} finally {
			resetSlackNotifier();
		}
	});

	test("bug report submission requires authentication", async () => {
		resetDatabase();

		const response = await app.inject({
			method: "POST",
			url: "/api/bug-reports",
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ message: "A real issue" }),
		});

		assert.strictEqual(response.statusCode, 401);
	});

	test("returns a useful error when Slack submission fails", async () => {
		resetDatabase();
		setBugReportSlackNotifier(async () => {
			throw new Error("Slack unavailable");
		});

		try {
			const response = await app.inject({
				method: "POST",
				url: "/api/bug-reports",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ message: "This should reach Slack." }),
			});

			assert.strictEqual(response.statusCode, 502);
			assert.match(response.payload, /could not submit bug report/i);
		} finally {
			resetSlackNotifier();
		}
	});
});
