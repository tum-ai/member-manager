import "../setup.js";
import assert from "node:assert";
import { afterEach, test } from "node:test";
import {
	createBugReportIssue,
	installLocalBugReportStub,
	resetBugReportIssueCreator,
	setBugReportIssueCreator,
} from "../../src/lib/githubIssues.js";
import {
	installLocalBugReportSlackStub,
	notifyBugReport,
	resetSlackNotifier,
	setBugReportSlackNotifier,
} from "../../src/lib/slackNotifier.js";

const minimalPayload = {
	reporterUserId: "user-1",
	reporterEmail: "user@test.com",
	message: "Something broke on the profile page.",
};

const bugReportSlackPayload = {
	issueNumber: 1,
	issueUrl: "https://local.invalid/issues/1",
	issueTitle: "Bug: local stub",
};

// The gate is passed explicitly to each installer, so these tests never mutate
// shared `process.env` — `node --test` runs files concurrently in one process,
// so an env toggle here would race other suites (rate-limit allowList, the real
// Slack notifier tests, getSupabase()). We still restore the module-global
// creator/notifier so nothing leaks across files.
afterEach(() => {
	resetBugReportIssueCreator();
	resetSlackNotifier();
});

test("installLocalBugReportStub installs a deterministic local issue (no network) when local", async () => {
	installLocalBugReportStub(true);

	const issue = await createBugReportIssue(minimalPayload);

	assert.deepStrictEqual(issue, {
		number: 1,
		url: "https://local.invalid/issues/1",
		title: "Bug: Something broke on the profile page.",
	});
});

test("installLocalBugReportStub leaves the active creator untouched when not local", async () => {
	const sentinel = async () => ({
		number: 99,
		url: "https://sentinel.example/issues/99",
		title: "sentinel",
	});
	setBugReportIssueCreator(sentinel);

	installLocalBugReportStub(false);

	assert.deepStrictEqual(await createBugReportIssue(minimalPayload), {
		number: 99,
		url: "https://sentinel.example/issues/99",
		title: "sentinel",
	});
});

test("installLocalBugReportSlackStub suppresses bug-report Slack posts when local", async () => {
	let posted = false;
	setBugReportSlackNotifier(async () => {
		posted = true;
	});

	// The local stub replaces the notifier with a no-op, so even a stubbed
	// `local.invalid` issue is never pushed to Slack.
	installLocalBugReportSlackStub(true);
	await notifyBugReport(bugReportSlackPayload);

	assert.strictEqual(posted, false);
});

test("installLocalBugReportSlackStub leaves the active notifier untouched when not local", async () => {
	let posted = false;
	setBugReportSlackNotifier(async () => {
		posted = true;
	});

	installLocalBugReportSlackStub(false);
	await notifyBugReport(bugReportSlackPayload);

	assert.strictEqual(posted, true);
});
