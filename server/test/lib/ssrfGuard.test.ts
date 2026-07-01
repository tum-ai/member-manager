import assert from "node:assert";
import { test } from "node:test";
import {
	assertUrlAllowed,
	isUrlAllowed,
	SsrfBlockedError,
} from "../../src/lib/ssrfGuard.js";

test("isUrlAllowed permits exact allowlisted hosts (https only)", () => {
	const opts = { allowedHosts: ["hooks.slack.com"] };
	assert.strictEqual(
		isUrlAllowed("https://hooks.slack.com/services/T/B/x", opts),
		true,
	);
	assert.strictEqual(
		isUrlAllowed("https://HOOKS.SLACK.COM/services/x", opts),
		true,
	);
});

test("isUrlAllowed permits subdomains via host suffix", () => {
	const opts = {
		allowedHosts: ["hooks.slack.com"],
		allowedHostSuffixes: [".slack.com"],
	};
	assert.strictEqual(isUrlAllowed("https://files.slack.com/x", opts), true);
});

test("isUrlAllowed blocks non-allowlisted hosts", () => {
	const opts = {
		allowedHosts: ["hooks.slack.com"],
		allowedHostSuffixes: [".slack.com"],
	};
	assert.strictEqual(isUrlAllowed("https://evil.example.com/x", opts), false);
	assert.strictEqual(isUrlAllowed("https://169.254.169.254/", opts), false);
});

test("isUrlAllowed blocks suffix-spoofing hosts", () => {
	const opts = {
		allowedHosts: [],
		allowedHostSuffixes: [".slack.com"],
	};
	// "evilslack.com" must not match ".slack.com".
	assert.strictEqual(isUrlAllowed("https://evilslack.com/x", opts), false);
	assert.strictEqual(
		isUrlAllowed("https://slack.com.attacker.test/x", opts),
		false,
	);
});

test("isUrlAllowed blocks non-https protocols by default", () => {
	const opts = { allowedHosts: ["hooks.slack.com"] };
	assert.strictEqual(isUrlAllowed("http://hooks.slack.com/x", opts), false);
	assert.strictEqual(isUrlAllowed("file:///etc/passwd", opts), false);
});

test("isUrlAllowed honours custom allowed protocols", () => {
	const opts = {
		allowedHosts: ["hooks.slack.com"],
		allowedProtocols: ["http:", "https:"],
	};
	assert.strictEqual(isUrlAllowed("http://hooks.slack.com/x", opts), true);
});

test("isUrlAllowed returns false for unparsable input", () => {
	assert.strictEqual(
		isUrlAllowed("not a url", { allowedHosts: ["hooks.slack.com"] }),
		false,
	);
});

test("isUrlAllowed accepts a URL instance", () => {
	const opts = { allowedHosts: ["hooks.slack.com"] };
	assert.strictEqual(
		isUrlAllowed(new URL("https://hooks.slack.com/x"), opts),
		true,
	);
});

test("assertUrlAllowed returns parsed URL when allowed", () => {
	const url = assertUrlAllowed("https://hooks.slack.com/x", {
		allowedHosts: ["hooks.slack.com"],
	});
	assert.strictEqual(url.hostname, "hooks.slack.com");
});

test("assertUrlAllowed throws SsrfBlockedError when blocked", () => {
	assert.throws(
		() =>
			assertUrlAllowed("https://evil.example.com/x", {
				allowedHosts: ["hooks.slack.com"],
			}),
		SsrfBlockedError,
	);
});
