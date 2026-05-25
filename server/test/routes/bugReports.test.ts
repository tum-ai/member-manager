import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	type BugReportIssuePayload,
	resetBugReportIssueCreator,
	setBugReportIssueCreator,
} from "../../src/lib/githubIssues.js";
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
		resetBugReportIssueCreator();
		resetSlackNotifier();
		await closeTestApp();
	});

	test("member can submit a bug report to GitHub and notify Slack", async () => {
		resetDatabase();
		const issues: BugReportIssuePayload[] = [];
		const notifications: BugReportSlackNotification[] = [];
		setBugReportIssueCreator(async (payload) => {
			issues.push(payload);
			return {
				number: 123,
				url: "https://github.com/tum-ai/member-manager/issues/123",
				title: "Bug: The profile form does not save my department.",
			};
		});
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
			assert.strictEqual(issues.length, 1);
			assert.strictEqual(issues[0].reporterUserId, testUserIds.user);
			assert.strictEqual(issues[0].reporterEmail, "user@test.com");
			assert.match(issues[0].message, /profile form/i);
			assert.strictEqual(
				issues[0].stepsToReproduce,
				"Open profile, change department, save.",
			);
			assert.strictEqual(
				issues[0].pageUrl,
				"https://members.tum-ai.com/profile",
			);
			assert.strictEqual(issues[0].userAgent, "node-test-agent");
			assert.deepStrictEqual(notifications, [
				{
					issueNumber: 123,
					issueUrl: "https://github.com/tum-ai/member-manager/issues/123",
					issueTitle: "Bug: The profile form does not save my department.",
				},
			]);
		} finally {
			resetBugReportIssueCreator();
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

	test("returns a useful error when GitHub issue creation fails", async () => {
		resetDatabase();
		setBugReportIssueCreator(async () => {
			throw new Error("GitHub unavailable");
		});

		try {
			const response = await app.inject({
				method: "POST",
				url: "/api/bug-reports",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({ message: "This should reach GitHub." }),
			});

			assert.strictEqual(response.statusCode, 502);
			assert.match(response.payload, /could not submit bug report/i);
		} finally {
			resetBugReportIssueCreator();
		}
	});

	test("keeps the submitted issue when Slack notification fails", async () => {
		resetDatabase();
		setBugReportIssueCreator(async () => ({
			number: 124,
			url: "https://github.com/tum-ai/member-manager/issues/124",
			title: "Bug: Slack fallback",
		}));
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
				payload: JSON.stringify({ message: "This should still be saved." }),
			});

			assert.strictEqual(response.statusCode, 202);
			assert.deepStrictEqual(JSON.parse(response.payload), { ok: true });
		} finally {
			resetBugReportIssueCreator();
			resetSlackNotifier();
		}
	});
});
