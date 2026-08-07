import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
	isContractEmailConfigured,
	isEmailSendingAllowed,
	sendContractPartnerEmail,
	sendContractStatusChangeEmail,
} from "../../src/lib/contractEmails.js";

// A real RESEND_API_KEY lives in server/.env.local on developer machines, and
// local dev plus E2E boot the API with it. These tests pin the guard that keeps
// those runs from sending live mail to partners.
const originalEnv = { ...process.env };

describe("email sending guard", () => {
	beforeEach(() => {
		process.env.RESEND_API_KEY = "re_live_looking_key";
		process.env.CONTRACT_EMAIL_FROM = "contracts@tum-ai.com";
		process.env.ALLOW_REAL_EMAILS = undefined;
		process.env.NODE_ENV = "development";
	});

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	test("is off outside production even with a real key configured", () => {
		assert.equal(isEmailSendingAllowed(), false);
		assert.equal(isContractEmailConfigured(), false);
	});

	test("is on in production", () => {
		process.env.NODE_ENV = "production";

		assert.equal(isEmailSendingAllowed(), true);
		assert.equal(isContractEmailConfigured(), true);
	});

	test("can be opted into for one session", () => {
		process.env.ALLOW_REAL_EMAILS = "true";

		assert.equal(isEmailSendingAllowed(), true);
		assert.equal(isContractEmailConfigured(), true);
	});

	test("refuses to reach Resend when sending is off", async () => {
		let called = false;
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async () => {
			called = true;
			return new Response("{}");
		}) as typeof fetch;

		try {
			await assert.rejects(
				() =>
					sendContractPartnerEmail({
						to: "partner@example.com",
						partnerCompanyName: "Globex SE",
						signingUrl: "https://example.test/sign/abc",
					}),
				/Refusing to send email outside production/,
			);
			await assert.rejects(
				() =>
					sendContractStatusChangeEmail({
						to: "user@test.com",
						submissionUrl: "https://example.test/contracts/1",
						fromStatus: "approved",
						toStatus: "completed",
						audience: "creator",
					}),
				/Refusing to send email outside production/,
			);
			assert.equal(called, false, "no request may reach Resend");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
