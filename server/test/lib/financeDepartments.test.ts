import assert from "node:assert";
import { describe, test } from "node:test";
import type {
	BuchhaltungsButlerTransaction,
	FinanceDepartmentMapping,
} from "@member-manager/shared";
import { FINANCE_UNMAPPED_DEPARTMENT } from "@member-manager/shared";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { aggregateByDepartment, buildMappingRows, normalizeCostLocation } =
	await import("../../src/lib/financeDepartments.js");

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
			tx({ cost_location: "120", transaction_amount: 500 }),
			tx({ cost_location: "121", transaction_amount: -200 }),
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
