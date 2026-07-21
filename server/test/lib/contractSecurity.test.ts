import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { getAppBaseUrl } from "../../src/lib/contracts/contractSecurity.js";

const originalAppBaseUrl = process.env.APP_BASE_URL;

afterEach(() => {
	if (originalAppBaseUrl === undefined) {
		delete process.env.APP_BASE_URL;
		return;
	}
	process.env.APP_BASE_URL = originalAppBaseUrl;
});

describe("contract security", () => {
	test("removes trailing slashes from configured and request origins", () => {
		process.env.APP_BASE_URL = "https://configured.example////";
		assert.equal(
			getAppBaseUrl({ headers: { origin: "https://ignored.example/" } }),
			"https://configured.example",
		);

		delete process.env.APP_BASE_URL;
		assert.equal(
			getAppBaseUrl({
				headers: { origin: `https://request.example${"/".repeat(20_000)}` },
			}),
			"https://request.example",
		);
	});

	test("handles a long slash run followed by a non-slash in linear time", {
		timeout: 2_000,
	}, () => {
		delete process.env.APP_BASE_URL;
		const origin = `https://request.example/${"/".repeat(100_000)}x`;
		assert.equal(getAppBaseUrl({ headers: { origin } }), origin);
	});
});
