import "../setup.js";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import { mockDatabase } from "../mocks/supabase.js";

const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const COMMUNITY_PROJECT_ID = "10000000-0000-4000-8000-000000000002";
const PLAN_ITEM_ID = "20000000-0000-4000-8000-000000000001";
const COMMUNITY_PLAN_ITEM_ID = "20000000-0000-4000-8000-000000000002";

function seedDepartmentFinanceMember(): void {
	mockDatabase.members.push({
		user_id: testUserIds.otherUser,
		department: "Makeathon",
		member_status: "active",
		active: true,
	});
	mockDatabase.department_permissions.push({
		department: "Makeathon",
		permissions: ["finance.department"],
	});
}

function seedMakeathonMapping(): void {
	mockDatabase.finance_department_mappings.push({
		cost_location: "161",
		department: "Makeathon",
		bereich: "wirtschaftlich",
		note: null,
	});
}

async function findMakeathonVenue(app: FastifyInstance) {
	const response = await app.inject({
		method: "GET",
		url: "/api/finance/buchhaltungsbutler/transactions?date_from=2026-05-04&date_to=2026-05-04",
		headers: authHeaders(testTokens.admin),
	});
	assert.strictEqual(response.statusCode, 200);
	const payload = JSON.parse(response.payload);
	const posting = payload.transactions.find(
		(row: { postingtext: string }) => row.postingtext === "Makeathon venue",
	);
	assert.ok(posting);
	return posting as { external_id: string; transaction_amount: number };
}

describe("Finance management routes", async () => {
	let app: FastifyInstance;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		await closeTestApp();
	});

	beforeEach(() => {
		resetDatabase();
		process.env.NODE_ENV = "test";
		delete process.env.BUCHHALTUNGSBUTLER_POSTINGS_USE_REAL_API;
		delete process.env.BB_USE_REAL_API;
	});

	test("creates projects and assigns reusable plan templates", async () => {
		const projectResponse = await app.inject({
			method: "POST",
			url: "/api/finance/projects",
			headers: authHeaders(testTokens.admin),
			payload: {
				name: "Makeathon 2026",
				department: "Makeathon",
				period_type: "year",
				period_key: "2026",
				tax_area: "wirtschaftlich",
				target_amount: -20_000,
				status: "active",
			},
		});
		assert.strictEqual(projectResponse.statusCode, 201);
		const project = JSON.parse(projectResponse.payload);

		const templateResponse = await app.inject({
			method: "POST",
			url: "/api/finance/plan-templates",
			headers: authHeaders(testTokens.admin),
			payload: {
				name: "Event baseline",
				tax_area: "wirtschaftlich",
			},
		});
		assert.strictEqual(templateResponse.statusCode, 201);
		const template = JSON.parse(templateResponse.payload);

		const itemResponse = await app.inject({
			method: "POST",
			url: `/api/finance/plan-templates/${template.id}/items`,
			headers: authHeaders(testTokens.admin),
			payload: {
				label: "Venue",
				category: "Venue",
				planned_amount: 5000,
				expected_month: "2026-05",
			},
		});
		assert.strictEqual(itemResponse.statusCode, 201);

		const assignmentResponse = await app.inject({
			method: "POST",
			url: `/api/finance/projects/${project.id}/template-assignments`,
			headers: authHeaders(testTokens.admin),
			payload: { template_id: template.id },
		});
		assert.strictEqual(assignmentResponse.statusCode, 201);
		const assignment = JSON.parse(assignmentResponse.payload);
		assert.strictEqual(assignment.created_plan_items.length, 1);
		assert.strictEqual(assignment.created_plan_items[0].project_id, project.id);
		assert.strictEqual(assignment.created_plan_items[0].planned_amount, 5000);

		seedDepartmentFinanceMember();
		const scopedList = await app.inject({
			method: "GET",
			url: "/api/finance/projects?department=Makeathon&period_type=year&period_key=2026",
			headers: authHeaders(testTokens.otherUser),
		});
		assert.strictEqual(scopedList.statusCode, 200);
		assert.deepStrictEqual(
			JSON.parse(scopedList.payload).projects.map(
				(row: { department: string }) => row.department,
			),
			["Makeathon"],
		);
	});

	test("rejects project scope changes once dependent finance rows exist", async (t) => {
		const project = {
			id: PROJECT_ID,
			parent_project_id: null,
			name: "Makeathon 2026",
			department: "Makeathon",
			period_type: "year",
			period_key: "2026",
			tax_area: "wirtschaftlich",
			target_amount: -20_000,
			status: "active",
			description: null,
			created_at: "2026-01-01T00:00:00.000Z",
			updated_at: "2026-01-01T00:00:00.000Z",
		};
		const dependencies = [
			{
				name: "child project",
				seed: () =>
					mockDatabase.finance_projects.push({
						...project,
						id: COMMUNITY_PROJECT_ID,
						parent_project_id: PROJECT_ID,
						name: "Child project",
					}),
			},
			{
				name: "plan item",
				seed: () =>
					mockDatabase.finance_plan_items.push({
						id: PLAN_ITEM_ID,
						project_id: PROJECT_ID,
					}),
			},
			{
				name: "posting allocation",
				seed: () =>
					mockDatabase.finance_posting_allocations.push({
						id: "30000000-0000-4000-8000-000000000001",
						project_id: PROJECT_ID,
					}),
			},
			{
				name: "template assignment",
				seed: () =>
					mockDatabase.finance_project_template_assignments.push({
						id: "40000000-0000-4000-8000-000000000001",
						project_id: PROJECT_ID,
					}),
			},
			{
				name: "reimbursement finance link",
				seed: () =>
					mockDatabase.reimbursements.push({
						id: "50000000-0000-4000-8000-000000000001",
						finance_project_id: PROJECT_ID,
					}),
			},
			{
				name: "pending reallocation target",
				seed: () =>
					mockDatabase.finance_reallocation_request_items.push({
						id: "60000000-0000-4000-8000-000000000001",
						project_id: PROJECT_ID,
					}),
			},
		];

		for (const dependency of dependencies) {
			await t.test(dependency.name, async () => {
				resetDatabase();
				mockDatabase.finance_projects.push({ ...project });
				dependency.seed();

				const response = await app.inject({
					method: "PATCH",
					url: `/api/finance/projects/${PROJECT_ID}`,
					headers: authHeaders(testTokens.admin),
					payload: { department: "Community" },
				});

				assert.strictEqual(response.statusCode, 409, response.payload);
				assert.match(JSON.parse(response.payload).error, /dependent finance/i);
				assert.strictEqual(
					mockDatabase.finance_projects.find((row) => row.id === PROJECT_ID)
						?.department,
					"Makeathon",
				);
			});
		}

		await t.test("fiscal period change", async () => {
			resetDatabase();
			mockDatabase.finance_projects.push({ ...project });
			mockDatabase.finance_plan_items.push({
				id: PLAN_ITEM_ID,
				project_id: PROJECT_ID,
			});

			const response = await app.inject({
				method: "PATCH",
				url: `/api/finance/projects/${PROJECT_ID}`,
				headers: authHeaders(testTokens.admin),
				payload: { period_key: "2027" },
			});

			assert.strictEqual(response.statusCode, 409, response.payload);
			assert.strictEqual(
				mockDatabase.finance_projects.find((row) => row.id === PROJECT_ID)
					?.period_key,
				"2026",
			);
		});
	});

	test("allows no-op scope values and non-structural project edits with dependencies", async () => {
		mockDatabase.finance_projects.push({
			id: PROJECT_ID,
			parent_project_id: null,
			name: "Makeathon 2026",
			department: "Makeathon",
			period_type: "year",
			period_key: "2026",
			tax_area: "wirtschaftlich",
			target_amount: -20_000,
			status: "active",
			description: null,
			created_at: "2026-01-01T00:00:00.000Z",
			updated_at: "2026-01-01T00:00:00.000Z",
		});
		mockDatabase.finance_plan_items.push({
			id: PLAN_ITEM_ID,
			project_id: PROJECT_ID,
		});

		const response = await app.inject({
			method: "PATCH",
			url: `/api/finance/projects/${PROJECT_ID}`,
			headers: authHeaders(testTokens.admin),
			payload: {
				name: "Makeathon 2026 revised",
				department: "Makeathon",
				period_type: "year",
				period_key: "2026",
				tax_area: "ideell",
				target_amount: -15_000,
			},
		});

		assert.strictEqual(response.statusCode, 200, response.payload);
		const updated = JSON.parse(response.payload);
		assert.strictEqual(updated.name, "Makeathon 2026 revised");
		assert.strictEqual(updated.department, "Makeathon");
		assert.strictEqual(updated.period_key, "2026");
		assert.strictEqual(updated.tax_area, "ideell");
		assert.strictEqual(updated.target_amount, -15_000);
	});

	test("allows project scope changes before dependent finance rows exist", async () => {
		mockDatabase.finance_projects.push({
			id: PROJECT_ID,
			parent_project_id: null,
			name: "Makeathon 2026",
			department: "Makeathon",
			period_type: "year",
			period_key: "2026",
			tax_area: "wirtschaftlich",
			target_amount: -20_000,
			status: "active",
			description: null,
			created_at: "2026-01-01T00:00:00.000Z",
			updated_at: "2026-01-01T00:00:00.000Z",
		});

		const response = await app.inject({
			method: "PATCH",
			url: `/api/finance/projects/${PROJECT_ID}`,
			headers: authHeaders(testTokens.admin),
			payload: {
				department: "Community",
				period_type: "semester",
				period_key: "SS26",
			},
		});

		assert.strictEqual(response.statusCode, 200, response.payload);
		const updated = JSON.parse(response.payload);
		assert.strictEqual(updated.department, "Community");
		assert.strictEqual(updated.period_type, "semester");
		assert.strictEqual(updated.period_key, "SS26");
	});

	test("replaces split allocations and approves department reallocation requests", async () => {
		seedMakeathonMapping();
		const posting = await findMakeathonVenue(app);

		const allocationResponse = await app.inject({
			method: "PUT",
			url: `/api/finance/posting-allocations/${posting.external_id}`,
			headers: authHeaders(testTokens.admin),
			payload: {
				allocations: [
					{ department: "Makeathon", percentage: 60 },
					{ department: "Community", percentage: 40 },
				],
			},
		});
		assert.strictEqual(allocationResponse.statusCode, 200);
		assert.deepStrictEqual(
			JSON.parse(allocationResponse.payload).allocations.map(
				(row: { department: string; allocated_amount: number }) => [
					row.department,
					row.allocated_amount,
				],
			),
			[
				["Community", -1920],
				["Makeathon", -2880],
			],
		);

		seedDepartmentFinanceMember();
		const scopedResponse = await app.inject({
			method: "GET",
			url: `/api/finance/posting-allocations/${posting.external_id}`,
			headers: authHeaders(testTokens.otherUser),
		});
		assert.strictEqual(scopedResponse.statusCode, 200);
		assert.deepStrictEqual(
			JSON.parse(scopedResponse.payload).allocations.map(
				(row: { department: string }) => row.department,
			),
			["Makeathon"],
		);

		const requestResponse = await app.inject({
			method: "POST",
			url: "/api/finance/reallocation-requests",
			headers: authHeaders(testTokens.otherUser),
			payload: {
				posting_external_id: posting.external_id,
				reason: "Charge the complete venue to the event",
				allocations: [{ department: "Makeathon", percentage: 100 }],
			},
		});
		assert.strictEqual(requestResponse.statusCode, 201);
		const reallocation = JSON.parse(requestResponse.payload);
		assert.strictEqual(reallocation.status, "pending");

		const duplicateRequestResponse = await app.inject({
			method: "POST",
			url: "/api/finance/reallocation-requests",
			headers: authHeaders(testTokens.otherUser),
			payload: {
				posting_external_id: posting.external_id,
				reason: "Submit a competing decision",
				allocations: [{ department: "Makeathon", percentage: 100 }],
			},
		});
		assert.strictEqual(duplicateRequestResponse.statusCode, 409);

		const reviewResponse = await app.inject({
			method: "POST",
			url: `/api/finance/reallocation-requests/${reallocation.id}/review`,
			headers: authHeaders(testTokens.admin),
			payload: { decision: "approved", review_note: "Confirmed" },
		});
		assert.strictEqual(reviewResponse.statusCode, 200);
		assert.strictEqual(JSON.parse(reviewResponse.payload).status, "approved");
		assert.deepStrictEqual(
			mockDatabase.finance_posting_allocations.map((row) => row.department),
			["Makeathon"],
		);
		assert.strictEqual(
			mockDatabase.finance_posting_allocations[0].allocated_amount,
			posting.transaction_amount,
		);
	});

	test("rejects a reallocation without requiring the BB posting", async () => {
		const requestId = "90000000-0000-4000-8000-000000000001";
		const now = new Date().toISOString();
		mockDatabase.finance_reallocation_requests.push({
			id: requestId,
			posting_external_id: "BB-DELETED",
			requesting_department: "Makeathon",
			reason: "Posting no longer exists in BB",
			status: "pending",
			allocation_snapshot: [],
			requested_by: "00000000-0000-0000-0000-000000000001",
			reviewed_by: null,
			review_note: null,
			reviewed_at: null,
			created_at: now,
			updated_at: now,
		});

		const response = await app.inject({
			method: "POST",
			url: `/api/finance/reallocation-requests/${requestId}/review`,
			headers: authHeaders(testTokens.admin),
			payload: { decision: "rejected", review_note: "Posting removed" },
		});

		assert.strictEqual(response.statusCode, 200, response.payload);
		assert.strictEqual(JSON.parse(response.payload).status, "rejected");
	});

	test("rejects duplicate allocation targets before persistence", async () => {
		seedMakeathonMapping();
		const posting = await findMakeathonVenue(app);
		const allocations = [
			{ department: " Makeathon ", percentage: 60 },
			{ department: "Makeathon", percentage: 40 },
		];

		const replacement = await app.inject({
			method: "PUT",
			url: `/api/finance/posting-allocations/${posting.external_id}`,
			headers: authHeaders(testTokens.admin),
			payload: { allocations },
		});
		assert.strictEqual(replacement.statusCode, 400);
		assert.strictEqual(mockDatabase.finance_posting_allocations.length, 0);

		const reallocation = await app.inject({
			method: "POST",
			url: "/api/finance/reallocation-requests",
			headers: authHeaders(testTokens.admin),
			payload: {
				posting_external_id: posting.external_id,
				requesting_department: "Makeathon",
				reason: "Duplicate split",
				allocations,
			},
		});
		assert.strictEqual(reallocation.statusCode, 400);
		assert.strictEqual(mockDatabase.finance_reallocation_requests.length, 0);
		assert.strictEqual(
			mockDatabase.finance_reallocation_request_items.length,
			0,
		);
	});

	test("rejects stale reallocation approvals after allocations change", async () => {
		seedMakeathonMapping();
		const posting = await findMakeathonVenue(app);
		const initialAllocation = await app.inject({
			method: "PUT",
			url: `/api/finance/posting-allocations/${posting.external_id}`,
			headers: authHeaders(testTokens.admin),
			payload: {
				allocations: [
					{ department: "Makeathon", percentage: 60 },
					{ department: "Community", percentage: 40 },
				],
			},
		});
		assert.strictEqual(initialAllocation.statusCode, 200);

		const requestResponse = await app.inject({
			method: "POST",
			url: "/api/finance/reallocation-requests",
			headers: authHeaders(testTokens.admin),
			payload: {
				posting_external_id: posting.external_id,
				requesting_department: "Makeathon",
				reason: "Move the complete posting",
				allocations: [{ department: "Makeathon", percentage: 100 }],
			},
		});
		assert.strictEqual(requestResponse.statusCode, 201);
		const request = JSON.parse(requestResponse.payload);

		const changedAllocation = await app.inject({
			method: "PUT",
			url: `/api/finance/posting-allocations/${posting.external_id}`,
			headers: authHeaders(testTokens.admin),
			payload: {
				allocations: [
					{ department: "Makeathon", percentage: 50 },
					{ department: "Community", percentage: 50 },
				],
			},
		});
		assert.strictEqual(changedAllocation.statusCode, 200);

		const reviewResponse = await app.inject({
			method: "POST",
			url: `/api/finance/reallocation-requests/${request.id}/review`,
			headers: authHeaders(testTokens.admin),
			payload: { decision: "approved" },
		});
		assert.strictEqual(reviewResponse.statusCode, 409);
		assert.match(JSON.parse(reviewResponse.payload).error, /stale/i);
	});

	test("rejects allocations to projects outside the posting period", async () => {
		seedMakeathonMapping();
		mockDatabase.finance_projects.push({
			id: PROJECT_ID,
			parent_project_id: null,
			name: "Makeathon 2025",
			department: "Makeathon",
			period_type: "year",
			period_key: "2025",
			tax_area: "wirtschaftlich",
			target_amount: -20_000,
			status: "active",
			description: null,
			created_at: "2025-01-01T00:00:00.000Z",
			updated_at: "2025-01-01T00:00:00.000Z",
		});
		const posting = await findMakeathonVenue(app);

		const response = await app.inject({
			method: "PUT",
			url: `/api/finance/posting-allocations/${posting.external_id}`,
			headers: authHeaders(testTokens.admin),
			payload: {
				allocations: [{ project_id: PROJECT_ID, percentage: 100 }],
			},
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(JSON.parse(response.payload).error, /project period/i);
	});

	test("requests and atomically approves a department budget transfer", async () => {
		const sourceBudget = await app.inject({
			method: "PUT",
			url: "/api/finance/budgets",
			headers: authHeaders(testTokens.admin),
			payload: {
				department: "Makeathon",
				period_type: "year",
				period_key: "2026",
				amount_planned: 10_000,
			},
		});
		assert.strictEqual(sourceBudget.statusCode, 200);

		const createdResponse = await app.inject({
			method: "POST",
			url: "/api/finance/budget-transfer-requests",
			headers: authHeaders(testTokens.admin),
			payload: {
				source_department: "Makeathon",
				target_department: "Community",
				period_type: "year",
				period_key: "2026",
				amount: 2500,
				reason: "Move unused event budget",
			},
		});
		assert.strictEqual(
			createdResponse.statusCode,
			201,
			createdResponse.payload,
		);
		const created = JSON.parse(createdResponse.payload);

		const reviewResponse = await app.inject({
			method: "POST",
			url: `/api/finance/budget-transfer-requests/${created.id}/review`,
			headers: authHeaders(testTokens.admin),
			payload: { decision: "approved", review_note: "Approved by Finance" },
		});
		assert.strictEqual(reviewResponse.statusCode, 200);
		assert.strictEqual(JSON.parse(reviewResponse.payload).status, "approved");

		const budgetsResponse = await app.inject({
			method: "GET",
			url: "/api/finance/budgets?period_type=year&period_key=2026",
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(budgetsResponse.statusCode, 200);
		const budgets = JSON.parse(budgetsResponse.payload).rows;
		assert.strictEqual(
			budgets.find(
				(row: { department: string }) => row.department === "Makeathon",
			)?.amount_planned,
			7500,
		);
		assert.strictEqual(
			budgets.find(
				(row: { department: string }) => row.department === "Community",
			)?.amount_planned,
			2500,
		);
	});

	test("forces department viewers to request transfers from their own budget", async () => {
		seedDepartmentFinanceMember();
		const response = await app.inject({
			method: "POST",
			url: "/api/finance/budget-transfer-requests",
			headers: authHeaders(testTokens.otherUser),
			payload: {
				source_department: "Community",
				target_department: "Research",
				period_type: "year",
				period_key: "2026",
				amount: 500,
				reason: "Cross-department attempt",
			},
		});

		assert.strictEqual(response.statusCode, 403);
	});

	test("matches plan items and returns reconciliation and period reports", async () => {
		seedMakeathonMapping();
		mockDatabase.finance_projects.push({
			id: PROJECT_ID,
			parent_project_id: null,
			name: "Makeathon 2026",
			department: "Makeathon",
			period_type: "year",
			period_key: "2026",
			tax_area: "wirtschaftlich",
			target_amount: -20_000,
			status: "active",
			description: null,
			created_at: "2026-01-01T00:00:00.000Z",
			updated_at: "2026-01-01T00:00:00.000Z",
		});
		mockDatabase.finance_plan_items.push({
			id: PLAN_ITEM_ID,
			department: "Makeathon",
			period_type: "year",
			period_key: "2026",
			label: "Venue",
			category: "Venue",
			planned_amount: 5000,
			expected_month: "2026-05",
			status: "planned",
			note: null,
			project_id: PROJECT_ID,
			template_item_id: null,
		});
		mockDatabase.finance_budgets.push({
			department: "Makeathon",
			period_type: "year",
			period_key: "2026",
			amount_planned: 15_000,
			currency: "EUR",
			note: null,
		});
		const posting = await findMakeathonVenue(app);
		const allocationResponse = await app.inject({
			method: "PUT",
			url: `/api/finance/posting-allocations/${posting.external_id}`,
			headers: authHeaders(testTokens.admin),
			payload: {
				allocations: [{ project_id: PROJECT_ID, percentage: 100 }],
			},
		});
		assert.strictEqual(allocationResponse.statusCode, 200);

		const matchResponse = await app.inject({
			method: "POST",
			url: "/api/finance/plan-item-matches",
			headers: authHeaders(testTokens.admin),
			payload: {
				plan_item_id: PLAN_ITEM_ID,
				posting_external_id: posting.external_id,
				matched_amount: 3000,
				match_type: "manual",
			},
		});
		assert.strictEqual(matchResponse.statusCode, 201);

		const reconciliationResponse = await app.inject({
			method: "GET",
			url: `/api/finance/reconciliation?period_type=year&period_key=2026&department=Makeathon&project_id=${PROJECT_ID}`,
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(reconciliationResponse.statusCode, 200);
		const reconciliation = JSON.parse(reconciliationResponse.payload);
		assert.strictEqual(reconciliation.matches.length, 1);
		assert.strictEqual(
			reconciliation.unmatched_postings[0].unmatched_amount,
			1800,
		);

		const reportResponse = await app.inject({
			method: "GET",
			url: "/api/finance/reports/period-summary?period_type=year&period_key=2026&department=Makeathon",
			headers: authHeaders(testTokens.admin),
		});
		assert.strictEqual(reportResponse.statusCode, 200);
		const report = JSON.parse(reportResponse.payload);
		assert.strictEqual(report.departments[0].budget, 15_000);
		assert.strictEqual(report.departments[0].plan, 5000);
		assert.ok(report.departments[0].actual >= 4800);
		assert.ok(report.departments[0].forecast >= report.departments[0].actual);
		assert.ok(
			report.tax_area_totals.some(
				(row: { tax_area: string }) => row.tax_area === "wirtschaftlich",
			),
		);
	});

	test("matches split posting scopes independently and protects existing matches", async () => {
		seedMakeathonMapping();
		mockDatabase.finance_projects.push(
			{
				id: PROJECT_ID,
				parent_project_id: null,
				name: "Makeathon 2026",
				department: "Makeathon",
				period_type: "year",
				period_key: "2026",
				tax_area: "wirtschaftlich",
				target_amount: -20_000,
				status: "active",
				description: null,
				created_at: "2026-01-01T00:00:00.000Z",
				updated_at: "2026-01-01T00:00:00.000Z",
			},
			{
				id: COMMUNITY_PROJECT_ID,
				parent_project_id: null,
				name: "Community 2026",
				department: "Community",
				period_type: "year",
				period_key: "2026",
				tax_area: "wirtschaftlich",
				target_amount: -10_000,
				status: "active",
				description: null,
				created_at: "2026-01-01T00:00:00.000Z",
				updated_at: "2026-01-01T00:00:00.000Z",
			},
		);
		mockDatabase.finance_plan_items.push(
			{
				id: PLAN_ITEM_ID,
				department: "Makeathon",
				period_type: "year",
				period_key: "2026",
				label: "Makeathon venue share",
				category: "Venue",
				direction: "expense",
				planned_amount: 3000,
				expected_month: "2026-05",
				status: "planned",
				note: null,
				project_id: PROJECT_ID,
				template_item_id: null,
			},
			{
				id: COMMUNITY_PLAN_ITEM_ID,
				department: "Community",
				period_type: "year",
				period_key: "2026",
				label: "Community venue share",
				category: "Venue",
				direction: "expense",
				planned_amount: 2000,
				expected_month: "2026-05",
				status: "planned",
				note: null,
				project_id: COMMUNITY_PROJECT_ID,
				template_item_id: null,
			},
		);
		const posting = await findMakeathonVenue(app);
		const allocationResponse = await app.inject({
			method: "PUT",
			url: `/api/finance/posting-allocations/${posting.external_id}`,
			headers: authHeaders(testTokens.admin),
			payload: {
				allocations: [
					{ project_id: PROJECT_ID, percentage: 60 },
					{ project_id: COMMUNITY_PROJECT_ID, percentage: 40 },
				],
			},
		});
		assert.strictEqual(allocationResponse.statusCode, 200);
		for (const allocation of mockDatabase.finance_posting_allocations.filter(
			(row) => row.posting_external_id === posting.external_id,
		)) {
			allocation.allocated_amount =
				Number(allocation.allocated_percentage) === 60 ? -600 : -400;
		}

		for (const [planItemId, matchedAmount] of [
			[PLAN_ITEM_ID, 2880],
			[COMMUNITY_PLAN_ITEM_ID, 1920],
		] as const) {
			const response = await app.inject({
				method: "POST",
				url: "/api/finance/plan-item-matches",
				headers: authHeaders(testTokens.admin),
				payload: {
					plan_item_id: planItemId,
					posting_external_id: posting.external_id,
					matched_amount: matchedAmount,
					match_type: "manual",
				},
			});
			assert.strictEqual(response.statusCode, 201, response.payload);
		}

		const invalidatingAllocation = await app.inject({
			method: "PUT",
			url: `/api/finance/posting-allocations/${posting.external_id}`,
			headers: authHeaders(testTokens.admin),
			payload: {
				allocations: [{ project_id: PROJECT_ID, percentage: 100 }],
			},
		});
		assert.strictEqual(invalidatingAllocation.statusCode, 409);

		const planReduction = await app.inject({
			method: "PUT",
			url: `/api/finance/plan-items/${PLAN_ITEM_ID}`,
			headers: authHeaders(testTokens.admin),
			payload: {
				label: "Makeathon venue share",
				category: "Venue",
				direction: "expense",
				planned_amount: 2000,
				expected_month: "2026-05",
				status: "planned",
				note: null,
			},
		});
		assert.strictEqual(planReduction.statusCode, 409);

		const directionChange = await app.inject({
			method: "PUT",
			url: `/api/finance/plan-items/${PLAN_ITEM_ID}`,
			headers: authHeaders(testTokens.admin),
			payload: {
				label: "Makeathon venue share",
				category: "Venue",
				direction: "income",
				planned_amount: 3000,
				expected_month: "2026-05",
				status: "planned",
				note: null,
			},
		});
		assert.strictEqual(directionChange.statusCode, 409);
	});

	test("rejects matching a posting with the opposite plan direction", async () => {
		seedMakeathonMapping();
		mockDatabase.finance_plan_items.push({
			id: PLAN_ITEM_ID,
			department: "Makeathon",
			period_type: "year",
			period_key: "2026",
			label: "Venue income",
			category: "Venue",
			direction: "income",
			planned_amount: 5000,
			expected_month: "2026-05",
			status: "planned",
			note: null,
			project_id: null,
			template_item_id: null,
		});
		const posting = await findMakeathonVenue(app);

		const response = await app.inject({
			method: "POST",
			url: "/api/finance/plan-item-matches",
			headers: authHeaders(testTokens.admin),
			payload: {
				plan_item_id: PLAN_ITEM_ID,
				posting_external_id: posting.external_id,
				matched_amount: 1000,
				match_type: "manual",
			},
		});

		assert.strictEqual(response.statusCode, 400);
		assert.match(JSON.parse(response.payload).error, /direction/i);
	});
});
