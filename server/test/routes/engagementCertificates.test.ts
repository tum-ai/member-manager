import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	resetSlackNotifier,
	setSlackNotifier,
} from "../../src/lib/slackNotifier.js";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockDatabase } from "../mocks/supabase.js";

describe("Engagement Certificate Routes", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		resetSlackNotifier();
		await closeTestApp();
	});

	test("member can submit an engagement certificate request and notify admins", async () => {
		resetDatabase();
		const notifications: Array<Record<string, string>> = [];
		setSlackNotifier(async (payload) => {
			notifications.push(payload);
		});

		try {
			const response = await app.inject({
				method: "POST",
				url: "/api/engagement-certificates",
				headers: {
					...authHeaders(testTokens.user),
					"content-type": "application/json",
				},
				payload: JSON.stringify({
					engagements: [
						{
							id: "eng-1",
							startDate: "2025-10-01",
							endDate: "2026-03-31",
							isStillActive: false,
							weeklyHours: "10",
							department: "Software Development",
							isTeamLead: false,
							tasksDescription: "Built internal tooling",
						},
					],
				}),
			});

			assert.strictEqual(response.statusCode, 201);
			const payload = JSON.parse(response.payload);
			assert.strictEqual(payload.user_id, testUserIds.user);
			assert.strictEqual(payload.status, "pending");
			assert.strictEqual(
				mockDatabase.engagement_certificate_requests.length,
				1,
			);
			assert.strictEqual(notifications.length, 1);
			assert.strictEqual(notifications[0].requestId, payload.id);
			assert.strictEqual(notifications[0].requesterUserId, testUserIds.user);
		} finally {
			resetSlackNotifier();
		}
	});

	test("member can list their own engagement certificate requests", async () => {
		resetDatabase();
		mockDatabase.engagement_certificate_requests.push(
			{
				id: "cert-1",
				user_id: testUserIds.user,
				status: "pending",
				engagements: [],
				created_at: "2026-04-24T10:00:00Z",
			},
			{
				id: "cert-2",
				user_id: testUserIds.admin,
				status: "approved",
				engagements: [],
				created_at: "2026-04-24T10:10:00Z",
			},
		);

		const response = await app.inject({
			method: "GET",
			url: "/api/engagement-certificates",
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		const payload = JSON.parse(response.payload);
		assert.strictEqual(payload.length, 1);
		assert.strictEqual(payload[0].id, "cert-1");
	});

	test("admin can review and approve an engagement certificate request", async () => {
		resetDatabase();
		mockDatabase.engagement_certificate_requests.push({
			id: "cert-approve",
			user_id: testUserIds.user,
			status: "pending",
			engagements: [
				{
					id: "eng-1",
					startDate: "2025-10-01",
					endDate: "2026-03-31",
					isStillActive: false,
					weeklyHours: "10",
					department: "Software Development",
					isTeamLead: false,
					tasksDescription: "Built internal tooling",
				},
			],
			created_at: "2026-04-24T10:00:00Z",
		});

		const response = await app.inject({
			method: "PATCH",
			url: "/api/admin/engagement-certificate-requests/cert-approve",
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				decision: "approved",
				review_note: "Approved by admin",
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const updatedRequest = mockDatabase.engagement_certificate_requests.find(
			(request) => request.id === "cert-approve",
		);
		assert.strictEqual(updatedRequest?.status, "approved");
		assert.strictEqual(updatedRequest?.review_note, "Approved by admin");
	});

	test("admin can reject an engagement certificate request", async () => {
		resetDatabase();
		mockDatabase.engagement_certificate_requests.push({
			id: "cert-reject",
			user_id: testUserIds.user,
			status: "pending",
			engagements: [],
			created_at: "2026-04-24T10:00:00Z",
		});

		const response = await app.inject({
			method: "PATCH",
			url: "/api/admin/engagement-certificate-requests/cert-reject",
			headers: {
				...authHeaders(testTokens.admin),
				"content-type": "application/json",
			},
			payload: JSON.stringify({
				decision: "rejected",
				review_note: "Missing details",
			}),
		});

		assert.strictEqual(response.statusCode, 200);
		const updatedRequest = mockDatabase.engagement_certificate_requests.find(
			(request) => request.id === "cert-reject",
		);
		assert.strictEqual(updatedRequest?.status, "rejected");
		assert.strictEqual(updatedRequest?.review_note, "Missing details");
	});
});
