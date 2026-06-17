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

const savedEnv = {
	SUPABASE_URL: process.env.SUPABASE_URL,
	ENABLE_LOCAL_ADMIN_BOOTSTRAP: process.env.ENABLE_LOCAL_ADMIN_BOOTSTRAP,
	NODE_ENV: process.env.NODE_ENV,
};

function setEnv(key: keyof typeof savedEnv, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[key];
	} else {
		process.env[key] = value;
	}
}

// `installLocalBugReportStub()` self-guards on `isLocalAdminBootstrapEnabled()`,
// which requires a non-production NODE_ENV + the explicit bootstrap flag + a
// loopback SUPABASE_URL.
function enableLocalStack(): void {
	setEnv("NODE_ENV", undefined);
	setEnv("ENABLE_LOCAL_ADMIN_BOOTSTRAP", "true");
	setEnv("SUPABASE_URL", "http://127.0.0.1:54321");
}

// Restore the default creator AND the env so the stub/flags never leak into
// other server suites that assert the real GitHub path throws without creds.
afterEach(() => {
	resetBugReportIssueCreator();
	setEnv("SUPABASE_URL", savedEnv.SUPABASE_URL);
	setEnv("ENABLE_LOCAL_ADMIN_BOOTSTRAP", savedEnv.ENABLE_LOCAL_ADMIN_BOOTSTRAP);
	setEnv("NODE_ENV", savedEnv.NODE_ENV);
});

test("installLocalBugReportStub resolves to a deterministic local issue without network", async () => {
	enableLocalStack();
	installLocalBugReportStub();

	const issue = await createBugReportIssue(minimalPayload);

	assert.deepStrictEqual(issue, {
		number: 1,
		url: "https://local.invalid/issues/1",
		title: "Bug: Something broke on the profile page.",
	});
});

test("resetBugReportIssueCreator restores the default creator (throws without GitHub env)", async () => {
	enableLocalStack();
	installLocalBugReportStub();
	resetBugReportIssueCreator();

	await assert.rejects(
		() => createBugReportIssue(minimalPayload),
		/GitHub App configuration is incomplete/,
	);
});

test("installLocalBugReportStub is a no-op when the local stack gate is closed", async () => {
	// Production gate closed: the stub must NOT replace the real creator, so the
	// default (network) path stays active and throws without GitHub credentials.
	setEnv("NODE_ENV", "production");

	installLocalBugReportStub();

	await assert.rejects(
		() => createBugReportIssue(minimalPayload),
		/GitHub App configuration is incomplete/,
	);
});
