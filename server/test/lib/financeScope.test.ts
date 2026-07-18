import assert from "node:assert";
import { describe, test } from "node:test";
import type {
	BuchhaltungsButlerTransaction,
	FinanceDepartmentMapping,
} from "@member-manager/shared";
import { filterTransactionsByScope } from "../../src/lib/financeScope.js";

function tx(
	costLocation: string,
	amount: number,
): BuchhaltungsButlerTransaction {
	return {
		external_id: `BB-${costLocation}-${amount}`,
		date: "2026-05-04",
		postingtext: "Sample",
		amount,
		currency: "EUR",
		vat: 0,
		credit_type: "S",
		debit_postingaccount_number: "6850",
		credit_postingaccount_number: "1200",
		cost_location: costLocation,
		cost_location_two: "0",
		transaction_amount: amount,
		transaction_purpose: "Purpose",
	};
}

const mappings: FinanceDepartmentMapping[] = [
	{ cost_location: "161", department: "Makeathon", bereich: null, note: null },
	{
		cost_location: "120",
		department: "Partnerships",
		bereich: null,
		note: null,
	},
];

describe("filterTransactionsByScope", () => {
	test("passes everything through for an unrestricted scope", () => {
		const transactions = [tx("161", -100), tx("120", 500), tx("999", -50)];
		const result = filterTransactionsByScope(transactions, mappings, {
			department: null,
		});
		assert.strictEqual(result.length, 3);
	});

	test("keeps only postings mapped to the scope department", () => {
		const transactions = [tx("161", -100), tx("120", 500), tx("999", -50)];
		const result = filterTransactionsByScope(transactions, mappings, {
			department: "Makeathon",
		});
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].cost_location, "161");
	});

	test("excludes unmapped postings from a scoped view", () => {
		const transactions = [tx("999", -50)];
		const result = filterTransactionsByScope(transactions, mappings, {
			department: "Makeathon",
		});
		assert.strictEqual(result.length, 0);
	});
});
