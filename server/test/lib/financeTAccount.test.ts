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
// A project owned by another department — never allowed to surface in this
// department's T-account payload.
const OTHER_DEPARTMENT_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
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

	test("ungrouped actual and planned balances include only/also the planned lines", () => {
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
		// Planned balance = actual income + planned income (5000).
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
		// The department net is unchanged by the finer grouping.
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

	test("totals expose embedded VAT for income and expenses", () => {
		const { totals } = build();
		assert.strictEqual(totals.vat_income, 1_900);
		assert.strictEqual(totals.vat_expenses, 19);
	});

	test("carries both balances net of VAT for the net amount mode", () => {
		const { totals } = build();

		// Gross: 11.900 income − 119 expenses. Net strips the 1.900 output tax and
		// the 19 input tax, so the department's real margin is 10.000 − 100.
		assert.deepStrictEqual(totals.actual, {
			income: 11_900,
			expenses: 119,
			saldo: 11_781,
		});
		assert.deepStrictEqual(totals.actual_net, {
			income: 10_000,
			expenses: 100,
			saldo: 9_900,
		});
		// The planned balance folds in the two still-open plan items, neither of
		// which carries a rate — so its net differs from its gross only by the
		// booked lines' VAT.
		assert.strictEqual(totals.plan.saldo, 11_781 + 5_000 - 200);
		assert.strictEqual(totals.plan_net.saldo, 9_900 + 5_000 - 200);
	});

	test("forecasts the VAT payable from planned VAT as well", () => {
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [
				tx({
					external_id: "BB-income",
					cost_location: "120",
					transaction_amount: 1_190,
					vat: 19,
				}),
			],
			mappings: [mapping("120", "Makeathon")],
			allocations: [],
			planItems: [
				// Planned expense with a rate: 190 input tax still to come.
				planItem({
					id: VENUE_PLAN_ID,
					label: "Venue",
					planned_amount: 1_190,
					vat_rate: 19,
				}),
				// No rate at all: contributes nothing to the forecast.
				planItem({
					id: SPONSOR_PLAN_ID,
					label: "Merch",
					planned_amount: 500,
				}),
			],
			matches: [],
			projects: [],
			source: "mock",
			generatedAt: GENERATED_AT,
		});

		const { totals } = result;
		assert.strictEqual(totals.vat_income, 190);
		assert.strictEqual(totals.vat_expenses, 0);
		assert.strictEqual(totals.vat_income_plan, 0);
		assert.strictEqual(totals.vat_expenses_plan, 190);
		// Owed today: 190 collected. Once the planned expense arrives, its 190
		// input tax cancels it out.
		assert.strictEqual(totals.vat_payload, 190);
		assert.strictEqual(totals.vat_payload_forecast, 0);
	});

	test("a fully matched plan item adds nothing to the planned balance (no double count)", () => {
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
		// The plan line stays on the response so the plan item remains reachable
		// once the plan tab is gone, but with nothing open it moves no total.
		const settled = ungrouped.expense_lines.find((l) => l.kind === "plan");
		assert.strictEqual(settled?.amount, 0);
		assert.strictEqual(settled?.plan_detail?.matched_amount, 100);
		assert.strictEqual(settled?.plan_detail?.delta, 0);
		assert.strictEqual(ungrouped.actual.saldo, -100);
		assert.strictEqual(ungrouped.plan.saldo, -100);
		assert.strictEqual(result.totals.plan.saldo, -100);
	});

	test("names the project each plan item draws on (split-invoice capacity)", () => {
		// A 100 EUR invoice split 50/50 over two projects becomes one line per
		// project, and both carry every match on the posting. `plan_items` is what
		// lets the client tell them apart: the Hackathon half stays open after the
		// Makeathon half is matched, and the fully matched Makeathon plan item has
		// no line of its own to say where it sits.
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [
				tx({
					external_id: "BB-split",
					cost_location: "120",
					transaction_amount: -100,
					postingtext: "Sammelrechnung",
				}),
			],
			mappings: [mapping("120", "Makeathon")],
			allocations: [
				allocation({
					id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
					posting_external_id: "BB-split",
					department: "Makeathon",
					project_id: HACKATHON_ID,
					allocated_amount: -50,
					allocated_percentage: 50,
				}),
				allocation({
					id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
					posting_external_id: "BB-split",
					department: "Makeathon",
					project_id: EMPTY_ID,
					allocated_amount: -50,
					allocated_percentage: 50,
				}),
			],
			planItems: [
				planItem({
					id: VENUE_PLAN_ID,
					label: "Venue",
					planned_amount: 50,
					project_id: HACKATHON_ID,
				}),
			],
			matches: [
				match({
					plan_item_id: VENUE_PLAN_ID,
					posting_external_id: "BB-split",
					matched_amount: 50,
				}),
			],
			projects: [
				project({ id: HACKATHON_ID, name: "Hackathon" }),
				project({ id: EMPTY_ID, name: "Empty" }),
			],
			source: "mock",
			generatedAt: GENERATED_AT,
		});

		assert.deepStrictEqual(result.plan_items[VENUE_PLAN_ID], {
			label: "Venue",
			project_id: HACKATHON_ID,
		});
		// Both halves are still one posting with all of its matches attached, so
		// the scope carried by `plan_items` is the only thing separating them.
		const other = result.groups.find((g) => g.project_id === EMPTY_ID);
		assert.strictEqual(other?.expense_lines[0]?.amount, 50);
		assert.strictEqual(
			other?.expense_lines[0]?.posting_detail?.matches.length,
			1,
		);
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

	test("names every plan item by id, whatever state it is in", () => {
		// The lookup is what lets an invoice name the plan item it funds without
		// depending on that item having a visible line.
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [
				tx({
					external_id: "BB-settled",
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
					posting_external_id: "BB-settled",
					matched_amount: 100,
				}),
			],
			projects: [],
			source: "mock",
			generatedAt: GENERATED_AT,
		});

		assert.deepStrictEqual(result.plan_items[VENUE_PLAN_ID], {
			label: "Venue",
			project_id: null,
		});
	});

	test("carries the posting detail inline on the actual line", () => {
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [
				tx({
					external_id: "BB-detail",
					cost_location: "61",
					transaction_amount: -119,
					vat: 19,
					postingtext: "Catering Kickoff",
					transaction_purpose: "Verpflegung Kickoff",
					receipts_assigned_invoice_numbers: "RE-2026-0042",
					cost_location_two: "Verpflegung",
				}),
			],
			mappings: [mapping("61", "Makeathon", "Big Makeathon")],
			allocations: [],
			planItems: [
				planItem({ id: VENUE_PLAN_ID, label: "Catering", planned_amount: 300 }),
			],
			matches: [
				match({
					plan_item_id: VENUE_PLAN_ID,
					posting_external_id: "BB-detail",
					matched_amount: 119,
				}),
			],
			projects: [],
			accountLabels: [
				{ account: "6840", label: "Werbe- und Reisekosten", note: null },
			],
			source: "mock",
			generatedAt: GENERATED_AT,
		});

		const line = result.groups
			.flatMap((group) => group.expense_lines)
			.find((candidate) => candidate.posting_external_id === "BB-detail");
		assert.ok(line?.posting_detail);
		const detail = line.posting_detail;
		assert.strictEqual(detail.booking_date, "2026-02-14");
		assert.strictEqual(detail.invoice_number, "RE-2026-0042");
		assert.strictEqual(detail.counterparty, "Catering Kickoff");
		assert.strictEqual(detail.purpose, "Verpflegung Kickoff");
		assert.strictEqual(detail.posting_amount, -119);
		assert.strictEqual(detail.account_label, "Werbe- und Reisekosten");
		assert.strictEqual(detail.cost_location, "61");
		// The cost location is resolved to its sub-team so the panel does not have
		// to know the mapping table.
		assert.strictEqual(detail.sub_team, "Big Makeathon");
		assert.strictEqual(detail.matches.length, 1);
		assert.strictEqual(detail.matches[0]?.matched_amount, 119);
		// The category comes from cost_location_two.
		assert.strictEqual(line.category, "Verpflegung");
	});

	test("expense lines expose their VAT rate and net amount", () => {
		const result = build();
		const catering = result.groups
			.flatMap((group) => group.expense_lines)
			.find((line) => line.posting_external_id === "BB-1");
		const sponsoring = result.groups
			.flatMap((group) => group.income_lines)
			.find((line) => line.posting_external_id === "BB-2");

		// Both directions carry rate + net, not just income.
		assert.strictEqual(catering?.vat_rate, 19);
		assert.strictEqual(catering?.vat_amount, 19);
		assert.strictEqual(catering?.net_amount, 100);
		assert.strictEqual(sponsoring?.vat_rate, 19);
		assert.strictEqual(sponsoring?.vat_amount, 1_900);
		assert.strictEqual(sponsoring?.net_amount, 10_000);
	});

	test("splits VAT per column into input tax and output tax", () => {
		const result = build();
		const ungrouped = result.groups.find((g) => g.project_id === null);
		const hackathon = result.groups.find((g) => g.project_id === HACKATHON_ID);

		// Expense column → input tax; income column → output tax. Each group only
		// carries its own lines, never its children's.
		assert.deepStrictEqual(ungrouped?.vorsteuer, { actual: 19, plan: 0 });
		assert.deepStrictEqual(ungrouped?.umsatzsteuer, { actual: 0, plan: 0 });
		assert.deepStrictEqual(hackathon?.umsatzsteuer, { actual: 1_900, plan: 0 });
		assert.deepStrictEqual(hackathon?.vorsteuer, { actual: 0, plan: 0 });
		// VAT payable: output tax owed minus input tax reclaimable.
		assert.strictEqual(result.totals.vat_payload, 1_881);
	});

	test("a VAT-rated plan item feeds the planned column VAT", () => {
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [],
			mappings: [mapping("120", "Makeathon")],
			allocations: [],
			planItems: [
				planItem({
					id: VENUE_PLAN_ID,
					label: "Venue",
					planned_amount: 1_190,
					vat_rate: 19,
				}),
				// No rate at all → planned VAT stays unknown, never a fake 0.
				planItem({
					id: SPONSOR_PLAN_ID,
					label: "Merch",
					planned_amount: 500,
				}),
			],
			matches: [],
			projects: [],
			source: "mock",
			generatedAt: GENERATED_AT,
		});

		const ungrouped = result.groups.find((g) => g.project_id === null);
		const venue = ungrouped?.expense_lines.find((l) => l.label === "Venue");
		const merch = ungrouped?.expense_lines.find((l) => l.label === "Merch");
		assert.strictEqual(venue?.vat_amount, 190);
		assert.strictEqual(venue?.net_amount, 1_000);
		assert.strictEqual(merch?.vat_amount, null);
		assert.strictEqual(merch?.net_amount, 500);
		// Planned VAT is reported apart from booked VAT.
		assert.deepStrictEqual(ungrouped?.vorsteuer, { actual: 0, plan: 190 });
	});

	test("plan lines carry planned / actual / delta and lifecycle detail", () => {
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [
				tx({
					external_id: "BB-partial",
					cost_location: "120",
					transaction_amount: -40,
					postingtext: "Anzahlung",
				}),
			],
			mappings: [mapping("120", "Makeathon")],
			allocations: [],
			planItems: [
				planItem({
					id: VENUE_PLAN_ID,
					label: "Venue",
					planned_amount: 100,
					status: "committed",
					expected_month: "2026-05",
					note: "Angebot liegt vor",
					vat_rate: 19,
				}),
			],
			matches: [
				match({
					plan_item_id: VENUE_PLAN_ID,
					posting_external_id: "BB-partial",
					matched_amount: 40,
				}),
			],
			projects: [],
			source: "mock",
			generatedAt: GENERATED_AT,
		});

		const planLine = result.groups
			.flatMap((group) => group.expense_lines)
			.find((line) => line.kind === "plan");
		assert.ok(planLine?.plan_detail);
		const detail = planLine.plan_detail;
		assert.strictEqual(planLine.status, "committed");
		assert.strictEqual(detail.expected_month, "2026-05");
		assert.strictEqual(detail.note, "Angebot liegt vor");
		// Plan is the full planned amount, Ist the matched total, Delta the gap —
		// the line itself only carries the still-open 60 (no double count).
		assert.strictEqual(detail.planned_amount, 100);
		assert.strictEqual(detail.matched_amount, 40);
		assert.strictEqual(detail.delta, -60);
		assert.strictEqual(planLine.amount, 60);
		assert.strictEqual(detail.is_active, true);
		assert.strictEqual(detail.vat_rate, 19);
		assert.strictEqual(detail.matches.length, 1);
	});

	test("a disabled plan item stays visible but out of plan totals", () => {
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [],
			mappings: [mapping("120", "Makeathon")],
			allocations: [],
			planItems: [
				planItem({
					id: VENUE_PLAN_ID,
					label: "Gestrichen",
					planned_amount: 500,
					vat_rate: 19,
					is_active: false,
				}),
			],
			matches: [],
			projects: [],
			source: "mock",
			generatedAt: GENERATED_AT,
		});

		const ungrouped = result.groups.find((g) => g.project_id === null);
		const parked = ungrouped?.expense_lines.find(
			(line) => line.label === "Gestrichen",
		);
		// It is emitted (so it can be re-enabled from the T-view)…
		assert.ok(parked);
		assert.strictEqual(parked.plan_detail?.is_active, false);
		// …but moves neither the planned balance nor the planned VAT.
		assert.strictEqual(ungrouped?.plan.saldo, 0);
		assert.deepStrictEqual(ungrouped?.vorsteuer, { actual: 0, plan: 0 });
		assert.strictEqual(result.totals.plan.saldo, 0);
	});

	test("a split posting exposes only the viewing department's allocations", () => {
		// One invoice split 60/40 between Makeathon and Community. Expanding the
		// row as Makeathon must never surface Community's project, amount, tax
		// area, note or creator id.
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [
				tx({
					external_id: "BB-split",
					cost_location: "120",
					transaction_amount: -1_000,
					postingtext: "Shared venue",
				}),
			],
			mappings: [mapping("120", "Makeathon")],
			allocations: [
				allocation({
					id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
					posting_external_id: "BB-split",
					department: "Makeathon",
					project_id: HACKATHON_ID,
					allocated_amount: -600,
					allocated_percentage: 60,
					note: "Makeathon share",
				}),
				allocation({
					id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
					posting_external_id: "BB-split",
					department: "Community",
					project_id: OTHER_DEPARTMENT_PROJECT_ID,
					tax_area: "wirtschaftlich",
					allocated_amount: -400,
					allocated_percentage: 40,
					note: "Community share",
					created_by: "community-lead",
				}),
			],
			planItems: [],
			matches: [],
			projects: [project({ id: HACKATHON_ID, name: "Hackathon" })],
			source: "mock",
			generatedAt: GENERATED_AT,
		});

		const lines = result.groups.flatMap((group) => group.expense_lines);
		const detailAllocations = lines.flatMap(
			(line) => line.posting_detail?.allocations ?? [],
		);
		assert.deepStrictEqual(
			detailAllocations.map((entry) => entry.department),
			["Makeathon"],
		);
		assert.strictEqual(
			detailAllocations.some(
				(entry) => entry.project_id === OTHER_DEPARTMENT_PROJECT_ID,
			),
			false,
		);
		// The split maths itself still uses every allocation: Makeathon carries
		// its 600 share, not the whole 1000.
		assert.strictEqual(result.totals.actual.expenses, 600);
	});

	test("an allocation without a department stays with its cost location", () => {
		// A whole-posting allocation that only pins a project leaves the department
		// null; it belongs to the cost location's department and must stay visible.
		const result = buildFinanceTAccount({
			periodType: "year",
			periodKey: "2026",
			department: "Makeathon",
			transactions: [
				tx({
					external_id: "BB-pinned",
					cost_location: "120",
					transaction_amount: -250,
					postingtext: "Pinned to a project",
				}),
			],
			mappings: [mapping("120", "Makeathon")],
			allocations: [
				allocation({
					posting_external_id: "BB-pinned",
					project_id: HACKATHON_ID,
					allocated_amount: -250,
					allocated_percentage: 100,
				}),
			],
			planItems: [],
			matches: [],
			projects: [project({ id: HACKATHON_ID, name: "Hackathon" })],
			source: "mock",
			generatedAt: GENERATED_AT,
		});

		const hackathon = result.groups.find((g) => g.project_id === HACKATHON_ID);
		const line = hackathon?.expense_lines.find((l) => l.kind === "actual");
		assert.strictEqual(line?.posting_detail?.allocations.length, 1);
		assert.strictEqual(
			line?.posting_detail?.allocations[0]?.project_id,
			HACKATHON_ID,
		);
	});

	test("actual balance matches aggregateByDepartment net (consistency)", () => {
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
