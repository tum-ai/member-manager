import "../setup.js";
import assert from "node:assert";
import { afterEach, test } from "node:test";
import {
	notifyBugReport,
	notifyFinanceOfReimbursementRequest,
	notifyRequesterOfReimbursementStatus,
	resetSlackNotifier,
} from "../../src/lib/slackNotifier.js";
import { getSupabase, setSupabaseClient } from "../../src/lib/supabase.js";
import {
	createMockSupabaseClient,
	MOCK_ADMIN_ID,
	mockDatabase,
	mockUsers,
	resetMockDatabase,
} from "../mocks/supabase.js";

const originalFetch = globalThis.fetch;
const originalSupabase = getSupabase();
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
	setSupabaseClient(originalSupabase);
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

test("labels Vivid reimbursement notifications for reviewers", async () => {
	resetMockDatabase();
	setSupabaseClient(createMockSupabaseClient());
	process.env.SLACK_BOT_TOKEN = "xoxb-test";
	const adminMember = mockDatabase.members.find(
		(member) => member.user_id === MOCK_ADMIN_ID,
	);
	assert.ok(adminMember);
	adminMember.reimbursement_slack_notifications_enabled = true;

	const posts: Array<Record<string, unknown>> = [];
	globalThis.fetch = async (input, init) => {
		const url = String(input);
		const body = init?.body?.toString() ?? "";
		if (url.endsWith("/users.lookupByEmail")) {
			return new Response(
				JSON.stringify({ ok: true, user: { id: "U-reviewer" } }),
				{ status: 200 },
			);
		}
		if (url.endsWith("/conversations.open")) {
			return new Response(
				JSON.stringify({ ok: true, channel: { id: "D-reviewer" } }),
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
		requestId: "vivid-request-1",
		requesterUserId: "requester-1",
		requesterEmail: "requester@test.com",
		submissionType: "vivid_reimbursement",
		department: "Community",
		amount: 42,
		reviewUrl: "https://member-manager.test/tools/reimbursement/review",
	});

	assert.strictEqual(posts.length, 1);
	assert.match(String(posts[0].text), /New Vivid Reimbursement request/);
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

interface SlackBlockJson {
	type?: string;
	text?: { text?: string };
	elements?: Array<{
		type?: string;
		text?: string | { text?: string };
		url?: string;
		action_id?: string;
	}>;
}

interface PostedSlackMessage {
	channel?: string;
	text?: string;
	blocks?: SlackBlockJson[];
}

function mockRequesterSlackApi(): PostedSlackMessage[] {
	const posts: PostedSlackMessage[] = [];
	globalThis.fetch = async (input, init) => {
		const url = String(input);
		const body = init?.body?.toString() ?? "";

		if (url.endsWith("/users.lookupByEmail")) {
			return new Response(
				JSON.stringify({ ok: true, user: { id: "U-requester" } }),
				{ status: 200 },
			);
		}

		if (url.endsWith("/conversations.open")) {
			return new Response(
				JSON.stringify({ ok: true, channel: { id: "D-requester" } }),
				{ status: 200 },
			);
		}

		if (url.endsWith("/chat.postMessage")) {
			posts.push(JSON.parse(body) as PostedSlackMessage);
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		}

		return new Response("not found", { status: 404 });
	};
	return posts;
}

/** Every mrkdwn string rendered by the blocks (sections and context). */
function blockTexts(blocks: SlackBlockJson[] | undefined): string[] {
	return (blocks ?? []).flatMap((block) => [
		...(block.text?.text ? [block.text.text] : []),
		...(block.elements ?? []).flatMap((element) =>
			typeof element.text === "string" ? [element.text] : [],
		),
	]);
}

const statusBasePayload = {
	requestId: "request-42",
	requesterUserId: "requester-1",
	requesterEmail: "requester@test.com",
	submissionType: "invoice",
	amount: 42,
	requestUrl: "https://member-manager.test/tools/reimbursement",
};

test("notifyRequesterOfReimbursementStatus shows the rejection and escaped reason in blocks", async () => {
	process.env.SLACK_BOT_TOKEN = "xoxb-test";
	const posts = mockRequesterSlackApi();

	await notifyRequesterOfReimbursementStatus({
		...statusBasePayload,
		statusType: "approval",
		statusValue: "not_approved",
		rejectionReason: "Missing <receipt> & VAT > 0, ask <!channel>",
	});

	assert.strictEqual(posts.length, 1);
	const [post] = posts;
	assert.strictEqual(post.channel, "D-requester");
	const blocks = post.blocks ?? [];

	assert.strictEqual(blocks[0]?.type, "section");
	assert.strictEqual(
		blocks[0]?.text?.text,
		"*Your Invoice request was rejected*\nAmount: 42.00 EUR",
	);
	assert.strictEqual(blocks[1]?.type, "section");
	assert.strictEqual(
		blocks[1]?.text?.text,
		"*Reason*\nMissing &lt;receipt&gt; &amp; VAT &gt; 0, ask &lt;!channel&gt;",
	);
	assert.ok(
		blockTexts(blocks).every((text) => !text.includes("<receipt>")),
		"reviewer text must not reach Slack unescaped",
	);
	assert.ok(blockTexts(blocks).includes("Request ID: request-42"));

	const actions = blocks.find((block) => block.type === "actions");
	assert.deepStrictEqual(
		actions?.elements?.map((element) => ({
			label: typeof element.text === "object" ? element.text.text : undefined,
			url: element.url,
			actionId: element.action_id,
		})),
		[
			{
				label: "View request",
				url: statusBasePayload.requestUrl,
				actionId: "open_reimbursement_tool",
			},
		],
	);

	// The text fallback is the push-notification preview.
	assert.match(post.text ?? "", /^Your Invoice request was rejected\n/);
	assert.match(post.text ?? "", /\nReason: Missing &lt;receipt&gt; &amp;/);
});

test("notifyRequesterOfReimbursementStatus keeps blocks without a request URL", async () => {
	process.env.SLACK_BOT_TOKEN = "xoxb-test";
	const posts = mockRequesterSlackApi();

	await notifyRequesterOfReimbursementStatus({
		...statusBasePayload,
		requestUrl: undefined,
		statusType: "approval",
		statusValue: "not_approved",
		rejectionReason: "   ",
	});

	assert.strictEqual(posts.length, 1);
	const blocks = posts[0].blocks ?? [];
	assert.deepStrictEqual(
		blocks.map((block) => block.type),
		["section", "section", "context"],
	);
	assert.match(blocks[0]?.text?.text ?? "", /request was rejected/);
	assert.strictEqual(blocks[1]?.text?.text, "*Reason*\nNo reason provided");
	assert.match(posts[0].text ?? "", /\nView it in Member Manager\.$/);
});

test("notifyRequesterOfReimbursementStatus announces approvals with the payout note", async () => {
	process.env.SLACK_BOT_TOKEN = "xoxb-test";
	const posts = mockRequesterSlackApi();

	await notifyRequesterOfReimbursementStatus({
		...statusBasePayload,
		submissionType: "reimbursement",
		statusType: "approval",
		statusValue: "approved",
	});

	assert.strictEqual(posts.length, 1);
	const blocks = posts[0].blocks ?? [];
	assert.deepStrictEqual(
		blocks.map((block) => block.type),
		["section", "section", "context", "actions"],
	);
	assert.strictEqual(
		blocks[0]?.text?.text,
		"*Your reimbursement request was approved*\nAmount: 42.00 EUR",
	);
	assert.strictEqual(
		blocks[1]?.text?.text,
		"Legal & Finance will mark it paid after payout.",
	);
	assert.match(posts[0].text ?? "", /^Your reimbursement request was approved/);
	assert.doesNotMatch(posts[0].text ?? "", /Reason:/);
});

test("notifyRequesterOfReimbursementStatus tells Vivid requesters no payout is needed", async () => {
	process.env.SLACK_BOT_TOKEN = "xoxb-test";
	const posts = mockRequesterSlackApi();

	await notifyRequesterOfReimbursementStatus({
		...statusBasePayload,
		submissionType: "vivid_reimbursement",
		statusType: "approval",
		statusValue: "approved",
	});

	assert.strictEqual(posts.length, 1);
	const texts = blockTexts(posts[0].blocks);
	assert.match(texts[0] ?? "", /Vivid Reimbursement request was approved/);
	assert.ok(
		texts.includes("This expense will be recorded; no payout is required."),
	);
	assert.ok(texts.every((text) => !text.includes("mark it paid")));
});

test("notifyRequesterOfReimbursementStatus announces paid requests", async () => {
	process.env.SLACK_BOT_TOKEN = "xoxb-test";
	const posts = mockRequesterSlackApi();

	await notifyRequesterOfReimbursementStatus({
		...statusBasePayload,
		statusType: "payment",
		statusValue: "paid",
	});

	assert.strictEqual(posts.length, 1);
	const blocks = posts[0].blocks ?? [];
	assert.deepStrictEqual(
		blocks.map((block) => block.type),
		["section", "context", "actions"],
	);
	assert.strictEqual(
		blocks[0]?.text?.text,
		"*Your Invoice request was marked as paid*\nAmount: 42.00 EUR",
	);
	assert.match(posts[0].text ?? "", /^Your Invoice request was marked as paid/);
});

test("notifyRequesterOfReimbursementStatus skips requesters without a Slack account", async () => {
	process.env.SLACK_BOT_TOKEN = "xoxb-test";
	const calls: string[] = [];
	globalThis.fetch = async (input) => {
		calls.push(String(input));
		return new Response(JSON.stringify({ ok: true, user: {} }), {
			status: 200,
		});
	};

	await notifyRequesterOfReimbursementStatus({
		...statusBasePayload,
		statusType: "payment",
		statusValue: "paid",
	});

	assert.deepStrictEqual(calls, ["https://slack.com/api/users.lookupByEmail"]);
});
