import "../setup.js";
import assert from "node:assert";
import { afterEach, test } from "node:test";
import {
	notifyBugReport,
	resetSlackNotifier,
} from "../../src/lib/slackNotifier.js";

const originalFetch = globalThis.fetch;
const originalEnv = {
	slackBotToken: process.env.SLACK_BOT_TOKEN,
	bugReportSlackChannelId: process.env.BUG_REPORT_SLACK_CHANNEL_ID,
};

function restoreEnv(name: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[name];
		return;
	}

	process.env[name] = value;
}

afterEach(() => {
	restoreEnv("SLACK_BOT_TOKEN", originalEnv.slackBotToken);
	restoreEnv(
		"BUG_REPORT_SLACK_CHANNEL_ID",
		originalEnv.bugReportSlackChannelId,
	);
	globalThis.fetch = originalFetch;
	resetSlackNotifier();
});

test("notifyBugReport tags a round-robin member from the Slack channel", async () => {
	const calls: Array<{ body?: string; url: string }> = [];
	process.env.SLACK_BOT_TOKEN = "xoxb-test";
	process.env.BUG_REPORT_SLACK_CHANNEL_ID = "CBUGS";

	globalThis.fetch = async (input, init) => {
		const url = String(input);
		calls.push({ url, body: init?.body?.toString() });

		if (url.endsWith("/conversations.members")) {
			return new Response(
				JSON.stringify({
					ok: true,
					members: ["U3", "UBOT", "U1"],
					response_metadata: { next_cursor: "" },
				}),
				{ status: 200 },
			);
		}

		if (url.endsWith("/auth.test")) {
			return new Response(JSON.stringify({ ok: true, user_id: "UBOT" }), {
				status: 200,
			});
		}

		if (url.endsWith("/chat.postMessage")) {
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		}

		return new Response("not found", { status: 404 });
	};

	await notifyBugReport({
		issueNumber: 2,
		issueUrl: "https://github.com/tum-ai/member-manager/issues/2",
		issueTitle: "Bug: Round robin",
	});

	assert.strictEqual(calls.length, 3);
	assert.match(calls[0].body ?? "", /channel=CBUGS/);
	const postedMessage = JSON.parse(calls[2].body ?? "{}");
	assert.strictEqual(postedMessage.channel, "CBUGS");
	assert.match(postedMessage.text, /Tagged <@U3>/);
});
