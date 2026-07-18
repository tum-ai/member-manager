import assert from "node:assert";
import { describe, test } from "node:test";
import type {
	BuchhaltungsButlerTransaction,
	FinanceCategoryMapping,
} from "@member-manager/shared";
import { FINANCE_UNMAPPED_CATEGORY } from "@member-manager/shared";
import {
	aggregateByCategory,
	buildCategoryMappingRows,
} from "../../src/lib/financeCategories.js";

function tx(
	overrides: Partial<BuchhaltungsButlerTransaction> &
		Pick<
			BuchhaltungsButlerTransaction,
			"cost_location_two" | "transaction_amount"
		>,
): BuchhaltungsButlerTransaction {
	return {
		external_id: "BB-1",
		date: "2026-05-04",
		postingtext: "Sample",
		amount: overrides.transaction_amount,
		currency: "EUR",
		vat: 0,
		credit_type: "S",
		debit_postingaccount_number: "6850",
		credit_postingaccount_number: "1200",
		cost_location: "161",
		transaction_purpose: "Purpose",
		...overrides,
	};
}

const label = (
	cost_location_two: string,
	value: string | null,
): FinanceCategoryMapping => ({
	cost_location_two,
	label: value,
	note: null,
});

describe("aggregateByCategory", () => {
	test("groups postings by label and buckets unlabelled ones", () => {
		const transactions = [
			tx({ cost_location_two: "1", transaction_amount: -3900 }),
			tx({ cost_location_two: "01", transaction_amount: -840 }),
			tx({ cost_location_two: "3", transaction_amount: -600 }),
			// No label for "0" → lands in the unmapped bucket.
			tx({ cost_location_two: "0", transaction_amount: 7500 }),
		];
		const mappings = [label("1", "Catering")];

		const result = aggregateByCategory(transactions, mappings);

		const catering = result.find((c) => c.category === "Catering");
		assert.ok(catering);
		// "1" and "01" collapse into one normalized category.
		assert.strictEqual(catering.expenses, 4740);
		assert.strictEqual(catering.count, 2);
		assert.strictEqual(catering.unmapped, false);

		const unmapped = result.find((c) => c.unmapped);
		assert.ok(unmapped);
		assert.strictEqual(unmapped.category, FINANCE_UNMAPPED_CATEGORY);
		// The "3" posting has no label either, so it joins the unmapped bucket.
		assert.strictEqual(unmapped.count, 2);
		assert.strictEqual(unmapped.income, 7500);

		// Unmapped bucket always sorts last.
		assert.strictEqual(
			result[result.length - 1].category,
			FINANCE_UNMAPPED_CATEGORY,
		);
	});
});

describe("buildCategoryMappingRows", () => {
	test("unions stored labels with second cost locations seen in postings", () => {
		const transactions = [
			tx({
				cost_location_two: "1",
				transaction_amount: -10,
				postingtext: "Food A",
			}),
			tx({
				cost_location_two: "01",
				transaction_amount: -20,
				postingtext: "Food B",
			}),
			tx({
				cost_location_two: "5",
				transaction_amount: -40,
				postingtext: "Software",
			}),
		];
		const mappings = [label("5", "Software")];

		const rows = buildCategoryMappingRows(transactions, mappings);

		const row1 = rows.find((r) => r.cost_location_two === "1");
		assert.ok(row1);
		assert.strictEqual(row1.posting_count, 2);
		assert.strictEqual(row1.label, null);
		assert.deepStrictEqual(row1.sample_texts, ["Food A", "Food B"]);

		const row5 = rows.find((r) => r.cost_location_two === "5");
		assert.strictEqual(row5?.label, "Software");

		// Unlabelled rows sort before labelled ones.
		assert.strictEqual(rows[0].label, null);
	});
});
