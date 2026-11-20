import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockDatabase, mockSupabaseErrors } from "../mocks/supabase.js";

const noBank = {
	iban: "",
	bic: "",
	bank_name: "",
	mandate_agreed: false,
	privacy_agreed: false,
};

// The seeded member already has bank details, which can be edited but not
// cleared, so saves that are not about bank details send them back unchanged.
const keptBank = {
	iban: "DE89370400440532013000",
	bic: "COBADEFFXXX",
	bank_name: "Test Bank",
	mandate_agreed: true,
	privacy_agreed: true,
};

describe("Profile routes", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	function get(userId: string, token: string) {
		return app.inject({
			method: "GET",
			url: `/api/profile/${userId}`,
			headers: authHeaders(token),
		});
	}

	function put(userId: string, token: string, body: unknown) {
		return app.inject({
			method: "PUT",
			url: `/api/profile/${userId}`,
			headers: { ...authHeaders(token), "content-type": "application/json" },
			payload: JSON.stringify(body),
		});
	}

	async function loadVersion(userId: string, token: string): Promise<number> {
		return JSON.parse((await get(userId, token)).payload).version;
	}

	describe("GET /api/profile/:userId", () => {
		test("returns member, bank details, version and completeness", async () => {
			resetDatabase();
			const response = await get(testUserIds.user, testTokens.user);

			assert.strictEqual(response.statusCode, 200);
			const profile = JSON.parse(response.payload);
			assert.strictEqual(profile.member.given_name, "Test");
			assert.strictEqual(profile.member.email, "user@test.com");
			assert.strictEqual(profile.sepa.iban, "DE89370400440532013000");
			assert.strictEqual(profile.sepa.mandate_agreed, true);
			assert.strictEqual(typeof profile.version, "number");
			assert.ok(profile.version >= 1);
			assert.strictEqual(typeof profile.completeness.percent, "number");
			assert.ok(Array.isArray(profile.completeness.missing));
		});

		test("does not count values that are not stored (no batch, no consent decision)", async () => {
			resetDatabase();
			const member = mockDatabase.members.find(
				(m) => m.user_id === testUserIds.user,
			);
			assert.ok(member);
			member.batch = null;

			const profile = JSON.parse(
				(await get(testUserIds.user, testTokens.user)).payload,
			);
			assert.ok(profile.completeness.missing.includes("TUM.ai batch"));
		});

		test("a member without bank details gets blank bank fields", async () => {
			resetDatabase();
			mockDatabase.sepa = mockDatabase.sepa.filter(
				(row) => row.user_id !== testUserIds.user,
			);

			const profile = JSON.parse(
				(await get(testUserIds.user, testTokens.user)).payload,
			);
			assert.strictEqual(profile.sepa.iban, "");
			assert.ok(profile.completeness.missing.includes("IBAN"));
		});

		test("members cannot read someone else's profile, admins can", async () => {
			resetDatabase();
			assert.strictEqual(
				(await get(testUserIds.admin, testTokens.user)).statusCode,
				403,
			);
			assert.strictEqual(
				(await get(testUserIds.user, testTokens.admin)).statusCode,
				200,
			);
		});

		test("requires authentication", async () => {
			const response = await app.inject({
				method: "GET",
				url: `/api/profile/${testUserIds.user}`,
			});
			assert.strictEqual(response.statusCode, 401);
		});
	});

	describe("PUT /api/profile/:userId", () => {
		test("round-trips batch, salutation and title (#397) and bumps the version", async () => {
			resetDatabase();
			const version = await loadVersion(testUserIds.user, testTokens.user);

			const response = await put(testUserIds.user, testTokens.user, {
				version,
				member: { batch: "SS25", salutation: "Mrs", title: "Dr" },
				sepa: keptBank,
			});

			assert.strictEqual(response.statusCode, 200);
			const saved = JSON.parse(response.payload);
			assert.strictEqual(saved.member.batch, "SS25");
			assert.strictEqual(saved.member.salutation, "Mrs");
			assert.strictEqual(saved.member.title, "Dr");
			assert.ok(saved.version > version);

			const reloaded = JSON.parse(
				(await get(testUserIds.user, testTokens.user)).payload,
			);
			assert.strictEqual(reloaded.member.batch, "SS25");
			assert.strictEqual(reloaded.member.salutation, "Mrs");
			assert.strictEqual(reloaded.version, saved.version);
		});

		test("merges: keys that are not sent stay as stored", async () => {
			resetDatabase();
			const version = await loadVersion(testUserIds.user, testTokens.user);

			await put(testUserIds.user, testTokens.user, {
				version,
				member: { city: "Garching" },
				sepa: keptBank,
			});

			const stored = mockDatabase.members.find(
				(m) => m.user_id === testUserIds.user,
			);
			assert.match(String(stored?.city), /^enc-v1:/);
			assert.strictEqual(stored?.batch, "WS23");
			assert.strictEqual(stored?.degree, "B.Sc.");
			assert.strictEqual(stored?.salutation, "Mr");
		});

		test("encrypts sensitive member fields at rest", async () => {
			resetDatabase();
			const version = await loadVersion(testUserIds.user, testTokens.user);
			await put(testUserIds.user, testTokens.user, {
				version,
				member: { street: "Secret Street 1", date_of_birth: "1999-09-09" },
				sepa: keptBank,
			});

			const stored = mockDatabase.members.find(
				(m) => m.user_id === testUserIds.user,
			);
			assert.match(String(stored?.street), /^enc-v1:/);
			assert.match(String(stored?.date_of_birth), /^enc-v1:/);
			assert.ok(!JSON.stringify(stored).includes("Secret Street"));
		});

		test("members cannot set role or department, admins can", async () => {
			resetDatabase();
			let version = await loadVersion(testUserIds.user, testTokens.user);
			const asMember = await put(testUserIds.user, testTokens.user, {
				version,
				member: { member_role: "President", department: "Marketing" },
				sepa: keptBank,
			});
			assert.strictEqual(asMember.statusCode, 200);
			const stored = mockDatabase.members.find(
				(m) => m.user_id === testUserIds.user,
			);
			assert.strictEqual(stored?.member_role, "Member");
			assert.strictEqual(stored?.department, "Software Development");

			version = await loadVersion(testUserIds.user, testTokens.admin);
			const asAdmin = await put(testUserIds.user, testTokens.admin, {
				version,
				member: { member_role: "Team Lead", department: "Marketing" },
				sepa: keptBank,
			});
			assert.strictEqual(asAdmin.statusCode, 200);
			assert.strictEqual(stored?.member_role, "Team Lead");
			assert.strictEqual(stored?.department, "Marketing");
		});

		test("rejects a stale version with 412, the current profile, and writes nothing", async () => {
			resetDatabase();
			const staleVersion = await loadVersion(testUserIds.user, testTokens.user);
			// Someone else saves first.
			await put(testUserIds.user, testTokens.admin, {
				version: staleVersion,
				member: { given_name: "Changed Elsewhere" },
				sepa: keptBank,
			});

			const response = await put(testUserIds.user, testTokens.user, {
				version: staleVersion,
				member: { given_name: "Stale Edit", batch: "SS26" },
				sepa: keptBank,
			});

			assert.strictEqual(response.statusCode, 412);
			const body = JSON.parse(response.payload);
			assert.strictEqual(body.code, "profile_version_conflict");
			assert.strictEqual(body.current.member.given_name, "Changed Elsewhere");
			assert.ok(body.current.version > staleVersion);
			const stored = mockDatabase.members.find(
				(m) => m.user_id === testUserIds.user,
			);
			assert.strictEqual(stored?.given_name, "Changed Elsewhere");
			assert.strictEqual(stored?.batch, "WS23");
		});

		test("saves bank details encrypted and agreements together", async () => {
			resetDatabase();
			mockDatabase.sepa = mockDatabase.sepa.filter(
				(row) => row.user_id !== testUserIds.user,
			);
			const version = await loadVersion(testUserIds.user, testTokens.user);

			const response = await put(testUserIds.user, testTokens.user, {
				version,
				member: {},
				sepa: {
					iban: "de89 3704 0044 0532 0130 00",
					bic: "COBADEFFXXX",
					bank_name: "Test Bank",
					mandate_agreed: true,
					privacy_agreed: true,
				},
			});

			assert.strictEqual(response.statusCode, 200);
			const saved = JSON.parse(response.payload);
			assert.strictEqual(saved.sepa.iban, "DE89370400440532013000");
			const stored = mockDatabase.sepa.find(
				(row) => row.user_id === testUserIds.user,
			);
			assert.match(String(stored?.iban), /^enc-v1:/);
			assert.match(String(stored?.bank_name), /^enc-v1:/);
		});

		test("an agreements-only save never creates a sepa row", async () => {
			resetDatabase();
			mockDatabase.sepa = mockDatabase.sepa.filter(
				(row) => row.user_id !== testUserIds.user,
			);
			const version = await loadVersion(testUserIds.user, testTokens.user);

			const response = await put(testUserIds.user, testTokens.user, {
				version,
				member: {},
				sepa: { ...noBank, privacy_agreed: false, mandate_agreed: false },
			});

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(
				mockDatabase.sepa.some((row) => row.user_id === testUserIds.user),
				false,
			);
		});

		test("refuses to clear bank details that are already saved", async () => {
			resetDatabase();
			// The seeded row is plain text; the presence check does not care.
			const version = await loadVersion(testUserIds.user, testTokens.user);

			const response = await put(testUserIds.user, testTokens.user, {
				version,
				member: { batch: "SS26" },
				sepa: noBank,
			});

			assert.strictEqual(response.statusCode, 400);
			assert.match(
				JSON.parse(response.payload).error,
				/Bank details can't be removed once saved/,
			);
			const stored = mockDatabase.members.find(
				(m) => m.user_id === testUserIds.user,
			);
			assert.strictEqual(stored?.batch, "WS23");
		});

		test("does not touch the Data Privacy Notice consents unless answered", async () => {
			resetDatabase();
			const agreements = mockDatabase.member_agreements.find(
				(row) => row.user_id === testUserIds.user,
			);
			assert.ok(agreements);
			agreements.data_privacy_notice_agreed = false;
			agreements.website_profile_consent = true;
			const version = await loadVersion(testUserIds.user, testTokens.user);

			await put(testUserIds.user, testTokens.user, {
				version,
				member: {},
				sepa: {
					iban: "DE89370400440532013000",
					bic: "COBADEFFXXX",
					bank_name: "Test Bank",
					mandate_agreed: true,
					privacy_agreed: true,
				},
			});

			assert.strictEqual(agreements.website_profile_consent, true);
			assert.strictEqual(agreements.data_privacy_notice_agreed, false);
		});

		test("rejects invalid input with 400", async () => {
			resetDatabase();
			const version = await loadVersion(testUserIds.user, testTokens.user);
			for (const member of [
				{ batch: "XX99" },
				{ date_of_birth: "2024-02-31" },
				{ linkedin_profile_url: "https://example.com/in/ada" },
			]) {
				const response = await put(testUserIds.user, testTokens.user, {
					version,
					member,
					sepa: keptBank,
				});
				assert.strictEqual(response.statusCode, 400, JSON.stringify(member));
			}
			const missingVersion = await put(testUserIds.user, testTokens.user, {
				member: {},
				sepa: keptBank,
			});
			assert.strictEqual(missingVersion.statusCode, 400);
		});

		test("the first save of a member without a row creates it (version 0)", async () => {
			resetDatabase();
			const userId = testUserIds.otherUser;
			assert.strictEqual(
				mockDatabase.members.some((m) => m.user_id === userId),
				false,
			);

			const initial = JSON.parse(
				(await get(userId, testTokens.otherUser)).payload,
			);
			assert.strictEqual(initial.version, 0);

			const created = await put(userId, testTokens.otherUser, {
				version: 0,
				member: { given_name: "New", surname: "Joiner", batch: "SS25" },
				sepa: noBank,
			});
			assert.strictEqual(created.statusCode, 200);
			const saved = JSON.parse(created.payload);
			assert.ok(saved.version >= 1);
			assert.strictEqual(saved.member.given_name, "New");
			assert.strictEqual(saved.member.batch, "SS25");

			// A second "first save" is stale: the row exists now.
			const again = await put(userId, testTokens.otherUser, {
				version: 0,
				member: { given_name: "Twice" },
				sepa: noBank,
			});
			assert.strictEqual(again.statusCode, 412);
			const stored = mockDatabase.members.find((m) => m.user_id === userId);
			assert.strictEqual(stored?.given_name, "New");
		});

		test("a committed save still answers 200 when the email lookup fails", async () => {
			resetDatabase();
			// An id the auth lookup has not cached, so it really calls listUsers.
			const userId = "00000000-0000-4000-8000-0000000000aa";
			mockSupabaseErrors.authListUsers = { message: "auth is down" };
			try {
				const response = await put(userId, testTokens.admin, {
					version: 0,
					member: { given_name: "Saved" },
					sepa: noBank,
				});
				assert.strictEqual(response.statusCode, 200);
				const saved = JSON.parse(response.payload);
				assert.strictEqual(saved.member.given_name, "Saved");
				assert.strictEqual(saved.member.email, "");
			} finally {
				mockSupabaseErrors.authListUsers = null;
			}
			assert.ok(mockDatabase.members.some((m) => m.user_id === userId));
		});

		test("a plain read still fails when the email lookup fails", async () => {
			resetDatabase();
			const userId = "00000000-0000-4000-8000-0000000000bb";
			mockSupabaseErrors.authListUsers = { message: "auth is down" };
			try {
				const response = await get(userId, testTokens.admin);
				assert.strictEqual(response.statusCode, 500);
			} finally {
				mockSupabaseErrors.authListUsers = null;
			}
		});

		test("members cannot save someone else's profile", async () => {
			resetDatabase();
			const response = await put(testUserIds.admin, testTokens.user, {
				version: 1,
				member: {},
				sepa: keptBank,
			});
			assert.strictEqual(response.statusCode, 403);
		});

		test("a failing transaction answers 500 and leaves the profile untouched", async () => {
			resetDatabase();
			const version = await loadVersion(testUserIds.user, testTokens.user);
			mockSupabaseErrors.rpc.save_member_profile = { message: "boom" };
			try {
				const response = await put(testUserIds.user, testTokens.user, {
					version,
					member: { batch: "SS26" },
					sepa: keptBank,
				});
				assert.strictEqual(response.statusCode, 500);
			} finally {
				delete mockSupabaseErrors.rpc.save_member_profile;
			}
			const stored = mockDatabase.members.find(
				(m) => m.user_id === testUserIds.user,
			);
			assert.strictEqual(stored?.batch, "WS23");
		});
	});
});
