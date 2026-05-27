import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	decryptRecord,
	SENSITIVE_SEPA_FIELDS,
} from "../../src/lib/sensitiveData.js";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	mockMemberPayload,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockDatabase } from "../mocks/supabase.js";

function restoreEnvVar(
	key: "SUPABASE_URL" | "LOCAL_ADMIN_EMAILS" | "ENABLE_LOCAL_ADMIN_BOOTSTRAP",
	previousValue: string | undefined,
) {
	if (previousValue === undefined) {
		delete process.env[key];
		return;
	}
	process.env[key] = previousValue;
}

describe("Members Routes", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	describe("POST /api/members", () => {
		test("creates member for authenticated user", async () => {
			resetDatabase();
			// Use a token whose user is not present in the seeded members so we
			// exercise the member-creation path.
			const newUserId = testUserIds.otherUser;
			const payload = mockMemberPayload({
				user_id: newUserId,
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders(testTokens.otherUser),
					"content-type": "application/json",
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.email, "other@test.com");
			const storedMember = mockDatabase.members.find(
				(member) => member.user_id === newUserId,
			);
			assert.ok(storedMember);
			assert.match(String(storedMember?.date_of_birth), /^enc-v1:/);
			assert.match(String(storedMember?.street), /^enc-v1:/);
			assert.match(String(storedMember?.city), /^enc-v1:/);
		});

		test("creation applies self-service department and ignores role/status", async () => {
			resetDatabase();
			const newUserId = testUserIds.otherUser;
			const payload = mockMemberPayload({
				user_id: newUserId,
				department: "Legal & Finance",
				member_role: "President",
				active: false,
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders(testTokens.otherUser),
					"content-type": "application/json",
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.department, "Legal & Finance");
			assert.strictEqual(data.member_role, "Member");
			assert.strictEqual(data.active, true);

			const storedMember = mockDatabase.members.find(
				(member) => member.user_id === newUserId,
			);
			assert.ok(storedMember);
			assert.strictEqual(storedMember?.department, "Legal & Finance");
			assert.strictEqual(storedMember?.member_role, "Member");
			assert.strictEqual(storedMember?.active, true);
		});

		test("returns existing member if already exists", async () => {
			resetDatabase();
			const payload = mockMemberPayload({
				user_id: testUserIds.user,
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.user_id, testUserIds.user);
		});

		test("rejects missing auth header", async () => {
			resetDatabase();
			const payload = mockMemberPayload();

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: { "content-type": "application/json" },
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("rejects invalid token", async () => {
			resetDatabase();
			const payload = mockMemberPayload();

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders("invalid-token"),
					"content-type": "application/json",
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("rejects user_id mismatch", async () => {
			resetDatabase();
			const payload = mockMemberPayload({
				user_id: testUserIds.otherUser,
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 403);
			const data = JSON.parse(response.payload);
			assert.match(data.error, /mismatch/i);
		});

		test("rejects invalid date_of_birth", async () => {
			resetDatabase();
			const payload = mockMemberPayload({
				user_id: testUserIds.user,
				date_of_birth: "1995-02-31",
			});

			const response = await app.inject({
				method: "POST",
				url: "/api/members",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(payload),
			});

			assert.strictEqual(response.statusCode, 400);
		});
	});

	describe("GET /api/members/:userId", () => {
		test("owner can view own profile", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.user_id, testUserIds.user);
			assert.strictEqual(data.email, "user@test.com");
		});

		test("admin can view any profile", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}`,
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.user_id, testUserIds.user);
		});

		test("user cannot view other's profile", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.otherUser}`,
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("returns 404 for non-existent member", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members/non-existent-id",
				headers: authHeaders(testTokens.admin),
			});

			assert.strictEqual(response.statusCode, 404);
		});

		test("rejects unauthenticated request", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: `/api/members/${testUserIds.user}`,
			});

			assert.strictEqual(response.statusCode, 401);
		});
	});

	describe("GET /api/members", () => {
		test("authenticated user can retrieve member list", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.ok(Array.isArray(data));
			assert.strictEqual(data.length, 2);
		});

		test("rejects unauthenticated request", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members",
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("returns active and alumni members, but not inactive members", async () => {
			resetDatabase();
			mockDatabase.members.push(
				{
					user_id: "alumni-member",
					given_name: "Al",
					surname: "Alumni",
					active: false,
					member_status: "alumni",
					department: "Community",
					member_role: "Member",
				},
				{
					user_id: "inactive-member",
					given_name: "Ina",
					surname: "Inactive",
					active: false,
					member_status: "inactive",
					department: "Community",
					member_role: "Member",
				},
			);

			const response = await app.inject({
				method: "GET",
				url: "/api/members",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.ok(
				data.every((member: { member_status: string }) =>
					["active", "alumni"].includes(member.member_status),
				),
			);
			assert.ok(
				data.some(
					(member: { user_id: string }) => member.user_id === "alumni-member",
				),
			);
			assert.ok(
				data.every(
					(member: { user_id: string }) => member.user_id !== "inactive-member",
				),
			);
		});

		test("returns correct fields", async () => {
			resetDatabase();
			const memberWithResearchDepartment = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			if (!memberWithResearchDepartment) {
				throw new Error("Expected test member to exist");
			}
			memberWithResearchDepartment.department = "Research";

			const response = await app.inject({
				method: "GET",
				url: "/api/members",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			const member = data[0];
			assert.ok("user_id" in member);
			assert.ok("given_name" in member);
			assert.ok("surname" in member);
			assert.ok("email" in member);
			assert.ok("batch" in member);
			assert.ok("department" in member);
			assert.ok("member_role" in member);
			assert.ok("board_role" in member);
			assert.ok("degree" in member);
			assert.ok("school" in member);
			assert.ok("active" in member);
			assert.ok("linkedin_profile_url" in member);
			assert.ok("public_location" in member);
			const normalizedMember = data.find(
				(entry: { user_id: string }) => entry.user_id === testUserIds.user,
			);
			assert.strictEqual(normalizedMember.department, "Research");
		});

		test("members are sorted by surname ascending", async () => {
			resetDatabase();
			const response = await app.inject({
				method: "GET",
				url: "/api/members",
				headers: authHeaders(testTokens.user),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			for (let i = 0; i < data.length - 1; i++) {
				assert.ok(data[i].surname.localeCompare(data[i + 1].surname) <= 0);
			}
		});
	});

	describe("POST /api/members/bootstrap-local-admin", () => {
		test("returns 404 when local admin bootstrap is not explicitly enabled", async () => {
			resetDatabase();
			const previousSupabaseUrl = process.env.SUPABASE_URL;
			const previousEnableLocalAdminBootstrap =
				process.env.ENABLE_LOCAL_ADMIN_BOOTSTRAP;
			process.env.SUPABASE_URL = "http://127.0.0.1:54321";
			delete process.env.ENABLE_LOCAL_ADMIN_BOOTSTRAP;

			try {
				const response = await app.inject({
					method: "POST",
					url: "/api/members/bootstrap-local-admin",
					headers: authHeaders(testTokens.user),
				});

				assert.strictEqual(response.statusCode, 404);
			} finally {
				restoreEnvVar("SUPABASE_URL", previousSupabaseUrl);
				restoreEnvVar(
					"ENABLE_LOCAL_ADMIN_BOOTSTRAP",
					previousEnableLocalAdminBootstrap,
				);
			}
		});

		test("promotes an allowlisted local user to admin", async () => {
			resetDatabase();
			const previousSupabaseUrl = process.env.SUPABASE_URL;
			const previousLocalAdminEmails = process.env.LOCAL_ADMIN_EMAILS;
			const previousEnableLocalAdminBootstrap =
				process.env.ENABLE_LOCAL_ADMIN_BOOTSTRAP;
			process.env.SUPABASE_URL = "http://127.0.0.1:54321";
			process.env.ENABLE_LOCAL_ADMIN_BOOTSTRAP = "true";
			process.env.LOCAL_ADMIN_EMAILS = "user@test.com";

			try {
				const response = await app.inject({
					method: "POST",
					url: "/api/members/bootstrap-local-admin",
					headers: authHeaders(testTokens.user),
				});

				assert.strictEqual(response.statusCode, 200);
				const payload = JSON.parse(response.payload);
				assert.strictEqual(payload.role, "admin");
				assert.strictEqual(payload.granted, true);
				assert.deepStrictEqual(
					mockDatabase.user_roles.find(
						(row) => row.user_id === testUserIds.user,
					),
					{ user_id: testUserIds.user, role: "admin" },
				);
			} finally {
				restoreEnvVar("SUPABASE_URL", previousSupabaseUrl);
				restoreEnvVar("LOCAL_ADMIN_EMAILS", previousLocalAdminEmails);
				restoreEnvVar(
					"ENABLE_LOCAL_ADMIN_BOOTSTRAP",
					previousEnableLocalAdminBootstrap,
				);
			}
		});

		test("backfills local admin profile bank details for browser testing", async () => {
			resetDatabase();
			const previousSupabaseUrl = process.env.SUPABASE_URL;
			const previousLocalAdminEmails = process.env.LOCAL_ADMIN_EMAILS;
			const previousEnableLocalAdminBootstrap =
				process.env.ENABLE_LOCAL_ADMIN_BOOTSTRAP;
			process.env.SUPABASE_URL = "http://127.0.0.1:54321";
			process.env.ENABLE_LOCAL_ADMIN_BOOTSTRAP = "true";
			process.env.LOCAL_ADMIN_EMAILS = "admin@test.com";

			try {
				assert.strictEqual(
					mockDatabase.sepa.some((row) => row.user_id === testUserIds.admin),
					false,
				);

				const response = await app.inject({
					method: "POST",
					url: "/api/members/bootstrap-local-admin",
					headers: authHeaders(testTokens.admin),
				});

				assert.strictEqual(response.statusCode, 200);
				const storedSepa = mockDatabase.sepa.find(
					(row) => row.user_id === testUserIds.admin,
				);
				assert.ok(storedSepa);
				assert.match(String(storedSepa.iban), /^enc-v1:/);
				assert.deepStrictEqual(
					decryptRecord(storedSepa, SENSITIVE_SEPA_FIELDS),
					{
						user_id: testUserIds.admin,
						iban: "DE89370400440532013000",
						bic: "COBADEFFXXX",
						bank_name: "Commerzbank",
						mandate_agreed: true,
						privacy_agreed: true,
					},
				);
				assert.deepStrictEqual(
					mockDatabase.member_agreements.find(
						(row) => row.user_id === testUserIds.admin,
					),
					{
						user_id: testUserIds.admin,
						sepa_mandate_agreed: true,
						privacy_policy_agreed: true,
						data_privacy_notice_agreed: true,
						updated_at: mockDatabase.member_agreements.find(
							(row) => row.user_id === testUserIds.admin,
						)?.updated_at,
					},
				);
			} finally {
				restoreEnvVar("SUPABASE_URL", previousSupabaseUrl);
				restoreEnvVar("LOCAL_ADMIN_EMAILS", previousLocalAdminEmails);
				restoreEnvVar(
					"ENABLE_LOCAL_ADMIN_BOOTSTRAP",
					previousEnableLocalAdminBootstrap,
				);
			}
		});

		test("does not promote users outside the local admin allowlist", async () => {
			resetDatabase();
			const previousSupabaseUrl = process.env.SUPABASE_URL;
			const previousLocalAdminEmails = process.env.LOCAL_ADMIN_EMAILS;
			const previousEnableLocalAdminBootstrap =
				process.env.ENABLE_LOCAL_ADMIN_BOOTSTRAP;
			process.env.SUPABASE_URL = "http://127.0.0.1:54321";
			process.env.ENABLE_LOCAL_ADMIN_BOOTSTRAP = "true";
			process.env.LOCAL_ADMIN_EMAILS = "someone-else@example.com";

			try {
				const response = await app.inject({
					method: "POST",
					url: "/api/members/bootstrap-local-admin",
					headers: authHeaders(testTokens.user),
				});

				assert.strictEqual(response.statusCode, 403);
				const payload = JSON.parse(response.payload);
				assert.match(payload.error, /allowlist/i);
				assert.deepStrictEqual(
					mockDatabase.user_roles.find(
						(row) => row.user_id === testUserIds.user,
					),
					{ user_id: testUserIds.user, role: "user" },
				);
			} finally {
				restoreEnvVar("SUPABASE_URL", previousSupabaseUrl);
				restoreEnvVar("LOCAL_ADMIN_EMAILS", previousLocalAdminEmails);
				restoreEnvVar(
					"ENABLE_LOCAL_ADMIN_BOOTSTRAP",
					previousEnableLocalAdminBootstrap,
				);
			}
		});
	});

	describe("PUT /api/members/:userId", () => {
		test("owner can update own profile", async () => {
			resetDatabase();
			const updatePayload = {
				given_name: "Updated",
				surname: "Name",
				street: "Updated Street",
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.email, "user@test.com");
			assert.strictEqual(data.given_name, "Updated");
			assert.strictEqual(data.street, "Updated Street");
			const storedMember = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			assert.ok(storedMember);
			assert.match(String(storedMember?.street), /^enc-v1:/);
		});

		test("owner can update LinkedIn and current-work profile fields", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					linkedin_profile_url: "https://linkedin.com/in/example-profile",
					public_location: "Munich, Germany",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(
				data.linkedin_profile_url,
				"https://linkedin.com/in/example-profile",
			);

			const storedMember = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			assert.strictEqual(storedMember?.public_location, "Munich, Germany");
		});

		test("rejects non-LinkedIn profile URLs", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					linkedin_profile_url: "https://example.com/in/example-profile",
				}),
			});

			assert.strictEqual(response.statusCode, 400);
		});

		test("admin can update any profile", async () => {
			resetDatabase();
			const updatePayload = {
				given_name: "AdminUpdated",
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.email, "user@test.com");
		});

		test("admin can update own department and role through the profile route", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.admin}`,
				headers: {
					...authHeaders(testTokens.admin),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					department: "Legal & Finance",
					member_role: "President",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const data = JSON.parse(response.payload);
			assert.strictEqual(data.member_role, "President");
			assert.strictEqual(data.department, null);

			const storedMember = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.admin,
			);
			assert.strictEqual(storedMember?.member_role, "President");
			assert.strictEqual(storedMember?.department, null);
		});

		test("user cannot update other's profile", async () => {
			resetDatabase();
			const updatePayload = {
				given_name: "Hacker",
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.otherUser}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 403);
		});

		test("rejects unauthenticated request", async () => {
			resetDatabase();
			const updatePayload = {
				given_name: "Test",
			};

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: { "content-type": "application/json" },
				payload: JSON.stringify(updatePayload),
			});

			assert.strictEqual(response.statusCode, 401);
		});

		test("user-facing PUT silently ignores member_role (admin-only field)", async () => {
			// Regression: self-service profile save must not let users escalate
			// their own role. Role changes go through PATCH /admin/members/:id/role.
			resetDatabase();
			const storedBefore = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			const originalRole = storedBefore?.member_role;

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					given_name: "Self",
					member_role: "President",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const storedAfter = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			assert.strictEqual(storedAfter?.member_role, originalRole);
			const body = JSON.parse(response.payload);
			assert.notStrictEqual(body.member_role, "President");
		});

		test("user-facing PUT lets members update their own department", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					given_name: "Self",
					department: "Legal & Finance",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const storedAfter = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			assert.strictEqual(storedAfter?.department, "Legal & Finance");
			const body = JSON.parse(response.payload);
			assert.strictEqual(body.department, "Legal & Finance");
		});

		test("research members can set their own research project", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					department: "Research",
					research_project_id: "project-a",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const storedAfter = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			assert.strictEqual(storedAfter?.department, "Research");
			assert.strictEqual(storedAfter?.research_project_id, "project-a");
			const body = JSON.parse(response.payload);
			assert.strictEqual(body.research_project_id, "project-a");
		});

		test("leaving Research clears the selected research project", async () => {
			resetDatabase();
			const storedBefore = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			if (storedBefore) {
				storedBefore.department = "Research";
				storedBefore.research_project_id = "project-a";
			}

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					department: "Community",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const storedAfter = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			assert.strictEqual(storedAfter?.department, "Community");
			assert.strictEqual(storedAfter?.research_project_id, null);
		});

		test("user-facing PUT lets members update their own batch", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					given_name: "Self",
					batch: "SS25",
				}),
			});

			assert.strictEqual(response.statusCode, 200);
			const storedAfter = mockDatabase.members.find(
				(member) => member.user_id === testUserIds.user,
			);
			assert.strictEqual(storedAfter?.batch, "SS25");
			const body = JSON.parse(response.payload);
			assert.strictEqual(body.batch, "SS25");
		});

		test("rejects invalid batch formats", async () => {
			resetDatabase();

			const response = await app.inject({
				method: "PUT",
				url: `/api/members/${testUserIds.user}`,
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					batch: "WS25/26",
				}),
			});

			assert.strictEqual(response.statusCode, 400);
		});
	});
});
