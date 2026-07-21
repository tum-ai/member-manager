import { describe, expect, it } from "vitest";
import type { BuchhaltungsButlerTransaction } from "./financeTypes";
import {
	buildFinanceExportRows,
	buildFinanceXlsxData,
	filterFinanceTransactions,
	formatFinanceAmount,
	formatFinanceDate,
	getDefaultFinanceDateRange,
	summarizeFinanceTransactions,
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
				sortOrder: "date-desc",
			}),
		).toEqual([transactions[1]]);
	});

	it("sorts transactions by date with newest first by default", () => {
		const oldest = makeTransaction({
			external_id: "BB-oldest",
			date: "2026-01-05",
		});
		const newest = makeTransaction({
			external_id: "BB-newest",
			date: "2026-06-12",
		});
		const filters = {
			dateFrom: "2026-01-01",
			dateTo: "2026-12-31",
			searchTerm: "",
			direction: "all" as const,
			sortOrder: "date-desc" as const,
		};

		expect(filterFinanceTransactions([oldest, newest], filters)).toEqual([
			newest,
			oldest,
		]);
		expect(
			filterFinanceTransactions([oldest, newest], {
				...filters,
				sortOrder: "date-asc",
			}),
		).toEqual([oldest, newest]);
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
			vat: 19,
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

	it("builds typed Excel cells for finance export rows", () => {
		const data = buildFinanceXlsxData(
			buildFinanceExportRows([
				makeTransaction({ transaction_purpose: "", vat: 19 }),
			]),
		);

		expect(data[0]?.[0]).toEqual({
			value: "External ID",
			fontWeight: "bold",
			type: String,
		});
		expect(data[1]?.[0]).toEqual({ value: "BB-1", type: String });
		expect(data[1]?.[5]).toEqual({ value: 19, type: Number });
		expect(data[1]?.[12]).toBeNull();
	});
});
