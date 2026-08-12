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

	test("names every Planposten, including one with no line of its own", () => {
		// A fully matched Planposten carries no open remainder and is therefore not
		// emitted as a line — but an invoice still references it, and that
		// reference has to be nameable.
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

		assert.strictEqual(
			result.groups
				.flatMap((group) => group.expense_lines)
				.filter((line) => line.kind === "plan").length,
			0,
		);
		assert.strictEqual(result.plan_item_labels[VENUE_PLAN_ID], "Venue");
	});

	test("carries the posting detail inline on the actual line (FR-K2/FR-K3)", () => {
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

	test("expense lines expose their VAT rate and net amount (FR-N1)", () => {
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

	test("splits VAT per column into Vorsteuer and Umsatzsteuer (FR-N3)", () => {
		const result = build();
		const ungrouped = result.groups.find((g) => g.project_id === null);
		const hackathon = result.groups.find((g) => g.project_id === HACKATHON_ID);

		// Expense column → Vorsteuer; income column → Umsatzsteuer. Each group only
		// carries its own lines, never its children's.
		assert.deepStrictEqual(ungrouped?.vorsteuer, { actual: 19, plan: 0 });
		assert.deepStrictEqual(ungrouped?.umsatzsteuer, { actual: 0, plan: 0 });
		assert.deepStrictEqual(hackathon?.umsatzsteuer, { actual: 1_900, plan: 0 });
		assert.deepStrictEqual(hackathon?.vorsteuer, { actual: 0, plan: 0 });
		// Zahllast: Umsatzsteuer owed minus Vorsteuer reclaimable.
		assert.strictEqual(result.totals.vat_payload, 1_881);
	});

	test("a VAT-rated plan item feeds the planned column VAT (FR-N5)", () => {
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

	test("plan lines carry Plan / Ist / Delta and lifecycle detail (FR-K4)", () => {
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

	test("a disabled plan item stays visible but out of plan totals (FR-M3)", () => {
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
		// …but moves neither the Plan-Saldo nor the planned VAT.
		assert.strictEqual(ungrouped?.plan.saldo, 0);
		assert.deepStrictEqual(ungrouped?.vorsteuer, { actual: 0, plan: 0 });
		assert.strictEqual(result.totals.plan.saldo, 0);
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
