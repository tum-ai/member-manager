import assert from "node:assert";
import { describe, test } from "node:test";
import type {
	BuchhaltungsButlerTransaction,
	FinanceDepartmentMapping,
} from "@member-manager/shared";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { applySavedPostingAllocations } = await import(
	"../../src/lib/financeDepartments.js"
);
const { filterTransactionsByScope } = await import(
	"../../src/lib/financeScope.js"
);

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

	test("ignores document numbers and only honours stored cost-location mappings", () => {
		const transaction = {
			...tx("999", -50),
			booking_number: "62026",
		};
		// Without a stored mapping the posting is unmapped, so a scoped view of
		// "Makeathon" must not surface it just because the booking number starts
		// with a 6 — the automatic digit fallback has been removed.
		assert.strictEqual(
			filterTransactionsByScope([transaction], [], {
				department: "Makeathon",
			}).length,
			0,
		);
		// A stored mapping is the only thing that assigns the department.
		assert.strictEqual(
			filterTransactionsByScope(
				[transaction],
				[
					{
						cost_location: "999",
						department: "Makeathon",
						bereich: null,
						note: null,
					},
				],
				{ department: "Makeathon" },
			).length,
			1,
		);
	});

	test("uses saved allocation departments for scoped visibility", () => {
		const effective = applySavedPostingAllocations(
			[{ ...tx("161", -100), external_id: "BB-allocated" }],
			mappings,
			[
				{
					posting_external_id: "BB-allocated",
					department: "Research",
					tax_area: null,
					allocated_amount: -100,
				},
			],
		);

		assert.strictEqual(
			filterTransactionsByScope(effective, mappings, {
				department: "Makeathon",
			}).length,
			0,
		);
		assert.strictEqual(
			filterTransactionsByScope(effective, mappings, {
				department: "Research",
			}).length,
			1,
		);
	});
});
