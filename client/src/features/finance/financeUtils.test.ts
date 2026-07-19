import { describe, expect, it } from "vitest";
import type { BuchhaltungsButlerTransaction } from "./financeTypes";
import {
	buildFinanceExportRows,
	filterFinanceTransactions,
	formatBereichLabel,
	formatFinanceAmount,
	formatFinanceAmountCompact,
	formatFinanceDate,
	formatFinanceMonth,
	formatFinancePeriodLabel,
	getDefaultFinanceDateRange,
	getDefaultFinancePeriod,
	listFinancePeriodKeys,
	summarizeFinanceTransactions,
	switchFinancePeriodType,
} from "./financeUtils";

function makeTransaction(
	overrides: Partial<BuchhaltungsButlerTransaction> = {},
): BuchhaltungsButlerTransaction {
	return {
		external_id: "BB-1",
		date: "2026-02-14",
		postingtext: "Sponsoring JetBrains",
		amount: 7500,
		currency: "EUR",
		vat: 0,
		credit_type: "credit",
		debit_postingaccount_number: "8450",
		credit_postingaccount_number: "1200",
		cost_location: "120",
		cost_location_two: "0",
		transaction_amount: 7500,
		transaction_purpose: "JetBrains partnership tranche 1",
		...overrides,
	};
}

describe("financeUtils", () => {
	it("builds the default current-year date range", () => {
		expect(
			getDefaultFinanceDateRange(new Date("2026-07-08T12:00:00Z")),
		).toEqual({
			dateFrom: "2026-01-01",
			dateTo: "2026-07-08",
		});
	});

	it("formats EUR amounts for finance views", () => {
		expect(formatFinanceAmount(1234.5)).toBe("1.234,50 €");
	});

	it("formats civil transaction dates without timezone conversion", () => {
		expect(formatFinanceDate("2026-02-14")).toBe("14 Feb 2026");
	});

	it("filters transactions by direction and search term", () => {
		const transactions = [
			makeTransaction(),
			makeTransaction({
				external_id: "BB-2",
				postingtext: "Slack subscription",
				transaction_amount: -266,
				amount: -266,
				cost_location: "130",
			}),
		];

		expect(
			filterFinanceTransactions(transactions, {
				dateFrom: "2026-01-01",
				dateTo: "2026-12-31",
				searchTerm: "slack",
				direction: "expenses",
			}),
		).toEqual([transactions[1]]);
	});

	it("summarizes income, expenses, net, and count", () => {
		const summary = summarizeFinanceTransactions([
			makeTransaction({ transaction_amount: 7500, vat: 0 }),
			makeTransaction({
				external_id: "BB-2",
				transaction_amount: -266,
				vat: 19,
			}),
		]);

		expect(summary).toEqual({
			count: 2,
			income: 7500,
			expenses: 266,
			net: 7234,
			// 19% VAT contained in the gross 266 expense: 266 * 19/119.
			vat: 42.47,
		});
	});

	it("maps transactions into export rows", () => {
		const rows = buildFinanceExportRows([makeTransaction()]);

		expect(rows[0]).toMatchObject({
			"External ID": "BB-1",
			"Posting Text": "Sponsoring JetBrains",
			"Transaction Amount": 7500,
		});
	});

	it("formats Bereich labels in German, with a fallback for null", () => {
		expect(formatBereichLabel("ideell")).toBe("Ideeller Bereich");
		expect(formatBereichLabel("wirtschaftlich")).toBe(
			"Wirtschaftlicher Geschäftsbetrieb",
		);
		expect(formatBereichLabel(null)).toBe("Ohne Bereich");
	});

	it("formats month keys as compact labels", () => {
		expect(formatFinanceMonth("2026-02")).toBe("Feb 2026");
		expect(formatFinanceMonth("not-a-month")).toBe("not-a-month");
	});

	it("formats amounts compactly, scaling with magnitude", () => {
		expect(formatFinanceAmountCompact(940)).toBe("940 €");
		expect(formatFinanceAmountCompact(35_500)).toBe("36k €");
		expect(formatFinanceAmountCompact(1_240_000)).toBe("1,2 Mio €");
	});

	it("defaults the budget period to the current calendar year", () => {
		const period = getDefaultFinancePeriod(new Date("2026-07-18T00:00:00Z"));
		expect(period).toEqual({ type: "year", key: "2026" });
	});

	it("lists selectable period keys per type, newest first", () => {
		const reference = new Date("2026-07-18T00:00:00Z");
		expect(listFinancePeriodKeys("year", reference)).toEqual([
			"2027",
			"2026",
			"2025",
			"2024",
		]);
		const semesters = listFinancePeriodKeys("semester", reference);
		expect(semesters[0]).toBe("WS27");
		expect(semesters).toContain("SS26");
	});

	it("carries the year across a period-type switch", () => {
		expect(switchFinancePeriodType("semester", "2026")).toEqual({
			type: "semester",
			key: "WS26",
		});
		expect(switchFinancePeriodType("year", "WS26")).toEqual({
			type: "year",
			key: "2026",
		});
	});

	it("formats period labels in German", () => {
		expect(formatFinancePeriodLabel({ type: "year", key: "2026" })).toBe(
			"2026",
		);
		expect(formatFinancePeriodLabel({ type: "semester", key: "WS26" })).toBe(
			"Wintersemester 2026",
		);
		expect(formatFinancePeriodLabel({ type: "semester", key: "SS26" })).toBe(
			"Sommersemester 2026",
		);
	});
});
