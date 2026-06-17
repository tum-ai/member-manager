import "../setup.js";
import assert from "node:assert";
import { afterEach, test } from "node:test";
import {
	createBugReportIssue,
	installLocalBugReportStub,
	resetBugReportIssueCreator,
} from "../../src/lib/githubIssues.js";

const minimalPayload = {
	reporterUserId: "user-1",
	reporterEmail: "user@test.com",
	message: "Something broke on the profile page.",
};

// Always restore the default creator so we never leak the stub into other
// server suites that assert the real GitHub path throws without credentials.
afterEach(() => {
	resetBugReportIssueCreator();
});

test("installLocalBugReportStub resolves to a deterministic local issue without network", async () => {
	installLocalBugReportStub();

	const issue = await createBugReportIssue(minimalPayload);

	assert.deepStrictEqual(issue, {
		number: 1,
		url: "https://local.invalid/issues/1",
		title: "Bug: Something broke on the profile page.",
	});
});

test("resetBugReportIssueCreator restores the default creator (throws without GitHub env)", async () => {
	installLocalBugReportStub();
	resetBugReportIssueCreator();

	await assert.rejects(
		() => createBugReportIssue(minimalPayload),
		/GitHub App configuration is incomplete/,
	);
});
