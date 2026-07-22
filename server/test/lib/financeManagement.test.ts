import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type {
	BuchhaltungsButlerTransaction,
	FinanceBudget,
	FinanceDepartmentMapping,
	FinanceManagedPlanItem,
	FinancePostingAllocation,
	FinanceProject,
} from "@member-manager/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const {
	calculatePostingScopeCapacity,
	createPlanItemPostingMatch,
	normalizePostingAllocations,
} = await import("../../src/lib/financeAllocations.js");
const { setSupabaseClient } = await import("../../src/lib/supabase.js");
const { aggregateByDepartment, buildEffectiveDepartmentTransactions } =
	await import("../../src/lib/financeDepartments.js");
const {
	buildFinancePeriodReport,
	buildFinanceReconciliation,
	inferAccountTaxArea,
} = await import("../../src/lib/financeReports.js");

const POSTING: BuchhaltungsButlerTransaction = {
	external_id: "BB-1",
	date: "2026-05-04",
	postingtext: "Makeathon venue",
	amount: -4800,
	currency: "EUR",
	vat: 19,
	credit_type: "debit",
	debit_postingaccount_number: "6850",
	credit_postingaccount_number: "1200",
	cost_location: "161",
	cost_location_two: "3",
	transaction_amount: -4800,
	transaction_purpose: "Venue",
};

const MAPPINGS: FinanceDepartmentMapping[] = [
	{
		cost_location: "161",
		department: "Makeathon",
		bereich: "wirtschaftlich",
		note: null,
	},
];

const PROJECT: FinanceProject = {
	id: "10000000-0000-4000-8000-000000000001",
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

const PLAN_ITEM: FinanceManagedPlanItem = {
	id: "20000000-0000-4000-8000-000000000001",
	department: "Makeathon",
	period_type: "year",
	period_key: "2026",
	label: "Venue",
	category: "Venue",
	planned_amount: 5000,
	expected_month: "2026-05",
	status: "planned",
	note: null,
	project_id: PROJECT.id,
	template_item_id: null,
};

const BUDGET: FinanceBudget = {
	department: "Makeathon",
	period_type: "year",
	period_key: "2026",
	amount_planned: 10_000,
	currency: "EUR",
	note: null,
};

describe("finance management calculations", () => {
	test("normalizes percentage splits to signed posting amounts", async () => {
		const result = await normalizePostingAllocations(
			POSTING,
			[
				{ department: "Makeathon", percentage: 60 },
				{ department: "Community", percentage: 40 },
			],
			{ department: "Makeathon", taxArea: "wirtschaftlich" },
		);

		assert.deepStrictEqual(
			result.map((allocation) => ({
				department: allocation.department,
				amount: allocation.allocated_amount,
				percentage: allocation.allocated_percentage,
			})),
			[
				{ department: "Makeathon", amount: -2880, percentage: 60 },
				{ department: "Community", amount: -1920, percentage: 40 },
			],
		);
	});

	test("derives scoped match capacity from current amounts and persisted percentages", () => {
		assert.strictEqual(
			calculatePostingScopeCapacity(
				-5000,
				[
					{
						department: "Makeathon",
						project_id: PROJECT.id,
						allocated_percentage: 60,
					},
					{
						department: "Community",
						project_id: null,
						allocated_percentage: 40,
					},
				],
				{ department: "Makeathon", projectId: PROJECT.id },
			),
			3000,
		);
	});

	test("apportions a split posting's cent remainder to one ordered scope", () => {
		const allocations = [
			{
				department: "Makeathon",
				project_id: PROJECT.id,
				tax_area: "wirtschaftlich" as const,
				allocated_percentage: 50,
			},
			{
				department: "Community",
				project_id: null,
				tax_area: "ideell" as const,
				allocated_percentage: 50,
			},
		];
		const communityCapacity = calculatePostingScopeCapacity(
			-100.01,
			allocations,
			{ department: "Community", projectId: null },
		);
		const makeathonCapacity = calculatePostingScopeCapacity(
			-100.01,
			allocations,
			{ department: "Makeathon", projectId: PROJECT.id },
		);

		assert.strictEqual(communityCapacity, 50);
		assert.strictEqual(makeathonCapacity, 50.01);
		assert.strictEqual(
			Math.round((communityCapacity + makeathonCapacity) * 100),
			10_001,
		);
	});

	test("rejects split amounts that do not equal the posting", async () => {
		await assert.rejects(
			normalizePostingAllocations(
				POSTING,
				[
					{ department: "Makeathon", amount: 1000 },
					{ department: "Community", amount: 1000 },
				],
				{ department: "Makeathon", taxArea: "wirtschaftlich" },
			),
			/allocation amounts must total/i,
		);
	});

	test("rejects targets that become duplicates after defaults are applied", async () => {
		await assert.rejects(
			normalizePostingAllocations(
				POSTING,
				[
					{ department: "Makeathon", percentage: 60 },
					{
						department: "Makeathon",
						tax_area: "wirtschaftlich",
						percentage: 40,
					},
				],
				{ department: "Makeathon", taxArea: "wirtschaftlich" },
			),
			/allocation targets must be unique/i,
		);
	});

	test("reports budget, plan, actual, forecast, and tax-area totals", () => {
		const report = buildFinancePeriodReport({
			periodType: "year",
			periodKey: "2026",
			transactions: [POSTING],
			mappings: MAPPINGS,
			allocations: [],
			budgets: [BUDGET],
			planItems: [PLAN_ITEM],
			projects: [PROJECT],
			department: "Makeathon",
			source: "mock",
			now: new Date("2026-07-02T00:00:00.000Z"),
		});

		assert.strictEqual(report.departments[0].budget, 10_000);
		assert.strictEqual(report.departments[0].plan, 5000);
		assert.strictEqual(report.departments[0].actual, 4800);
		assert.strictEqual(report.departments[0].remaining, 5200);
		assert.ok(report.departments[0].forecast > 4800);
		assert.deepStrictEqual(
			report.tax_area_totals.map((row) => row.tax_area),
			["ideell", "wirtschaftlich"],
		);
		assert.strictEqual(
			report.tax_area_totals.reduce((sum, row) => sum + row.actual_expenses, 0),
			4800,
		);
	});

	test("derives account tax areas and automatically splits mixed postings", () => {
		assert.strictEqual(inferAccountTaxArea("6810"), "ideell");
		assert.strictEqual(inferAccountTaxArea("6840"), "wirtschaftlich");
		assert.strictEqual(inferAccountTaxArea("6850"), "gemischt");

		const makePosting = (
			externalId: string,
			account: string,
			amount: number,
		): BuchhaltungsButlerTransaction => ({
			...POSTING,
			external_id: externalId,
			debit_postingaccount_number: account,
			transaction_amount: amount,
			amount,
		});
		const report = buildFinancePeriodReport({
			periodType: "year",
			periodKey: "2026",
			transactions: [
				makePosting("BB-ideell", "6810", -100),
				makePosting("BB-wirtschaftlich", "6840", -300),
				makePosting("BB-mixed", "6850", -400),
			],
			mappings: [{ ...MAPPINGS[0], bereich: null }],
			allocations: [],
			budgets: [],
			planItems: [],
			projects: [],
			department: "Makeathon",
			source: "mock",
			now: new Date("2027-01-01T00:00:00.000Z"),
		});

		const ideell = report.tax_area_totals.find(
			(entry) => entry.tax_area === "ideell",
		);
		const wirtschaftlich = report.tax_area_totals.find(
			(entry) => entry.tax_area === "wirtschaftlich",
		);
		assert.strictEqual(ideell?.actual_expenses, 200);
		assert.strictEqual(wirtschaftlich?.actual_expenses, 600);
	});

	test("uses saved tax allocations consistently for mixed analytics and reports", () => {
		const makePosting = (
			externalId: string,
			account: string,
			amount: number,
		): BuchhaltungsButlerTransaction => ({
			...POSTING,
			external_id: externalId,
			debit_postingaccount_number: account,
			transaction_amount: amount,
			amount,
		});
		const transactions = [
			makePosting("BB-ideell", "6810", -100),
			makePosting("BB-reclassified", "6840", -300),
			makePosting("BB-mixed", "6850", -400),
		];
		const allocations: FinancePostingAllocation[] = [
			{
				id: "30000000-0000-4000-8000-000000000002",
				posting_external_id: "BB-reclassified",
				department: "Makeathon",
				project_id: null,
				tax_area: "ideell",
				allocated_amount: -300,
				allocated_percentage: 100,
				note: null,
				created_by: null,
				created_at: "2026-05-04T00:00:00.000Z",
				updated_at: "2026-05-04T00:00:00.000Z",
			},
		];
		const mappings = [{ ...MAPPINGS[0], bereich: null }];
		const analytics = aggregateByDepartment(
			buildEffectiveDepartmentTransactions(transactions, mappings, allocations),
			mappings,
		);
		const report = buildFinancePeriodReport({
			periodType: "year",
			periodKey: "2026",
			transactions,
			mappings,
			allocations,
			budgets: [],
			planItems: [],
			projects: [],
			department: "Makeathon",
			source: "mock",
			now: new Date("2027-01-01T00:00:00.000Z"),
		});

		const analyticsByTaxArea = new Map(
			analytics.by_bereich.map((entry) => [entry.bereich, entry.expenses]),
		);
		const reportByTaxArea = new Map(
			report.tax_area_totals.map((entry) => [
				entry.tax_area,
				entry.actual_expenses,
			]),
		);
		assert.strictEqual(analyticsByTaxArea.get("ideell"), 800);
		assert.strictEqual(analyticsByTaxArea.get("wirtschaftlich"), 0);
		assert.deepStrictEqual(reportByTaxArea, analyticsByTaxArea);
	});

	test("separates planned income from planned expenses", () => {
		const report = buildFinancePeriodReport({
			periodType: "year",
			periodKey: "2026",
			transactions: [],
			mappings: MAPPINGS,
			allocations: [],
			budgets: [BUDGET],
			planItems: [
				{ ...PLAN_ITEM, direction: "expense", planned_amount: 5000 },
				{
					...PLAN_ITEM,
					id: "20000000-0000-4000-8000-000000000002",
					direction: "income",
					planned_amount: 7000,
				},
			],
			projects: [PROJECT],
			department: "Makeathon",
			source: "mock",
			now: new Date("2026-07-02T00:00:00.000Z"),
		});

		assert.strictEqual(report.totals.plan, 5000);
		assert.strictEqual(report.totals.planned_income, 7000);
		assert.strictEqual(report.totals.planned_net, 2000);
	});

	test("exposes partially matched and unplanned postings separately", () => {
		const allocation: FinancePostingAllocation = {
			id: "30000000-0000-4000-8000-000000000001",
			posting_external_id: POSTING.external_id,
			department: "Makeathon",
			project_id: PROJECT.id,
			tax_area: "wirtschaftlich",
			allocated_amount: -4800,
			allocated_percentage: 100,
			note: null,
			created_by: null,
			created_at: "2026-05-04T00:00:00.000Z",
			updated_at: "2026-05-04T00:00:00.000Z",
		};
		const reconciliation = buildFinanceReconciliation({
			periodType: "year",
			periodKey: "2026",
			transactions: [POSTING],
			mappings: MAPPINGS,
			allocations: [allocation],
			matches: [
				{
					id: "40000000-0000-4000-8000-000000000001",
					plan_item_id: PLAN_ITEM.id,
					posting_external_id: POSTING.external_id,
					matched_amount: 3000,
					match_type: "manual",
					created_by: null,
					created_at: "2026-05-05T00:00:00.000Z",
				},
			],
			planItems: [PLAN_ITEM],
			department: "Makeathon",
			projectId: PROJECT.id,
			source: "mock",
		});

		assert.strictEqual(reconciliation.unmatched_postings.length, 1);
		assert.strictEqual(
			reconciliation.unmatched_postings[0].unmatched_amount,
			1800,
		);
		assert.strictEqual(
			reconciliation.unmatched_postings[0].overmatched_amount,
			0,
		);
		assert.strictEqual(reconciliation.unplanned_postings.length, 0);
	});

	test("keeps overmatched postings in the reconciliation attention list", () => {
		const reconciliation = buildFinanceReconciliation({
			periodType: "year",
			periodKey: "2026",
			transactions: [POSTING],
			mappings: MAPPINGS,
			allocations: [
				{
					id: "30000000-0000-4000-8000-000000000001",
					posting_external_id: POSTING.external_id,
					department: "Makeathon",
					project_id: PROJECT.id,
					tax_area: "wirtschaftlich",
					allocated_amount: -4800,
					allocated_percentage: 100,
					note: null,
					created_by: null,
					created_at: "2026-05-04T00:00:00.000Z",
					updated_at: "2026-05-04T00:00:00.000Z",
				},
			],
			matches: [
				{
					id: "40000000-0000-4000-8000-000000000001",
					plan_item_id: PLAN_ITEM.id,
					posting_external_id: POSTING.external_id,
					matched_amount: 5000,
					match_type: "manual",
					created_by: null,
					created_at: "2026-05-05T00:00:00.000Z",
				},
			],
			planItems: [PLAN_ITEM],
			department: "Makeathon",
			source: "mock",
		});

		assert.strictEqual(reconciliation.unmatched_postings.length, 1);
		assert.strictEqual(
			reconciliation.unmatched_postings[0].unmatched_amount,
			0,
		);
		assert.strictEqual(
			reconciliation.unmatched_postings[0].overmatched_amount,
			200,
		);
		assert.strictEqual(reconciliation.unplanned_postings.length, 0);
	});

	test("does not net unmatched and overmatched amounts across scopes", () => {
		const communityProjectId = "10000000-0000-4000-8000-000000000002";
		const communityPlanItemId = "20000000-0000-4000-8000-000000000002";
		const reconciliation = buildFinanceReconciliation({
			periodType: "year",
			periodKey: "2026",
			transactions: [
				{
					...POSTING,
					amount: -100,
					transaction_amount: -100,
				},
			],
			mappings: MAPPINGS,
			allocations: [
				{
					id: "30000000-0000-4000-8000-000000000001",
					posting_external_id: POSTING.external_id,
					department: "Makeathon",
					project_id: PROJECT.id,
					tax_area: "wirtschaftlich",
					allocated_amount: -60,
					allocated_percentage: 60,
					note: null,
					created_by: null,
					created_at: "2026-05-04T00:00:00.000Z",
					updated_at: "2026-05-04T00:00:00.000Z",
				},
				{
					id: "30000000-0000-4000-8000-000000000002",
					posting_external_id: POSTING.external_id,
					department: "Community",
					project_id: communityProjectId,
					tax_area: "ideell",
					allocated_amount: -40,
					allocated_percentage: 40,
					note: null,
					created_by: null,
					created_at: "2026-05-04T00:00:00.000Z",
					updated_at: "2026-05-04T00:00:00.000Z",
				},
			],
			matches: [
				{
					id: "40000000-0000-4000-8000-000000000001",
					plan_item_id: PLAN_ITEM.id,
					posting_external_id: POSTING.external_id,
					matched_amount: 50,
					match_type: "manual",
					created_by: null,
					created_at: "2026-05-05T00:00:00.000Z",
				},
				{
					id: "40000000-0000-4000-8000-000000000002",
					plan_item_id: communityPlanItemId,
					posting_external_id: POSTING.external_id,
					matched_amount: 50,
					match_type: "manual",
					created_by: null,
					created_at: "2026-05-05T00:00:00.000Z",
				},
			],
			planItems: [
				PLAN_ITEM,
				{
					...PLAN_ITEM,
					id: communityPlanItemId,
					department: "Community",
					project_id: communityProjectId,
				},
			],
			department: null,
			source: "mock",
		});

		assert.strictEqual(reconciliation.unmatched_postings.length, 1);
		assert.strictEqual(
			reconciliation.unmatched_postings[0].unmatched_amount,
			10,
		);
		assert.strictEqual(
			reconciliation.unmatched_postings[0].overmatched_amount,
			10,
		);
		assert.strictEqual(reconciliation.unplanned_postings.length, 0);
	});

	test("keeps stale scoped matches as overmatched without an effective split", () => {
		const communityProjectId = "10000000-0000-4000-8000-000000000002";
		const reconciliation = buildFinanceReconciliation({
			periodType: "year",
			periodKey: "2026",
			transactions: [POSTING],
			mappings: MAPPINGS,
			allocations: [
				{
					id: "30000000-0000-4000-8000-000000000001",
					posting_external_id: POSTING.external_id,
					department: "Community",
					project_id: communityProjectId,
					tax_area: "ideell",
					allocated_amount: -4800,
					allocated_percentage: 100,
					note: null,
					created_by: null,
					created_at: "2026-05-04T00:00:00.000Z",
					updated_at: "2026-05-04T00:00:00.000Z",
				},
			],
			matches: [
				{
					id: "40000000-0000-4000-8000-000000000001",
					plan_item_id: PLAN_ITEM.id,
					posting_external_id: POSTING.external_id,
					matched_amount: 500,
					match_type: "manual",
					created_by: null,
					created_at: "2026-05-05T00:00:00.000Z",
				},
			],
			planItems: [PLAN_ITEM],
			department: "Makeathon",
			projectId: PROJECT.id,
			source: "mock",
		});

		assert.strictEqual(reconciliation.unmatched_postings.length, 1);
		assert.strictEqual(reconciliation.unmatched_postings[0].scope_amount, 0);
		assert.strictEqual(
			reconciliation.unmatched_postings[0].matched_amount,
			500,
		);
		assert.strictEqual(
			reconciliation.unmatched_postings[0].unmatched_amount,
			0,
		);
		assert.strictEqual(
			reconciliation.unmatched_postings[0].overmatched_amount,
			500,
		);
		assert.strictEqual(reconciliation.unplanned_postings.length, 0);
	});

	test("creates matches through the atomic capacity-checking RPC", async () => {
		let rpcName = "";
		let rpcParams: Record<string, unknown> = {};
		setSupabaseClient({
			rpc: async (name: string, params: Record<string, unknown>) => {
				rpcName = name;
				rpcParams = params;
				return {
					data: {
						id: "40000000-0000-4000-8000-000000000002",
						plan_item_id: PLAN_ITEM.id,
						posting_external_id: POSTING.external_id,
						matched_amount: 1250,
						match_type: "manual",
						created_by: "50000000-0000-4000-8000-000000000001",
						created_at: "2026-05-05T00:00:00.000Z",
					},
					error: null,
				};
			},
		} as unknown as SupabaseClient);

		const result = await createPlanItemPostingMatch(
			{
				plan_item_id: PLAN_ITEM.id,
				posting_external_id: POSTING.external_id,
				matched_amount: 1250,
				match_type: "manual",
			},
			"50000000-0000-4000-8000-000000000001",
			{ postingAmount: -4800, postingDirection: "expense" },
		);

		assert.strictEqual(rpcName, "create_finance_plan_item_posting_match");
		assert.deepStrictEqual(
			{
				postingAmount: rpcParams.p_posting_amount,
				postingDirection: rpcParams.p_posting_direction,
				amount: rpcParams.p_matched_amount,
			},
			{
				postingAmount: -4800,
				postingDirection: "expense",
				amount: 1250,
			},
		);
		assert.strictEqual(result.matched_amount, 1250);
	});
});
