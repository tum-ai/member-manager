import assert from "node:assert";
import { describe, test } from "node:test";
import type {
	BuchhaltungsButlerTransaction,
	FinanceAllocationResult,
	FinanceDepartmentMapping,
	FinancePlanItemPostingMatch,
	FinancePostingAllocation,
	FinanceProject,
} from "@member-manager/shared";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { applyWriteFailures, planBulkAllocation } = await import(
	"../../src/lib/financeBulkAllocation.js"
);

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const PLAN_ITEM_ID = "44444444-4444-4444-8444-444444444444";
const TIMESTAMP = "2026-08-09T10:00:00.000Z";
const PERIOD_RANGE = { dateFrom: "2026-01-01", dateTo: "2026-12-31" };

function tx(
	overrides: Partial<BuchhaltungsButlerTransaction> &
		Pick<BuchhaltungsButlerTransaction, "external_id">,
): BuchhaltungsButlerTransaction {
	return {
		date: "2026-03-04",
		postingtext: "Sample",
		amount: -100,
		transaction_amount: -100,
		currency: "EUR",
		vat: 0,
		credit_type: "S",
		debit_postingaccount_number: "6840",
		credit_postingaccount_number: "1200",
		cost_location: "120",
		cost_location_two: "0",
		transaction_purpose: "Purpose",
		...overrides,
	};
}

function project(overrides: Partial<FinanceProject> = {}): FinanceProject {
	return {
		id: PROJECT_ID,
		parent_project_id: null,
		name: "Hackathon",
		department: "Makeathon",
		period_type: "year",
		period_key: "2026",
		tax_area: null,
		target_amount: 0,
		status: "active",
		description: null,
		sub_team: null,
		created_at: TIMESTAMP,
		updated_at: TIMESTAMP,
		...overrides,
	};
}

function allocation(
	overrides: Partial<FinancePostingAllocation> &
		Pick<FinancePostingAllocation, "posting_external_id">,
): FinancePostingAllocation {
	return {
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		department: "Makeathon",
		project_id: null,
		tax_area: null,
		allocated_amount: -100,
		allocated_percentage: 100,
		note: null,
		created_by: null,
		created_at: TIMESTAMP,
		updated_at: TIMESTAMP,
		...overrides,
	};
}

function match(
	overrides: Partial<FinancePlanItemPostingMatch> &
		Pick<FinancePlanItemPostingMatch, "posting_external_id">,
): FinancePlanItemPostingMatch {
	return {
		id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		plan_item_id: PLAN_ITEM_ID,
		matched_amount: 100,
		match_type: "manual",
		created_by: null,
		created_at: TIMESTAMP,
		...overrides,
	};
}

const MAPPINGS: FinanceDepartmentMapping[] = [
	{
		cost_location: "120",
		department: "Makeathon",
		bereich: null,
		note: null,
		sub_team: null,
	},
	{
		cost_location: "300",
		department: "Community",
		bereich: null,
		note: null,
		sub_team: null,
	},
];

// Defaults to a reviewer (may write every department); a scoped member is
// modelled by narrowing `canWriteDepartment`.
function plan(input: {
	postingExternalIds: string[];
	transactions: BuchhaltungsButlerTransaction[];
	allocations?: FinancePostingAllocation[];
	matches?: FinancePlanItemPostingMatch[];
	planItemProjectById?: Map<string, string | null>;
	project?: FinanceProject;
	canWriteDepartment?: (department: string | null) => boolean;
}) {
	return planBulkAllocation({
		project: input.project ?? project(),
		postingExternalIds: input.postingExternalIds,
		transactions: input.transactions,
		allocations: input.allocations ?? [],
		matches: input.matches ?? [],
		planItemProjectById: input.planItemProjectById ?? new Map(),
		mappings: MAPPINGS,
		periodRange: PERIOD_RANGE,
		canWriteDepartment: input.canWriteDepartment ?? (() => true),
	});
}

function reasons(results: FinanceAllocationResult[]): (string | null)[] {
	return results.map((result) => result.reason);
}

describe("planBulkAllocation", () => {
	test("clears a posting with no existing allocation", () => {
		const result = plan({
			postingExternalIds: ["BB-1"],
			transactions: [tx({ external_id: "BB-1" })],
		});

		assert.deepStrictEqual(
			result.applicable.map((posting) => posting.external_id),
			["BB-1"],
		);
		assert.deepStrictEqual(result.results, [
			{ posting_external_id: "BB-1", applied: true, reason: null },
		]);
	});

	test("clears a posting that already has exactly one allocation", () => {
		// One allocation is a whole-posting assignment; replacing it destroys
		// nothing, so re-filing an invoice into another project stays a fast path.
		const result = plan({
			postingExternalIds: ["BB-1"],
			transactions: [tx({ external_id: "BB-1" })],
			allocations: [
				allocation({
					posting_external_id: "BB-1",
					project_id: OTHER_PROJECT_ID,
				}),
			],
		});

		assert.strictEqual(result.applicable.length, 1);
		assert.strictEqual(result.results[0]?.applied, true);
	});

	test("refuses a posting that is already split across targets (FR-L5)", () => {
		const result = plan({
			postingExternalIds: ["BB-split"],
			transactions: [tx({ external_id: "BB-split" })],
			allocations: [
				allocation({
					posting_external_id: "BB-split",
					id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
					allocated_percentage: 60,
					allocated_amount: -60,
				}),
				allocation({
					posting_external_id: "BB-split",
					id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
					allocated_percentage: 40,
					allocated_amount: -40,
				}),
			],
		});

		assert.deepStrictEqual(result.applicable, []);
		assert.deepStrictEqual(reasons(result.results), ["already_split"]);
	});

	test("refuses a posting booked outside the project's period (FR-L8)", () => {
		const result = plan({
			postingExternalIds: ["BB-early", "BB-late", "BB-edge"],
			transactions: [
				tx({ external_id: "BB-early", date: "2025-12-31" }),
				tx({ external_id: "BB-late", date: "2027-01-01" }),
				// The period bounds themselves are inside the period.
				tx({ external_id: "BB-edge", date: "2026-12-31" }),
			],
		});

		assert.deepStrictEqual(reasons(result.results), [
			"period_mismatch",
			"period_mismatch",
			null,
		]);
	});

	test("refuses a posting matched to another project's Planposten (FR-L7)", () => {
		const result = plan({
			postingExternalIds: ["BB-matched"],
			transactions: [tx({ external_id: "BB-matched" })],
			matches: [match({ posting_external_id: "BB-matched" })],
			planItemProjectById: new Map([[PLAN_ITEM_ID, OTHER_PROJECT_ID]]),
		});

		assert.deepStrictEqual(reasons(result.results), ["matched_elsewhere"]);
	});

	test("allows a posting matched to a department-level or same-project Planposten", () => {
		const departmentLevel = plan({
			postingExternalIds: ["BB-matched"],
			transactions: [tx({ external_id: "BB-matched" })],
			matches: [match({ posting_external_id: "BB-matched" })],
			planItemProjectById: new Map([[PLAN_ITEM_ID, null]]),
		});
		const sameProject = plan({
			postingExternalIds: ["BB-matched"],
			transactions: [tx({ external_id: "BB-matched" })],
			matches: [match({ posting_external_id: "BB-matched" })],
			planItemProjectById: new Map([[PLAN_ITEM_ID, PROJECT_ID]]),
		});

		assert.strictEqual(departmentLevel.results[0]?.applied, true);
		assert.strictEqual(sameProject.results[0]?.applied, true);
	});

	test("refuses another department's posting for a scoped member (FR-K6)", () => {
		const transactions = [
			tx({ external_id: "BB-own", cost_location: "120" }),
			tx({ external_id: "BB-other", cost_location: "300" }),
			// An unmapped cost location belongs to no department, so a scoped member
			// may not pull it in either.
			tx({ external_id: "BB-unmapped", cost_location: "999" }),
		];
		const ids = ["BB-own", "BB-other", "BB-unmapped"];

		const scopedMember = plan({
			postingExternalIds: ids,
			transactions,
			canWriteDepartment: (department) => department === "Makeathon",
		});
		assert.deepStrictEqual(reasons(scopedMember.results), [
			null,
			"forbidden",
			"forbidden",
		]);

		// A reviewer may move any of them.
		const reviewer = plan({ postingExternalIds: ids, transactions });
		assert.deepStrictEqual(reasons(reviewer.results), [null, null, null]);
	});

	test("judges permission by the saved allocation, not the cost location", () => {
		// A Community posting reallocated to Makeathon is Makeathon's to move; the
		// original cost location must not decide it.
		const result = plan({
			postingExternalIds: ["BB-realloc"],
			transactions: [tx({ external_id: "BB-realloc", cost_location: "300" })],
			allocations: [
				allocation({
					posting_external_id: "BB-realloc",
					department: "Makeathon",
				}),
			],
			canWriteDepartment: (department) => department === "Makeathon",
		});

		assert.strictEqual(result.results[0]?.applied, true);
	});

	test("reports an unknown posting instead of failing the whole call", () => {
		const result = plan({
			postingExternalIds: ["BB-1", "BB-ghost"],
			transactions: [tx({ external_id: "BB-1" })],
		});

		assert.deepStrictEqual(reasons(result.results), [null, "not_found"]);
		assert.strictEqual(result.applicable.length, 1);
	});

	test("reports a repeated id once", () => {
		const result = plan({
			postingExternalIds: ["BB-1", "BB-1"],
			transactions: [tx({ external_id: "BB-1" })],
		});

		assert.strictEqual(result.results.length, 1);
		assert.strictEqual(result.applicable.length, 1);
	});
});

describe("applyWriteFailures", () => {
	test("keeps successful postings applied when another one fails (FR-L6)", () => {
		const planned: FinanceAllocationResult[] = [
			{ posting_external_id: "BB-1", applied: true, reason: null },
			{ posting_external_id: "BB-2", applied: true, reason: null },
			{ posting_external_id: "BB-3", applied: false, reason: "already_split" },
		];

		const result = applyWriteFailures(
			planned,
			new Map([["BB-2", "matched_elsewhere" as const]]),
		);

		assert.deepStrictEqual(result, [
			{ posting_external_id: "BB-1", applied: true, reason: null },
			{
				posting_external_id: "BB-2",
				applied: false,
				reason: "matched_elsewhere",
			},
			{ posting_external_id: "BB-3", applied: false, reason: "already_split" },
		]);
	});
});
