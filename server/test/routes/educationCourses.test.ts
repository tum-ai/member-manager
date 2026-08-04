import "../setup.js";
import assert from "node:assert";
import { after, before, beforeEach, describe, test } from "node:test";
import { getEducationalCourseDateOnly } from "@member-manager/shared";
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

const TARGET_USER_ID = "00000000-0000-0000-0000-000000000006";
const OTHER_USER_ID = "10000000-0000-4000-8000-000000000002";
const PERIOD_ID = "20000000-0000-4000-8000-000000000001";
const SECOND_PERIOD_ID = "20000000-0000-4000-8000-000000000002";
const APPLICATION_ID = "30000000-0000-4000-8000-000000000001";
const OTHER_APPLICATION_ID = "30000000-0000-4000-8000-000000000002";

function getMember(userId: string): Record<string, unknown> {
	const member = mockDatabase.members.find((row) => row.user_id === userId);
	assert.ok(member);
	return member;
}

function addMember(userId: string, givenName: string, surname: string): void {
	mockDatabase.members.push({
		user_id: userId,
		given_name: givenName,
		surname,
		active: true,
		member_status: "active",
		educational_course_role: null,
	});
}

function addPeriod(id: string, overrides: Record<string, unknown> = {}): void {
	mockDatabase.educational_course_periods.push({
		id,
		starts_on: "2099-04-01",
		ends_on: "2099-06-30",
		capacity: 2,
		applications_open: true,
		created_by: testUserIds.admin,
		created_at: "2026-08-04T10:00:00.000Z",
		updated_at: "2026-08-04T10:00:00.000Z",
		...overrides,
	});
}

function addApplication(
	id: string,
	periodId: string,
	userId: string,
	status: "pending" | "approved" | "rejected" = "pending",
): void {
	mockDatabase.educational_course_applications.push({
		id,
		period_id: periodId,
		applicant_user_id: userId,
		status,
		reviewed_by: status === "pending" ? null : testUserIds.admin,
		reviewed_at: status === "pending" ? null : "2026-08-04T11:00:00.000Z",
		created_at: "2026-08-04T10:30:00.000Z",
		updated_at: "2026-08-04T11:00:00.000Z",
	});
}

describe("Educational course routes", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	beforeEach(() => {
		resetDatabase();
	});

	test("keeps global admin and educational course access independent", async () => {
		const globalAdminResponse = await app.inject({
			method: "GET",
			url: "/api/education/periods",
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(globalAdminResponse.statusCode, 403);

		getMember(testUserIds.user).educational_course_role = "participant";
		const participantResponse = await app.inject({
			method: "GET",
			url: "/api/education/periods",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(participantResponse.statusCode, 200);

		const toolAccess = await app.inject({
			method: "GET",
			url: "/api/me/tool-access",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(toolAccess.statusCode, 200);
		assert.strictEqual(
			JSON.parse(toolAccess.payload).educationalCourseRole,
			"participant",
		);

		getMember(testUserIds.user).member_status = "inactive";
		getMember(testUserIds.user).active = false;
		const inactiveAccess = await app.inject({
			method: "GET",
			url: "/api/me/tool-access",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(
			JSON.parse(inactiveAccess.payload).educationalCourseRole,
			null,
		);
	});

	test("lets global admins assign and remove education administrators", async () => {
		addMember(TARGET_USER_ID, "Ada", "Lovelace");

		const invalid = await app.inject({
			method: "PUT",
			url: "/api/admin/education/administrators/not-a-uuid",
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(invalid.statusCode, 400);

		const assign = await app.inject({
			method: "PUT",
			url: `/api/admin/education/administrators/${TARGET_USER_ID}`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(assign.statusCode, 200);
		assert.deepStrictEqual(JSON.parse(assign.payload), {
			userId: TARGET_USER_ID,
			givenName: "Ada",
			surname: "Lovelace",
			active: true,
		});
		assert.strictEqual(
			getMember(TARGET_USER_ID).educational_course_role,
			"administrator",
		);

		const remove = await app.inject({
			method: "DELETE",
			url: `/api/admin/education/administrators/${TARGET_USER_ID}`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(remove.statusCode, 204);
		assert.strictEqual(getMember(TARGET_USER_ID).educational_course_role, null);
	});

	test("lets education administrators manage active and inactive participant assignments", async () => {
		getMember(testUserIds.admin).educational_course_role = "administrator";
		addMember(TARGET_USER_ID, "Ada", "Lovelace");

		const assign = await app.inject({
			method: "PUT",
			url: `/api/education/participants/${TARGET_USER_ID}`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(assign.statusCode, 200);

		const roster = await app.inject({
			method: "GET",
			url: "/api/education/participants",
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(roster.statusCode, 200);
		assert.deepStrictEqual(JSON.parse(roster.payload).participants, [
			{
				userId: TARGET_USER_ID,
				givenName: "Ada",
				surname: "Lovelace",
				active: true,
			},
		]);

		getMember(TARGET_USER_ID).member_status = "inactive";
		getMember(TARGET_USER_ID).active = false;
		const inactiveRoster = await app.inject({
			method: "GET",
			url: "/api/education/participants",
			headers: authHeaders(testTokens.admin),
		});
		assert.deepStrictEqual(JSON.parse(inactiveRoster.payload).participants, [
			{
				userId: TARGET_USER_ID,
				givenName: "Ada",
				surname: "Lovelace",
				active: false,
			},
		]);

		const remove = await app.inject({
			method: "DELETE",
			url: `/api/education/participants/${TARGET_USER_ID}`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(remove.statusCode, 204);
		assert.strictEqual(getMember(TARGET_USER_ID).educational_course_role, null);
	});

	test("scopes role-free participant candidates to education administrators", async () => {
		getMember(testUserIds.admin).educational_course_role = "administrator";
		getMember(testUserIds.user).educational_course_role = "participant";
		addMember(TARGET_USER_ID, "Ada", "Lovelace");
		addMember(OTHER_USER_ID, "Inactive", "Candidate");
		getMember(OTHER_USER_ID).member_status = "inactive";
		getMember(OTHER_USER_ID).active = false;

		const denied = await app.inject({
			method: "GET",
			url: "/api/education/participants",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(denied.statusCode, 403);

		const response = await app.inject({
			method: "GET",
			url: "/api/education/participants",
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(response.statusCode, 200);
		const payload = JSON.parse(response.payload);
		assert.deepStrictEqual(payload.candidates, [
			{
				userId: TARGET_USER_ID,
				givenName: "Ada",
				surname: "Lovelace",
				email: "",
			},
		]);
		assert.ok(
			payload.candidates.every(
				(candidate: Record<string, unknown>) =>
					!("educationalCourseRole" in candidate) &&
					!("educational_course_role" in candidate),
			),
		);
	});

	test("creates periods with camelCase JSON and only patches applicationsOpen", async () => {
		getMember(testUserIds.admin).educational_course_role = "administrator";

		const invalid = await app.inject({
			method: "POST",
			url: "/api/education/periods",
			headers: authHeaders(testTokens.admin),
			payload: {
				startsOn: "2099-06-01",
				endsOn: "2099-05-01",
				capacity: 10,
			},
		});
		assert.strictEqual(invalid.statusCode, 400);

		const startsToday = await app.inject({
			method: "POST",
			url: "/api/education/periods",
			headers: authHeaders(testTokens.admin),
			payload: {
				startsOn: getEducationalCourseDateOnly(),
				endsOn: "2099-05-01",
				capacity: 10,
			},
		});
		assert.strictEqual(startsToday.statusCode, 400);

		const create = await app.inject({
			method: "POST",
			url: "/api/education/periods",
			headers: authHeaders(testTokens.admin),
			payload: {
				startsOn: "2099-04-01",
				endsOn: "2099-06-30",
				capacity: 10,
			},
		});
		assert.strictEqual(create.statusCode, 201);
		const created = JSON.parse(create.payload);
		assert.strictEqual(created.startsOn, "2099-04-01");
		assert.strictEqual(created.endsOn, "2099-06-30");
		assert.strictEqual(created.applicationsOpen, true);
		assert.deepStrictEqual(created.approvedParticipants, []);
		assert.strictEqual(created.myApplication, null);

		const patch = await app.inject({
			method: "PATCH",
			url: `/api/education/periods/${created.id}`,
			headers: authHeaders(testTokens.admin),
			payload: { applicationsOpen: false },
		});
		assert.strictEqual(patch.statusCode, 200);
		assert.strictEqual(JSON.parse(patch.payload).applicationsOpen, false);

		const extraField = await app.inject({
			method: "PATCH",
			url: `/api/education/periods/${created.id}`,
			headers: authHeaders(testTokens.admin),
			payload: { applicationsOpen: true, capacity: 999 },
		});
		assert.strictEqual(extraField.statusCode, 400);

		mockSupabaseErrors.tables.educational_course_periods = {
			code: "23P01",
			message: "overlapping key violates exclusion constraint",
		};
		const overlap = await app.inject({
			method: "POST",
			url: "/api/education/periods",
			headers: authHeaders(testTokens.admin),
			payload: {
				startsOn: "2099-04-02",
				endsOn: "2099-04-08",
				capacity: 3,
			},
		});
		assert.strictEqual(overlap.statusCode, 409);
		delete mockSupabaseErrors.tables.educational_course_periods;
	});

	test("does not reopen applications after a period has started", async () => {
		getMember(testUserIds.admin).educational_course_role = "administrator";
		addPeriod(PERIOD_ID, {
			starts_on: getEducationalCourseDateOnly(),
			applications_open: false,
		});

		const response = await app.inject({
			method: "PATCH",
			url: `/api/education/periods/${PERIOD_ID}`,
			headers: authHeaders(testTokens.admin),
			payload: { applicationsOpen: true },
		});
		assert.strictEqual(response.statusCode, 409);
	});

	test("allows one participant to apply to several periods and exposes only own state", async () => {
		getMember(testUserIds.user).educational_course_role = "participant";
		addMember(OTHER_USER_ID, "Grace", "Hopper");
		addPeriod(PERIOD_ID);
		addPeriod(SECOND_PERIOD_ID);
		addApplication(OTHER_APPLICATION_ID, PERIOD_ID, OTHER_USER_ID, "approved");

		for (const periodId of [PERIOD_ID, SECOND_PERIOD_ID]) {
			const response = await app.inject({
				method: "POST",
				url: `/api/education/periods/${periodId}/applications`,
				headers: authHeaders(testTokens.user),
			});
			assert.strictEqual(response.statusCode, 201);
			assert.strictEqual(JSON.parse(response.payload).status, "pending");
		}
		const duplicate = await app.inject({
			method: "POST",
			url: `/api/education/periods/${PERIOD_ID}/applications`,
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(duplicate.statusCode, 409);

		const list = await app.inject({
			method: "GET",
			url: "/api/education/periods",
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(list.statusCode, 200);
		const periods = JSON.parse(list.payload).periods;
		assert.strictEqual(periods.length, 2);
		assert.ok(
			periods.every(
				(period: { myApplication: unknown }) => period.myApplication,
			),
		);
		const first = periods.find(
			(period: { id: string }) => period.id === PERIOD_ID,
		);
		assert.deepStrictEqual(first.approvedParticipants, [
			{ userId: OTHER_USER_ID, displayName: "Grace Hopper" },
		]);
	});

	test("rejects applications for closed and past periods", async () => {
		getMember(testUserIds.user).educational_course_role = "participant";
		addPeriod(PERIOD_ID, { applications_open: false });
		addPeriod(SECOND_PERIOD_ID, {
			starts_on: "2000-01-01",
			ends_on: "2099-02-01",
		});

		for (const periodId of [PERIOD_ID, SECOND_PERIOD_ID]) {
			const response = await app.inject({
				method: "POST",
				url: `/api/education/periods/${periodId}/applications`,
				headers: authHeaders(testTokens.user),
			});
			assert.strictEqual(response.statusCode, 409);
		}
	});

	test("rejects applications when a period starts today", async () => {
		getMember(testUserIds.user).educational_course_role = "participant";
		addPeriod(PERIOD_ID, {
			starts_on: getEducationalCourseDateOnly(),
			ends_on: "2099-12-31",
		});

		const response = await app.inject({
			method: "POST",
			url: `/api/education/periods/${PERIOD_ID}/applications`,
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(response.statusCode, 409);
	});

	test("only allows pending applications to be withdrawn", async () => {
		getMember(testUserIds.user).educational_course_role = "participant";
		addPeriod(PERIOD_ID);
		addPeriod(SECOND_PERIOD_ID);
		addApplication(APPLICATION_ID, PERIOD_ID, testUserIds.user, "approved");
		addApplication(
			OTHER_APPLICATION_ID,
			SECOND_PERIOD_ID,
			testUserIds.user,
			"rejected",
		);

		for (const periodId of [PERIOD_ID, SECOND_PERIOD_ID]) {
			const response = await app.inject({
				method: "DELETE",
				url: `/api/education/periods/${periodId}/applications/me`,
				headers: authHeaders(testTokens.user),
			});
			assert.strictEqual(response.statusCode, 409);
		}
		assert.strictEqual(mockDatabase.educational_course_applications.length, 2);
	});

	test("uses the review RPC for capacity and returns minimal applicant identities", async () => {
		getMember(testUserIds.admin).educational_course_role = "administrator";
		addMember(OTHER_USER_ID, "Grace", "Hopper");
		addPeriod(PERIOD_ID, { capacity: 1 });
		addApplication(APPLICATION_ID, PERIOD_ID, testUserIds.user);
		addApplication(OTHER_APPLICATION_ID, PERIOD_ID, OTHER_USER_ID, "approved");

		const full = await app.inject({
			method: "PATCH",
			url: `/api/education/applications/${APPLICATION_ID}`,
			headers: authHeaders(testTokens.admin),
			payload: { decision: "approved" },
		});
		assert.strictEqual(full.statusCode, 409);

		const reject = await app.inject({
			method: "PATCH",
			url: `/api/education/applications/${APPLICATION_ID}`,
			headers: authHeaders(testTokens.admin),
			payload: { decision: "rejected" },
		});
		assert.strictEqual(reject.statusCode, 200);
		assert.strictEqual(JSON.parse(reject.payload).status, "rejected");

		const detail = await app.inject({
			method: "GET",
			url: `/api/education/periods/${PERIOD_ID}`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(detail.statusCode, 200);
		const payload = JSON.parse(detail.payload);
		assert.strictEqual(payload.period.id, PERIOD_ID);
		assert.deepStrictEqual(
			Object.keys(payload.applications[0]).sort(),
			[
				"createdAt",
				"givenName",
				"id",
				"periodId",
				"reviewedAt",
				"status",
				"surname",
				"updatedAt",
				"userId",
			].sort(),
		);
	});

	test("withdraws own applications and safely refuses to delete used periods", async () => {
		getMember(testUserIds.user).educational_course_role = "participant";
		getMember(testUserIds.admin).educational_course_role = "administrator";
		addPeriod(PERIOD_ID);
		addPeriod(SECOND_PERIOD_ID);
		addApplication(APPLICATION_ID, PERIOD_ID, testUserIds.user);

		const usedDelete = await app.inject({
			method: "DELETE",
			url: `/api/education/periods/${PERIOD_ID}`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(usedDelete.statusCode, 409);

		const withdraw = await app.inject({
			method: "DELETE",
			url: `/api/education/periods/${PERIOD_ID}/applications/me`,
			headers: authHeaders(testTokens.user),
		});
		assert.strictEqual(withdraw.statusCode, 204);
		assert.strictEqual(mockDatabase.educational_course_applications.length, 0);

		const safeDelete = await app.inject({
			method: "DELETE",
			url: `/api/education/periods/${SECOND_PERIOD_ID}`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(safeDelete.statusCode, 204);
	});
});
