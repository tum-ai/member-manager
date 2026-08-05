import assert from "node:assert";
import { describe, test } from "node:test";
import type {
	BuchhaltungsButlerTransaction,
	FinanceDepartmentMapping,
	FinanceManagedPlanItem,
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
		planItem({ id: "p-venue", label: "Venue", planned_amount: 200 }),
		planItem({
			id: "p-sponsor",
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
		projects,
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
