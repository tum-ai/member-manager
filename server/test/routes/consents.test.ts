import "../setup.js";
import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockDatabase } from "../mocks/supabase.js";

const decision = {
	privacy_policy_agreed: true,
	website_profile_consent: false,
	event_photos_consent: true,
	partner_sharing_consent: true,
};

function agreementRow(userId: string) {
	return mockDatabase.member_agreements.find((row) => row.user_id === userId);
}

describe("member consents", () => {
	before(async () => {
		await getTestApp();
	});
	afterEach(() => {
		resetDatabase();
	});
	after(async () => {
		await closeTestApp();
	});

	describe("GET /api/members/:userId/consents", () => {
		it("returns the member's stored consents", async () => {
			const app = await getTestApp();
			const res = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}/consents`,
				headers: authHeaders(testTokens.user),
			});
			assert.equal(res.statusCode, 200);
			assert.deepEqual(res.json(), {
				privacy_policy_agreed: true,
				website_profile_consent: true,
				event_photos_consent: true,
				partner_sharing_consent: true,
				consents_decided_at: "2024-01-01T00:00:00Z",
			});
		});

		it("reports an undecided member when there is no agreements row", async () => {
			const app = await getTestApp();
			// MOCK_ADMIN_ID has no member_agreements row.
			const res = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.admin}/consents`,
				headers: authHeaders(testTokens.admin),
			});
			assert.equal(res.statusCode, 200);
			assert.deepEqual(res.json(), {
				privacy_policy_agreed: false,
				website_profile_consent: false,
				event_photos_consent: false,
				partner_sharing_consent: false,
				consents_decided_at: null,
			});
		});

		it("lets an admin read another member's consents", async () => {
			const app = await getTestApp();
			const res = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}/consents`,
				headers: authHeaders(testTokens.admin),
			});
			assert.equal(res.statusCode, 200);
			assert.equal(res.json().partner_sharing_consent, true);
		});

		it("forbids another member from reading them", async () => {
			const app = await getTestApp();
			const res = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}/consents`,
				headers: authHeaders(testTokens.otherUser),
			});
			assert.equal(res.statusCode, 403);
		});

		it("requires authentication", async () => {
			const app = await getTestApp();
			const res = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}/consents`,
			});
			assert.equal(res.statusCode, 401);
		});
	});

	describe("PUT /api/members/:userId/consents", () => {
		it("creates the agreements row for an undecided member and marks the decision", async () => {
			const app = await getTestApp();
			const before = Date.now();
			const res = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.otherUser}/consents`,
				headers: authHeaders(testTokens.otherUser),
				payload: decision,
			});
			assert.equal(res.statusCode, 200);
			const body = res.json();
			assert.equal(body.website_profile_consent, false);
			assert.equal(body.partner_sharing_consent, true);
			assert.ok(Date.parse(body.consents_decided_at) >= before);

			const row = agreementRow(testUserIds.otherUser);
			assert.ok(row);
			assert.equal(row.partner_sharing_consent, true);
			assert.equal(row.event_photos_consent, true);
			assert.equal(row.website_profile_consent, false);
			// The summary column is left to the DB trigger.
			assert.equal("data_privacy_notice_agreed" in row, false);
		});

		it("records refusals and keeps unrelated agreement fields", async () => {
			const app = await getTestApp();
			const res = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}/consents`,
				headers: authHeaders(testTokens.user),
				payload: {
					privacy_policy_agreed: true,
					website_profile_consent: false,
					event_photos_consent: false,
					partner_sharing_consent: false,
				},
			});
			assert.equal(res.statusCode, 200);
			assert.equal(res.json().partner_sharing_consent, false);

			const row = agreementRow(testUserIds.user);
			assert.equal(row?.partner_sharing_consent, false);
			// The SEPA mandate isn't part of this decision and must survive it.
			assert.equal(row?.sepa_mandate_agreed, true);
		});

		it("rejects a decision that leaves a purpose out", async () => {
			const app = await getTestApp();
			const { partner_sharing_consent: _omitted, ...partial } = decision;
			const res = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}/consents`,
				headers: authHeaders(testTokens.user),
				payload: partial,
			});
			assert.equal(res.statusCode, 400);
			assert.equal(
				agreementRow(testUserIds.user)?.website_profile_consent,
				true,
			);
		});

		it("forbids changing someone else's consents, even as an admin", async () => {
			const app = await getTestApp();
			for (const token of [testTokens.otherUser, testTokens.admin]) {
				const res = await app.inject({
					method: "PUT",
					url: `/api/members/${testUserIds.user}/consents`,
					headers: authHeaders(token),
					payload: decision,
				});
				assert.equal(res.statusCode, 403);
			}
			assert.equal(
				agreementRow(testUserIds.user)?.website_profile_consent,
				true,
			);
		});
	});
});
