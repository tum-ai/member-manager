import "../setup.js";
import assert from "node:assert";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, test } from "node:test";
import {
	createBugReportIssue,
	resetBugReportIssueCreator,
} from "../../src/lib/githubIssues.js";

const originalEnv = {
	githubAppId: process.env.GITHUB_APP_ID,
	githubAppInstallationId: process.env.GITHUB_APP_INSTALLATION_ID,
	githubAppPrivateKey: process.env.GITHUB_APP_PRIVATE_KEY,
	githubAppPrivateKeyBase64: process.env.GITHUB_APP_PRIVATE_KEY_BASE64,
	bugReportGithubRepository: process.env.BUG_REPORT_GITHUB_REPOSITORY,
	bugReportGithubOwner: process.env.BUG_REPORT_GITHUB_OWNER,
	bugReportGithubRepo: process.env.BUG_REPORT_GITHUB_REPO,
	bugReportGithubLabels: process.env.BUG_REPORT_GITHUB_LABELS,
	bugReportAssigneesJson: process.env.BUG_REPORT_ASSIGNEES_JSON,
	bugReportGithubAssignees: process.env.BUG_REPORT_GITHUB_ASSIGNEES,
	bugReportSlackAssignees: process.env.BUG_REPORT_SLACK_ASSIGNEES,
};
const originalFetch = globalThis.fetch;

function restoreEnv(name: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[name];
		return;
	}

	process.env[name] = value;
}

function getHeader(headers: HeadersInit | undefined, name: string): string {
	if (!headers) {
		return "";
	}
	if (headers instanceof Headers) {
		return headers.get(name) ?? "";
	}
	if (Array.isArray(headers)) {
		const match = headers.find(
			([headerName]) => headerName.toLowerCase() === name.toLowerCase(),
		);
		return match?.[1] ?? "";
	}

	return headers[name] ?? "";
}

afterEach(() => {
	restoreEnv("GITHUB_APP_ID", originalEnv.githubAppId);
	restoreEnv("GITHUB_APP_INSTALLATION_ID", originalEnv.githubAppInstallationId);
	restoreEnv("GITHUB_APP_PRIVATE_KEY", originalEnv.githubAppPrivateKey);
	restoreEnv(
		"GITHUB_APP_PRIVATE_KEY_BASE64",
		originalEnv.githubAppPrivateKeyBase64,
	);
	restoreEnv(
		"BUG_REPORT_GITHUB_REPOSITORY",
		originalEnv.bugReportGithubRepository,
	);
	restoreEnv("BUG_REPORT_GITHUB_OWNER", originalEnv.bugReportGithubOwner);
	restoreEnv("BUG_REPORT_GITHUB_REPO", originalEnv.bugReportGithubRepo);
	restoreEnv("BUG_REPORT_GITHUB_LABELS", originalEnv.bugReportGithubLabels);
	restoreEnv("BUG_REPORT_ASSIGNEES_JSON", originalEnv.bugReportAssigneesJson);
	restoreEnv(
		"BUG_REPORT_GITHUB_ASSIGNEES",
		originalEnv.bugReportGithubAssignees,
	);
	restoreEnv("BUG_REPORT_SLACK_ASSIGNEES", originalEnv.bugReportSlackAssignees);
	globalThis.fetch = originalFetch;
	resetBugReportIssueCreator();
});

test("createBugReportIssue creates and assigns a GitHub issue via GitHub App auth", async () => {
	const { privateKey } = generateKeyPairSync("rsa", {
		modulusLength: 2048,
		privateKeyEncoding: { format: "pem", type: "pkcs8" },
		publicKeyEncoding: { format: "pem", type: "spki" },
	});
	const calls: Array<{ init?: RequestInit; url: string }> = [];

	process.env.GITHUB_APP_ID = "12345";
	process.env.GITHUB_APP_INSTALLATION_ID = "67890";
	process.env.GITHUB_APP_PRIVATE_KEY = privateKey.replace(/\n/g, "\\n");
	process.env.BUG_REPORT_GITHUB_REPOSITORY = "tum-ai/member-manager";
	process.env.BUG_REPORT_GITHUB_LABELS = "bug, reported-via-app";
	process.env.BUG_REPORT_ASSIGNEES_JSON = JSON.stringify([
		{ github: "alice", slackId: "U123" },
		{ github: "bob", slackId: "U456" },
	]);

	globalThis.fetch = async (input, init) => {
		const url = String(input);
		calls.push({ url, init });

		if (url.endsWith("/app/installations/67890/access_tokens")) {
			return new Response(
				JSON.stringify({
					token: "installation-token",
					expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
				}),
				{ status: 201 },
			);
		}

		if (url.endsWith("/repos/tum-ai/member-manager/issues")) {
			return new Response(
				JSON.stringify({
					number: 321,
					html_url: "https://github.com/tum-ai/member-manager/issues/321",
					title: "Bug: Cannot save profile",
				}),
				{ status: 201 },
			);
		}

		if (url.endsWith("/repos/tum-ai/member-manager/issues/321/assignees")) {
			return new Response(JSON.stringify({ assignees: [{ login: "alice" }] }), {
				status: 201,
			});
		}

		return new Response("not found", { status: 404 });
	};

	const issue = await createBugReportIssue({
		reporterUserId: "user-1",
		reporterEmail: "user@test.com",
		message: "Cannot save profile after changing department.",
		stepsToReproduce: "Open profile. Change department. Save.",
		pageUrl: "https://members.tum-ai.com/profile",
		userAgent: "node-test-agent",
	});

	assert.deepStrictEqual(issue, {
		number: 321,
		url: "https://github.com/tum-ai/member-manager/issues/321",
		title: "Bug: Cannot save profile",
		assignee: { githubUsername: "alice", slackId: "U123" },
	});
	assert.strictEqual(calls.length, 3);
	assert.match(
		getHeader(calls[0].init?.headers, "Authorization"),
		/^Bearer .+\..+\..+$/,
	);
	assert.strictEqual(
		getHeader(calls[1].init?.headers, "Authorization"),
		"Bearer installation-token",
	);

	const createdIssue = JSON.parse(String(calls[1].init?.body));
	assert.strictEqual(
		createdIssue.title,
		"Bug: Cannot save profile after changing department.",
	);
	assert.match(createdIssue.body, /## What happened/);
	assert.match(createdIssue.body, /Reporter: `user@\u200btest\.com`/);
	assert.deepStrictEqual(createdIssue.labels, ["bug", "reported-via-app"]);

	const assignment = JSON.parse(String(calls[2].init?.body));
	assert.deepStrictEqual(assignment, { assignees: ["alice"] });
});
