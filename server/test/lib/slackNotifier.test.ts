import "../setup.js";
import assert from "node:assert";
import { afterEach, test } from "node:test";
import {
	notifyBugReport,
	notifyFinanceOfReimbursementRequest,
	resetSlackNotifier,
} from "../../src/lib/slackNotifier.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";
import {
	createMockSupabaseClient,
	MOCK_ADMIN_ID,
	mockDatabase,
	mockUsers,
	resetMockDatabase,
} from "../mocks/supabase.js";

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
	delete mockUsers["finance-opt-in-token"];
	delete mockUsers["finance-opt-out-token"];
	delete mockUsers["community-opt-in-token"];
	resetMockDatabase();
	resetSlackNotifier();
});

test("notifyFinanceOfReimbursementRequest DMs only opted-in eligible reviewers", async () => {
	resetMockDatabase();
	setSupabaseClient(createMockSupabaseClient());
	process.env.SLACK_BOT_TOKEN = "xoxb-test";

	const financeOptInUserId = "finance-opt-in";
	const financeOptOutUserId = "finance-opt-out";
	const communityOptInUserId = "community-opt-in";

	mockUsers["finance-opt-in-token"] = {
		id: financeOptInUserId,
		email: "finance-opt-in@test.com",
		app_metadata: {},
		user_metadata: {},
		aud: "authenticated",
		created_at: "2024-01-01T00:00:00Z",
	};
	mockUsers["finance-opt-out-token"] = {
		id: financeOptOutUserId,
		email: "finance-opt-out@test.com",
		app_metadata: {},
		user_metadata: {},
		aud: "authenticated",
		created_at: "2024-01-01T00:00:00Z",
	};
	mockUsers["community-opt-in-token"] = {
		id: communityOptInUserId,
		email: "community-opt-in@test.com",
		app_metadata: {},
		user_metadata: {},
		aud: "authenticated",
		created_at: "2024-01-01T00:00:00Z",
	};

	const adminMember = mockDatabase.members.find(
		(member) => member.user_id === MOCK_ADMIN_ID,
	);
	assert.ok(adminMember);
	adminMember.reimbursement_slack_notifications_enabled = true;

	mockDatabase.members.push(
		{
			user_id: financeOptInUserId,
			given_name: "Finance",
			surname: "Opt In",
			department: "Legal & Finance",
			member_status: "active",
			active: true,
			reimbursement_slack_notifications_enabled: true,
		},
		{
			user_id: financeOptOutUserId,
			given_name: "Finance",
			surname: "Opt Out",
			department: "Legal & Finance",
			member_status: "active",
			active: true,
			reimbursement_slack_notifications_enabled: false,
		},
		{
			user_id: communityOptInUserId,
			given_name: "Community",
			surname: "Opt In",
			department: "Community",
			member_status: "active",
			active: true,
			reimbursement_slack_notifications_enabled: true,
		},
	);
	mockDatabase.user_roles.push(
		{ user_id: financeOptInUserId, role: "user" },
		{ user_id: financeOptOutUserId, role: "user" },
		{ user_id: communityOptInUserId, role: "user" },
	);

	const emailLookups: string[] = [];
	const posts: Array<Record<string, unknown>> = [];
	globalThis.fetch = async (input, init) => {
		const url = String(input);
		const body = init?.body?.toString() ?? "";

		if (url.endsWith("/users.lookupByEmail")) {
			const email = new URLSearchParams(body).get("email") ?? "";
			emailLookups.push(email);
			return new Response(
				JSON.stringify({ ok: true, user: { id: `U-${email}` } }),
				{ status: 200 },
			);
		}

		if (url.endsWith("/conversations.open")) {
			const userId = new URLSearchParams(body).get("users") ?? "";
			return new Response(
				JSON.stringify({ ok: true, channel: { id: `D-${userId}` } }),
				{ status: 200 },
			);
		}

		if (url.endsWith("/chat.postMessage")) {
			posts.push(JSON.parse(body) as Record<string, unknown>);
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		}

		return new Response("not found", { status: 404 });
	};

	await notifyFinanceOfReimbursementRequest({
		requestId: "request-1",
		requesterUserId: "requester-1",
		requesterEmail: "requester@test.com",
		submissionType: "reimbursement",
		department: "Community",
		amount: 42,
		reviewUrl: "https://member-manager.test/tools/reimbursement/review",
	});

	assert.deepStrictEqual(emailLookups.sort(), [
		"admin@test.com",
		"finance-opt-in@test.com",
	]);
	assert.strictEqual(posts.length, 2);
	assert.ok(
		posts.every((post) =>
			String(post.text).includes("New reimbursement request"),
		),
	);
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
	assert.match(postedMessage.text, /\n<@U3>\n/);
});

test("notifyBugReport exposes Slack member lookup failures", async () => {
	const calls: string[] = [];
	process.env.SLACK_BOT_TOKEN = "xoxb-test";
	process.env.BUG_REPORT_SLACK_CHANNEL_ID = "CBUGS";

	globalThis.fetch = async (input) => {
		const url = String(input);
		calls.push(url);

		if (url.endsWith("/conversations.members")) {
			return new Response(
				JSON.stringify({ ok: false, error: "missing_scope" }),
				{ status: 200 },
			);
		}

		if (url.endsWith("/chat.postMessage")) {
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		}

		return new Response("not found", { status: 404 });
	};

	await assert.rejects(
		() =>
			notifyBugReport({
				issueNumber: 2,
				issueUrl: "https://github.com/tum-ai/member-manager/issues/2",
				issueTitle: "Bug: Round robin",
			}),
		/missing_scope/,
	);
	assert.deepStrictEqual(calls, [
		"https://slack.com/api/conversations.members",
	]);
});
