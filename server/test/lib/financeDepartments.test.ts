import assert from "node:assert";
import { describe, test } from "node:test";
import type {
	BuchhaltungsButlerTransaction,
	FinanceDepartmentMapping,
} from "@member-manager/shared";
import { FINANCE_UNMAPPED_DEPARTMENT } from "@member-manager/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const {
	FINANCE_DEPARTMENT_BY_DOCUMENT_DIGIT,
	aggregateByDepartment,
	applySavedPostingAllocations,
	buildEffectiveDepartmentTransactions,
	buildEffectivePostingSplits,
	buildMappingRows,
	deriveAutomaticDepartment,
	loadEffectiveDepartmentTransactions,
	normalizeCostLocation,
} = await import("../../src/lib/financeDepartments.js");
const { setSupabaseClient } = await import("../../src/lib/supabase.js");

function tx(
	overrides: Partial<BuchhaltungsButlerTransaction> &
		Pick<BuchhaltungsButlerTransaction, "cost_location" | "transaction_amount">,
): BuchhaltungsButlerTransaction {
	return {
		external_id: "BB-1",
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

const mapping = (
	cost_location: string,
	department: string | null,
	bereich: FinanceDepartmentMapping["bereich"] = null,
): FinanceDepartmentMapping => ({
	cost_location,
	department,
	bereich,
	note: null,
});

describe("normalizeCostLocation", () => {
	test("strips leading zeros so 82 and 082 collapse", () => {
		assert.strictEqual(normalizeCostLocation("082"), "82");
		assert.strictEqual(normalizeCostLocation("82"), "82");
		assert.strictEqual(normalizeCostLocation("  051 "), "51");
	});

	test("maps empty / all-zero to a stable 0 bucket", () => {
		assert.strictEqual(normalizeCostLocation(""), "0");
		assert.strictEqual(normalizeCostLocation("000"), "0");
	});
});

describe("automatic department fallback", () => {
	test("exports the canonical operational department digit map", () => {
		assert.deepStrictEqual(FINANCE_DEPARTMENT_BY_DOCUMENT_DIGIT, {
			"1": "Community",
			"2": "Partners & Sponsors",
			"3": "Software Development",
			"4": "Marketing",
			"5": "Venture",
			"6": "Makeathon",
			"7": "Innovation Department",
			"8": "Legal & Finance",
			"9": "Research",
		});
	});

	test("uses booking numbers first and assigned invoice numbers as fallback", () => {
		assert.strictEqual(
			deriveAutomaticDepartment(
				tx({
					cost_location: "999",
					transaction_amount: -50,
					booking_number: "6-2026-001",
					receipts_assigned_invoice_numbers: "INV-42026",
				}),
			),
			"Makeathon",
		);
		assert.strictEqual(
			deriveAutomaticDepartment(
				tx({
					cost_location: "999",
					transaction_amount: -50,
					booking_number: "",
					receipts_assigned_invoice_numbers: "INV-42026",
				}),
			),
			"Marketing",
		);
		assert.strictEqual(
			deriveAutomaticDepartment(
				tx({
					cost_location: "999",
					transaction_amount: -50,
					booking_number: "0-2026-001",
					receipts_assigned_invoice_numbers: "INV-62026",
				}),
			),
			null,
		);
	});
});

describe("aggregateByDepartment", () => {
	test("groups postings by mapped department and buckets unmapped ones", () => {
		const transactions = [
			tx({
				cost_location: "161",
				transaction_amount: -4800,
				date: "2026-05-04",
			}),
			tx({
				cost_location: "161",
				transaction_amount: -3900,
				date: "2026-05-04",
			}),
			tx({
				cost_location: "120",
				transaction_amount: 7500,
				date: "2026-02-14",
			}),
			// Unmapped: cost location present but no assignment.
			tx({ cost_location: "999", transaction_amount: -50, date: "2026-02-20" }),
		];
		const mappings = [
			mapping("161", "Makeathon", "wirtschaftlich"),
			mapping("120", "Partnerships", "ideell"),
		];

		const result = aggregateByDepartment(transactions, mappings);

		const makeathon = result.by_department.find(
			(d) => d.department === "Makeathon",
		);
		assert.ok(makeathon);
		assert.strictEqual(makeathon.expenses, 8700);
		assert.strictEqual(makeathon.net, -8700);
		assert.strictEqual(makeathon.count, 2);
		assert.strictEqual(makeathon.bereich, "wirtschaftlich");
		assert.strictEqual(makeathon.unmapped, false);

		const unmapped = result.by_department.find((d) => d.unmapped);
		assert.ok(unmapped);
		assert.strictEqual(unmapped.department, FINANCE_UNMAPPED_DEPARTMENT);
		assert.strictEqual(unmapped.expenses, 50);
		// Unmapped bucket always sorts last.
		assert.strictEqual(
			result.by_department[result.by_department.length - 1].department,
			FINANCE_UNMAPPED_DEPARTMENT,
		);

		assert.strictEqual(result.totals.count, 4);
		assert.strictEqual(result.totals.income, 7500);
		assert.strictEqual(result.totals.expenses, 8750);
		assert.strictEqual(result.totals.unmapped_count, 1);
	});

	test("rolls up by month and by Bereich", () => {
		const transactions = [
			tx({
				cost_location: "161",
				transaction_amount: -100,
				date: "2026-01-10",
			}),
			tx({
				cost_location: "161",
				transaction_amount: -200,
				date: "2026-02-10",
			}),
			tx({ cost_location: "120", transaction_amount: 500, date: "2026-02-15" }),
		];
		const mappings = [
			mapping("161", "Makeathon", "wirtschaftlich"),
			mapping("120", "Partnerships", "ideell"),
		];

		const result = aggregateByDepartment(transactions, mappings);

		assert.deepStrictEqual(
			result.by_month.map((m) => m.month),
			["2026-01", "2026-02"],
		);
		const feb = result.by_month.find((m) => m.month === "2026-02");
		assert.strictEqual(feb?.expenses, 200);
		assert.strictEqual(feb?.income, 500);

		const wirtschaftlich = result.by_bereich.find(
			(b) => b.bereich === "wirtschaftlich",
		);
		assert.strictEqual(wirtschaftlich?.expenses, 300);
	});

	test("reports a department spanning multiple Bereiche deterministically", () => {
		const transactions = [
			tx({
				cost_location: "120",
				transaction_amount: 500,
				debit_postingaccount_number: "6810",
			}),
			tx({
				cost_location: "121",
				transaction_amount: -200,
				debit_postingaccount_number: "6840",
			}),
		];
		const mappings = [
			mapping("120", "Partners & Sponsors", "ideell"),
			mapping("121", "Partners & Sponsors", "wirtschaftlich"),
		];

		const forward = aggregateByDepartment(transactions, mappings);
		const reverse = aggregateByDepartment(
			[...transactions].reverse(),
			mappings,
		);
		const forwardDepartment = forward.by_department.find(
			(row) => row.department === "Partners & Sponsors",
		);
		const reverseDepartment = reverse.by_department.find(
			(row) => row.department === "Partners & Sponsors",
		);

		assert.strictEqual(forwardDepartment?.bereich, null);
		assert.deepStrictEqual(reverseDepartment, forwardDepartment);
	});

	test("uses the document fallback while stored mappings remain authoritative", () => {
		const transaction = tx({
			cost_location: "999",
			transaction_amount: -100,
			booking_number: "62026",
		});

		const automatic = aggregateByDepartment([transaction], []);
		assert.strictEqual(automatic.by_department[0].department, "Makeathon");
		assert.strictEqual(automatic.by_department[0].unmapped, false);

		const overridden = aggregateByDepartment(
			[transaction],
			[mapping("999", "Research", "ideell")],
		);
		assert.strictEqual(overridden.by_department[0].department, "Research");
		assert.strictEqual(overridden.by_department[0].bereich, "wirtschaftlich");
	});

	test("splits saved allocations proportionally and overrides department mappings", () => {
		const transaction = tx({
			external_id: "BB-allocated",
			cost_location: "161",
			transaction_amount: -100,
			amount: -100,
			vat: 19,
			booking_number: "62026",
		});
		const effective = applySavedPostingAllocations(
			[transaction],
			[mapping("161", "Marketing", "wirtschaftlich")],
			[
				{
					posting_external_id: "BB-allocated",
					department: "Community",
					tax_area: "ideell",
					allocated_amount: -25,
					allocated_percentage: 25,
				},
				{
					posting_external_id: "BB-allocated",
					department: "Research",
					tax_area: null,
					allocated_amount: -75,
					allocated_percentage: 75,
				},
			],
		);

		assert.deepStrictEqual(
			effective.map((posting) => posting.transaction_amount),
			[-25, -75],
		);
		assert.deepStrictEqual(
			effective.map((posting) => posting.amount),
			[-25, -75],
		);
		const result = aggregateByDepartment(effective, [
			mapping("161", "Marketing", "wirtschaftlich"),
		]);
		assert.strictEqual(
			result.by_department.find((row) => row.department === "Community")
				?.expenses,
			25,
		);
		assert.strictEqual(
			result.by_department.find((row) => row.department === "Research")
				?.expenses,
			75,
		);
		assert.strictEqual(
			result.by_department.some((row) => row.department === "Marketing"),
			false,
		);
		assert.strictEqual(result.totals.expenses, 100);
		assert.strictEqual(result.totals.vat, 15.96);
	});

	test("rescales persisted percentages when BuchhaltungsButler corrects an amount", () => {
		const transaction = tx({
			external_id: "BB-corrected",
			cost_location: "161",
			transaction_amount: -100.01,
			amount: -100.01,
		});
		const allocations = [
			{
				posting_external_id: "BB-corrected",
				department: "Research",
				tax_area: "wirtschaftlich" as const,
				allocated_amount: -75,
				allocated_percentage: 66.67,
			},
			{
				posting_external_id: "BB-corrected",
				department: "Community",
				tax_area: "ideell" as const,
				allocated_amount: -25,
				allocated_percentage: 33.33,
			},
		];

		const reportEffectiveSplits = buildEffectivePostingSplits(
			[transaction],
			[],
			allocations,
		);
		assert.deepStrictEqual(
			reportEffectiveSplits.map(({ department, amount }) => ({
				department,
				amount,
			})),
			[
				{ department: "Community", amount: -33.33 },
				{ department: "Research", amount: -66.68 },
			],
		);

		const analytics = aggregateByDepartment(
			buildEffectiveDepartmentTransactions([transaction], [], allocations),
			[],
		);
		assert.strictEqual(analytics.totals.expenses, 100.01);
		assert.strictEqual(
			analytics.by_department.find(
				({ department }) => department === "Community",
			)?.expenses,
			33.33,
		);
		assert.strictEqual(
			analytics.by_department.find(
				({ department }) => department === "Research",
			)?.expenses,
			66.68,
		);
	});

	test("loads persisted allocation percentages for effective transactions", async () => {
		let selectedColumns = "";
		const query = {
			select(columns: string) {
				selectedColumns = columns;
				return this;
			},
			async in() {
				return {
					data: [
						{
							posting_external_id: "BB-loaded",
							department: "Research",
							tax_area: "wirtschaftlich",
							allocated_amount: -100,
							allocated_percentage: 100,
						},
					],
					error: null,
				};
			},
		};
		setSupabaseClient({
			from: () => query,
		} as unknown as SupabaseClient);

		const effective = await loadEffectiveDepartmentTransactions(
			[
				tx({
					external_id: "BB-loaded",
					cost_location: "161",
					transaction_amount: -125,
					amount: -125,
				}),
			],
			[],
		);

		assert.match(selectedColumns, /allocated_percentage/);
		assert.strictEqual(effective[0].transaction_amount, -125);
	});
});

describe("buildMappingRows", () => {
	test("unions stored mappings with cost locations seen in postings", () => {
		const transactions = [
			tx({
				cost_location: "082",
				transaction_amount: 10,
				postingtext: "Fee A",
			}),
			tx({ cost_location: "82", transaction_amount: 20, postingtext: "Fee B" }),
			tx({
				cost_location: "161",
				transaction_amount: -100,
				postingtext: "Venue",
			}),
		];
		const mappings = [mapping("161", "Makeathon", "wirtschaftlich")];

		const rows = buildMappingRows(transactions, mappings);

		// "82" and "082" collapse into one normalized row.
		const row82 = rows.find((r) => r.cost_location === "82");
		assert.ok(row82);
		assert.strictEqual(row82.posting_count, 2);
		assert.strictEqual(row82.department, null);
		assert.deepStrictEqual(row82.sample_texts, ["Fee A", "Fee B"]);

		const row161 = rows.find((r) => r.cost_location === "161");
		assert.strictEqual(row161?.department, "Makeathon");

		// Unassigned rows sort before assigned ones.
		assert.strictEqual(rows[0].department, null);
	});
});
