import assert from "node:assert";
import { describe, test } from "node:test";
import type { BuchhaltungsButlerTransaction } from "@member-manager/shared";
import {
	aggregateByVatRate,
	embeddedVat,
	expenseVatTotal,
} from "../../src/lib/financeVat.js";

function tx(
	overrides: Partial<BuchhaltungsButlerTransaction> &
		Pick<BuchhaltungsButlerTransaction, "transaction_amount" | "vat">,
): BuchhaltungsButlerTransaction {
	return {
		external_id: "BB-1",
		date: "2026-05-04",
		postingtext: "Sample",
		amount: overrides.transaction_amount,
		currency: "EUR",
		credit_type: "S",
		debit_postingaccount_number: "6840",
		credit_postingaccount_number: "1200",
		cost_location: "130",
		cost_location_two: "5",
		transaction_purpose: "Purpose",
		...overrides,
	};
}

describe("embeddedVat", () => {
	test("extracts the tax portion contained in a gross amount", () => {
		// 119 gross at 19 % contains 19 VAT.
		assert.strictEqual(embeddedVat(-119, 19), 19);
		assert.strictEqual(embeddedVat(119, 19), 19);
	});

	test("returns zero for a zero or missing rate", () => {
		assert.strictEqual(embeddedVat(-100, 0), 0);
		assert.strictEqual(embeddedVat(-100, Number.NaN), 0);
	});
});

describe("expenseVatTotal", () => {
	test("sums VAT of expense postings only", () => {
		const total = expenseVatTotal([
			tx({ transaction_amount: -119, vat: 19 }),
			tx({ transaction_amount: -107, vat: 7 }),
			// Income posting is ignored.
			tx({ transaction_amount: 1190, vat: 19 }),
		]);
		assert.strictEqual(total, 26);
	});
});

describe("aggregateByVatRate", () => {
	test("groups expenses by rate, highest first", () => {
		const rows = aggregateByVatRate([
			tx({ transaction_amount: -119, vat: 19 }),
			tx({ transaction_amount: -238, vat: 19 }),
			tx({ transaction_amount: -107, vat: 7 }),
			tx({ transaction_amount: -50, vat: 0 }),
			// Income is excluded.
			tx({ transaction_amount: 500, vat: 19 }),
		]);

		assert.deepStrictEqual(
			rows.map((r) => r.rate),
			[19, 7, 0],
		);
		const nineteen = rows.find((r) => r.rate === 19);
		assert.ok(nineteen);
		assert.strictEqual(nineteen.expenses, 357);
		assert.strictEqual(nineteen.vat, 57);
		assert.strictEqual(nineteen.count, 2);

		const zero = rows.find((r) => r.rate === 0);
		assert.strictEqual(zero?.vat, 0);
	});
});
