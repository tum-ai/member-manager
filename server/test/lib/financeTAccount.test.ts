import assert from "node:assert";
import { describe, test } from "node:test";
import type {
	BuchhaltungsButlerTransaction,
	FinanceDepartmentMapping,
	FinanceManagedPlanItem,
	FinancePlanItemPostingMatch,
	FinancePostingAllocation,
	FinanceProject,
	FinanceTAccountResponse,
} from "@member-manager/shared";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { buildFinanceTAccount } = await import(
	"../../src/lib/financeTAccount.js"
);
const { aggregateByDepartment } = await import(
	"../../src/lib/financeDepartments.js"
);

const HACKATHON_ID = "11111111-1111-4111-8111-111111111111";
const EMPTY_ID = "33333333-3333-4333-8333-333333333333";
// Plan item ids are real uuids: a match record embedded in a plan line carries
// its plan_item_id through the shared match schema, which enforces uuid format.
const VENUE_PLAN_ID = "44444444-4444-4444-8444-444444444444";
const SPONSOR_PLAN_ID = "55555555-5555-4555-8555-555555555555";
const GENERATED_AT = "2026-08-04T10:00:00.000Z";

function tx(
	overrides: Partial<BuchhaltungsButlerTransaction> &
		Pick<
			BuchhaltungsButlerTransaction,
			"external_id" | "cost_location" | "transaction_amount"
		>,
): BuchhaltungsButlerTransaction {
	return {
		date: "2026-02-14",
		postingtext: "Sample",
		amount: overrides.transaction_amount,
		currency: "EUR",
		vat: 0,
		credit_type: "S",
		debit_postingaccount_number: "6840",
		credit_postingaccount_number: "1200",
		cost_location_two: "0",
		transaction_purpose: "Purpose",
		...overrides,
	};
}

function mapping(
	cost_location: string,
	department: string | null,
	sub_team: string | null = null,
): FinanceDepartmentMapping {
	return { cost_location, department, bereich: null, note: null, sub_team };
}

function allocation(
	overrides: Partial<FinancePostingAllocation> &
		Pick<FinancePostingAllocation, "posting_external_id">,
): FinancePostingAllocation {
	return {
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		department: null,
		project_id: null,
		tax_area: null,
		allocated_amount: 0,
		allocated_percentage: 100,
		note: null,
		created_by: null,
		created_at: GENERATED_AT,
		updated_at: GENERATED_AT,
		...overrides,
	};
}

function planItem(
	overrides: Partial<FinanceManagedPlanItem> &
		Pick<FinanceManagedPlanItem, "id" | "label" | "planned_amount">,
): FinanceManagedPlanItem {
	return {
		department: "Makeathon",
		period_type: "year",
		period_key: "2026",
		category: null,
		direction: "expense",
		expected_month: null,
		status: "planned",
		note: null,
		project_id: null,
		template_item_id: null,
		is_active: true,
		vat_rate: null,
		...overrides,
	};
}

function match(
	overrides: Partial<FinancePlanItemPostingMatch> &
		Pick<
			FinancePlanItemPostingMatch,
			"plan_item_id" | "posting_external_id" | "matched_amount"
		>,
): FinancePlanItemPostingMatch {
	return {
		id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		match_type: "manual",
		created_by: null,
		created_at: GENERATED_AT,
		...overrides,
	};
}

function project(
	overrides: Partial<FinanceProject> & Pick<FinanceProject, "id" | "name">,
): FinanceProject {
	return {
		parent_project_id: null,
		department: "Makeathon",
		period_type: "year",
		period_key: "2026",
		tax_area: null,
		target_amount: 0,
		status: "active",
		description: null,
		sub_team: null,
		created_at: GENERATED_AT,
		updated_at: GENERATED_AT,
		...overrides,
	};
}

function build(): FinanceTAccountResponse {
	const transactions = [
		// Catering expense, VAT 19% → embedded VAT 19.
		tx({
			external_id: "BB-1",
			cost_location: "120",
			transaction_amount: -119,
			vat: 19,
			cost_location_two: "1",
			postingtext: "Catering",
		}),
		// Sponsoring income, VAT 19% → embedded VAT 1900, routed to a project.
		tx({
			external_id: "BB-2",
			cost_location: "120",
			transaction_amount: 11_900,
			vat: 19,
			postingtext: "Sponsoring Hackathon",
		}),
		// Belongs to another department (unmapped cost location) → excluded.
		tx({
			external_id: "BB-3",
			cost_location: "999",
			transaction_amount: -50,
		}),
	];
	const mappings = [mapping("120", "Makeathon")];
	const allocations = [
		allocation({
			posting_external_id: "BB-2",
			project_id: HACKATHON_ID,
			allocated_amount: 11_900,
			allocated_percentage: 100,
		}),
	];
	const planItems = [
		planItem({ id: VENUE_PLAN_ID, label: "Venue", planned_amount: 200 }),
		planItem({
			id: SPONSOR_PLAN_ID,
			label: "Sponsoring (geplant)",
			planned_amount: 5_000,
			direction: "income",
			project_id: HACKATHON_ID,
		}),
	];
	const projects = [
		project({ id: HACKATHON_ID, name: "Hackathon", target_amount: 25_000 }),
		project({ id: EMPTY_ID, name: "Empty" }),
	];
	return buildFinanceTAccount({
		periodType: "year",
		periodKey: "2026",
		department: "Makeathon",
		transactions,
		mappings,
		allocations,
		planItems,
		matches: [],
		projects,
		accountLabels: [],
		source: "mock",
		generatedAt: GENERATED_AT,
	});
}

describe("buildFinanceTAccount", () => {
	test("splits postings into expense and income columns", () => {
		const result = build();
		const ungrouped = result.groups.find((g) => g.project_id === null);
		assert.ok(ungrouped);
		assert.strictEqual(ungrouped.expense_lines.length, 2); // catering + Venue plan
		const catering = ungrouped.expense_lines.find((l) => l.kind === "actual");
		assert.strictEqual(catering?.amount, 119);
		assert.strictEqual(catering?.direction, "expense");
		assert.strictEqual(catering?.vat_amount, 19);
	});

	test("ungrouped Ist- and Plan-Saldo include only/also the planned lines", () => {
		const ungrouped = build().groups.find((g) => g.project_id === null);
		assert.ok(ungrouped);
		assert.deepStrictEqual(ungrouped.actual, {
			income: 0,
			expenses: 119,
			saldo: -119,
		});
		// Plan adds the 200 Venue plan item on top of the 119 actual.
		assert.deepStrictEqual(ungrouped.plan, {
			income: 0,
			expenses: 319,
			saldo: -319,
		});
	});

	test("groups postings and plan items under their project with net profit", () => {
		const hackathon = build().groups.find((g) => g.project_id === HACKATHON_ID);
		assert.ok(hackathon);
		assert.strictEqual(hackathon.project_name, "Hackathon");
		assert.strictEqual(hackathon.actual.income, 11_900);
		assert.strictEqual(hackathon.actual.saldo, 11_900);
		// Plan-Saldo = actual income + planned income (5000).
		assert.strictEqual(hackathon.plan.saldo, 16_900);
	});

	test("groups un-allocated postings by their cost location's sub-team", () => {
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [
				tx({
					external_id: "BB-61",
					cost_location: "61",
					transaction_amount: -500,
					postingtext: "Big spend",
				}),
				tx({
					external_id: "BB-62",
					cost_location: "62",
					transaction_amount: -200,
					postingtext: "Small spend",
				}),
			],
			mappings: [
				mapping("61", "Makeathon", "Big Makeathon"),
				mapping("62", "Makeathon", "Small Makeathon"),
			],
			allocations: [],
			planItems: [],
			matches: [],
			projects: [],
			source: "mock",
			generatedAt: GENERATED_AT,
		});

		// Two named sub-team folders (project_id null, label in project_name), no
		// catch-all "Direkt zugeordnet" bucket because every posting has a sub-team.
		const subTeams = result.groups.filter(
			(g) => g.project_id === null && g.project_name !== null,
		);
		assert.deepStrictEqual(subTeams.map((g) => g.project_name).sort(), [
			"Big Makeathon",
			"Small Makeathon",
		]);
		const big = subTeams.find((g) => g.project_name === "Big Makeathon");
		assert.strictEqual(big?.actual.saldo, -500);
		// The department net is unchanged by the finer grouping (FR-G5).
		assert.strictEqual(result.totals.actual.saldo, -700);
	});

	test("surfaces the project target and null for the ungrouped bucket", () => {
		const result = build();
		const hackathon = result.groups.find((g) => g.project_id === HACKATHON_ID);
		const ungrouped = result.groups.find((g) => g.project_id === null);
		assert.strictEqual(hackathon?.target_amount, 25_000);
		assert.strictEqual(ungrouped?.target_amount, null);
	});

	test("emits department projects with no activity as empty folders", () => {
		const empty = build().groups.find((g) => g.project_id === EMPTY_ID);
		assert.ok(empty);
		assert.strictEqual(empty.income_lines.length, 0);
		assert.strictEqual(empty.expense_lines.length, 0);
		assert.strictEqual(empty.plan.saldo, 0);
	});

	test("totals expose embedded VAT for income and expenses (FR-J)", () => {
		const { totals } = build();
		assert.strictEqual(totals.vat_income, 1_900);
		assert.strictEqual(totals.vat_expenses, 19);
	});

	test("a fully matched plan item drops out of the Plan-Saldo (no double count)", () => {
		// 100 EUR booked expense + a 100 EUR plan item matched to it. The forecast
		// must stay 100, not 200: the booked posting already covers the plan.
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [
				tx({
					external_id: "BB-100",
					cost_location: "120",
					transaction_amount: -100,
					postingtext: "Venue deposit",
				}),
			],
			mappings: [mapping("120", "Makeathon")],
			allocations: [],
			planItems: [
				planItem({ id: VENUE_PLAN_ID, label: "Venue", planned_amount: 100 }),
			],
			matches: [
				match({
					plan_item_id: VENUE_PLAN_ID,
					posting_external_id: "BB-100",
					matched_amount: 100,
				}),
			],
			projects: [],
			source: "mock",
			generatedAt: GENERATED_AT,
		});
		const ungrouped = result.groups.find((g) => g.project_id === null);
		assert.ok(ungrouped);
		// Only the actual line remains; the fully-matched plan line is gone.
		assert.strictEqual(
			ungrouped.expense_lines.filter((l) => l.kind === "plan").length,
			0,
		);
		assert.strictEqual(ungrouped.actual.saldo, -100);
		assert.strictEqual(ungrouped.plan.saldo, -100);
		assert.strictEqual(result.totals.plan.saldo, -100);
	});

	test("a partially matched plan item only carries the open remainder", () => {
		// 40 EUR booked against a 100 EUR plan → 40 realised + 60 still planned.
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [
				tx({
					external_id: "BB-40",
					cost_location: "120",
					transaction_amount: -40,
					postingtext: "Partial invoice",
				}),
			],
			mappings: [mapping("120", "Makeathon")],
			allocations: [],
			planItems: [
				planItem({ id: VENUE_PLAN_ID, label: "Venue", planned_amount: 100 }),
			],
			matches: [
				match({
					plan_item_id: VENUE_PLAN_ID,
					posting_external_id: "BB-40",
					matched_amount: 40,
				}),
			],
			projects: [],
			source: "mock",
			generatedAt: GENERATED_AT,
		});
		const ungrouped = result.groups.find((g) => g.project_id === null);
		assert.ok(ungrouped);
		const planLine = ungrouped?.expense_lines.find((l) => l.kind === "plan");
		assert.strictEqual(planLine?.amount, 60);
		// Ist 40 booked + 60 still planned = 100 forecast, not 140.
		assert.strictEqual(ungrouped.actual.saldo, -40);
		assert.strictEqual(ungrouped.plan.saldo, -100);
	});

	test("a reallocated posting does not inherit its source sub-team", () => {
		// A Community/Onboarding posting (cost location 111 → sub-team "Onboarding")
		// explicitly reallocated to Makeathon must render under Makeathon's direct
		// bucket, never under a leaked "Onboarding" sub-team folder.
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [
				tx({
					external_id: "BB-realloc",
					cost_location: "111",
					transaction_amount: -300,
					postingtext: "Reallocated spend",
				}),
			],
			mappings: [
				mapping("111", "Community", "Onboarding"),
				mapping("60", "Makeathon"),
			],
			allocations: [
				allocation({
					posting_external_id: "BB-realloc",
					department: "Makeathon",
					allocated_amount: -300,
					allocated_percentage: 100,
				}),
			],
			planItems: [],
			matches: [],
			projects: [],
			source: "mock",
			generatedAt: GENERATED_AT,
		});
		// No sub-team folder leaked in; the posting sits in the direct bucket.
		const subTeams = result.groups.filter(
			(g) => g.project_id === null && g.project_name !== null,
		);
		assert.deepStrictEqual(subTeams, []);
		const ungrouped = result.groups.find(
			(g) => g.project_id === null && g.project_name === null,
		);
		assert.strictEqual(ungrouped?.actual.saldo, -300);
	});

	test("actual saldo matches aggregateByDepartment net (consistency, FR-G5)", () => {
		const transactions = [
			tx({
				external_id: "BB-1",
				cost_location: "120",
				transaction_amount: -119,
				vat: 19,
			}),
			tx({
				external_id: "BB-2",
				cost_location: "120",
				transaction_amount: 11_900,
				vat: 19,
			}),
			tx({
				external_id: "BB-3",
				cost_location: "999",
				transaction_amount: -50,
			}),
		];
		const mappings = [mapping("120", "Makeathon")];
		const aggregate = aggregateByDepartment(transactions, mappings);
		const makeathonNet =
			aggregate.by_department.find((row) => row.department === "Makeathon")
				?.net ?? Number.NaN;

		const result = build();
		assert.strictEqual(result.totals.actual.saldo, makeathonNet);
		assert.strictEqual(result.totals.actual.saldo, 11_781);
	});
});
