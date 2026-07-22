import assert from "node:assert";
import { describe, test } from "node:test";
import type { FinanceDepartmentSummary } from "@member-manager/shared";
import {
	isValidFinancePeriodKey,
	resolveFinancePeriodRange,
} from "@member-manager/shared";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { computeBudgetVsActual } = await import(
	"../../src/lib/financeBudgets.js"
);

function summary(
	department: string,
	expenses: number,
	unmapped = false,
): FinanceDepartmentSummary {
	return {
		department,
		bereich: null,
		income: 0,
		expenses,
		net: -expenses,
		count: 1,
		unmapped,
	};
}

function budget(department: string, amount: number) {
	return {
		department,
		period_type: "year" as const,
		period_key: "2026",
		amount_planned: amount,
		currency: "EUR",
		note: null,
	};
}

describe("resolveFinancePeriodRange", () => {
	test("maps a calendar year to Jan–Dec", () => {
		assert.deepStrictEqual(resolveFinancePeriodRange("year", "2026"), {
			dateFrom: "2026-01-01",
			dateTo: "2026-12-31",
		});
	});

	test("maps a winter semester across the year boundary", () => {
		assert.deepStrictEqual(resolveFinancePeriodRange("semester", "WS26"), {
			dateFrom: "2026-10-01",
			dateTo: "2027-03-31",
		});
	});

	test("maps a summer semester to Apr–Sep", () => {
		assert.deepStrictEqual(resolveFinancePeriodRange("semester", "SS26"), {
			dateFrom: "2026-04-01",
			dateTo: "2026-09-30",
		});
	});
});

describe("isValidFinancePeriodKey", () => {
	test("accepts a four-digit year and rejects otherwise", () => {
		assert.ok(isValidFinancePeriodKey("year", "2026"));
		assert.ok(!isValidFinancePeriodKey("year", "WS26"));
	});

	test("accepts WS/SS semester keys and rejects otherwise", () => {
		assert.ok(isValidFinancePeriodKey("semester", "WS26"));
		assert.ok(isValidFinancePeriodKey("semester", "SS30"));
		assert.ok(!isValidFinancePeriodKey("semester", "2026"));
		assert.ok(!isValidFinancePeriodKey("semester", "WS9"));
	});
});

describe("computeBudgetVsActual", () => {
	test("joins actuals to budgets and flags over-budget departments", () => {
		const summaries = [
			summary("Makeathon", 12000),
			summary("Community", 500),
			summary("Nicht zugeordnet", 999, true),
		];
		const budgets = [budget("Makeathon", 10000), budget("Venture", 4000)];

		const { rows, totals } = computeBudgetVsActual(summaries, budgets);

		// Makeathon spent 12k of a 10k budget → over budget, negative remaining.
		const makeathon = rows.find((r) => r.department === "Makeathon");
		assert.ok(makeathon);
		assert.strictEqual(makeathon.amount_planned, 10000);
		assert.strictEqual(makeathon.actual_expenses, 12000);
		assert.strictEqual(makeathon.remaining, -2000);
		assert.strictEqual(makeathon.pct_used, 120);
		assert.strictEqual(makeathon.over_budget, true);

		// Venture has a budget but no spend yet.
		const venture = rows.find((r) => r.department === "Venture");
		assert.strictEqual(venture?.actual_expenses, 0);
		assert.strictEqual(venture?.remaining, 4000);
		assert.strictEqual(venture?.over_budget, false);

		// Community spent without a budget → planned/remaining/pct null.
		const community = rows.find((r) => r.department === "Community");
		assert.strictEqual(community?.amount_planned, null);
		assert.strictEqual(community?.remaining, null);
		assert.strictEqual(community?.pct_used, null);

		// The unmapped bucket is excluded from budget rows.
		assert.ok(!rows.some((r) => r.department === "Nicht zugeordnet"));

		// Over-budget department sorts first.
		assert.strictEqual(rows[0].department, "Makeathon");

		assert.strictEqual(totals.amount_planned, 14000);
		assert.strictEqual(totals.actual_expenses, 12500);
		assert.strictEqual(totals.remaining, 1500);
	});

	test("includes visible departments before they have budgets or actuals", () => {
		const { rows, totals } = computeBudgetVsActual(
			[],
			[],
			["Makeathon", "Research"],
		);

		assert.deepStrictEqual(
			rows.map((row) => row.department),
			["Makeathon", "Research"],
		);
		assert.ok(
			rows.every(
				(row) =>
					row.amount_planned === null &&
					row.actual_expenses === 0 &&
					row.remaining === null,
			),
		);
		assert.deepStrictEqual(totals, {
			amount_planned: 0,
			actual_expenses: 0,
			remaining: 0,
		});
	});
});
