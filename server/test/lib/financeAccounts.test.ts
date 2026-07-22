import assert from "node:assert";
import { describe, test } from "node:test";
import type {
	BuchhaltungsButlerTransaction,
	FinanceAccountLabel,
} from "@member-manager/shared";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { accountKey, aggregateByAccount, buildAccountLabelRows } = await import(
	"../../src/lib/financeAccounts.js"
);

function tx(
	overrides: Partial<BuchhaltungsButlerTransaction> &
		Pick<
			BuchhaltungsButlerTransaction,
			"debit_postingaccount_number" | "transaction_amount"
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
		credit_postingaccount_number: "1200",
		cost_location: "161",
		cost_location_two: "0",
		transaction_purpose: "Purpose",
		...overrides,
	};
}

const label = (account: string, value: string | null): FinanceAccountLabel => ({
	account,
	label: value,
	note: null,
});

describe("aggregateByAccount", () => {
	test("keeps the persisted missing-account key stable", () => {
		assert.strictEqual(
			accountKey(
				tx({ debit_postingaccount_number: "", transaction_amount: -20 }),
			),
			"Ohne Konto",
		);
	});

	test("groups postings by their debit (P&L) account and attaches labels", () => {
		const transactions = [
			tx({ debit_postingaccount_number: "6850", transaction_amount: -4800 }),
			tx({ debit_postingaccount_number: "6850", transaction_amount: -3900 }),
			tx({ debit_postingaccount_number: "8450", transaction_amount: 7500 }),
		];
		const labels = [label("6850", "Veranstaltungen")];

		const result = aggregateByAccount(transactions, labels);

		const events = result.find((a) => a.account === "6850");
		assert.ok(events);
		assert.strictEqual(events.label, "Veranstaltungen");
		assert.strictEqual(events.expenses, 8700);
		assert.strictEqual(events.count, 2);

		const income = result.find((a) => a.account === "8450");
		assert.ok(income);
		// Unlabelled account keeps its number and a null label.
		assert.strictEqual(income.label, null);
		assert.strictEqual(income.income, 7500);

		// Highest expenses first.
		assert.strictEqual(result[0].account, "6850");
	});
});

describe("buildAccountLabelRows", () => {
	test("unions stored labels with accounts seen in postings", () => {
		const transactions = [
			tx({
				debit_postingaccount_number: "6840",
				transaction_amount: -20,
				postingtext: "Vercel",
			}),
			tx({
				debit_postingaccount_number: "6840",
				transaction_amount: -6,
				postingtext: "Notion",
			}),
			tx({
				debit_postingaccount_number: "8450",
				transaction_amount: 7500,
				postingtext: "Sponsoring",
			}),
		];
		const labels = [label("8450", "Erlöse Sponsoring")];

		const rows = buildAccountLabelRows(transactions, labels);

		const row6840 = rows.find((r) => r.account === "6840");
		assert.ok(row6840);
		assert.strictEqual(row6840.posting_count, 2);
		assert.strictEqual(row6840.label, null);
		assert.deepStrictEqual(row6840.sample_texts, ["Vercel", "Notion"]);

		const row8450 = rows.find((r) => r.account === "8450");
		assert.strictEqual(row8450?.label, "Erlöse Sponsoring");

		// Unlabelled rows sort before labelled ones.
		assert.strictEqual(rows[0].label, null);
	});
});
