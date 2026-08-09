import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	BuchhaltungsButlerTransactionSchema,
	FinanceBudgetTransferRequestCreateSchema,
	FinancePlanItemUpdateSchema,
	FinancePostingAllocationReplaceSchema,
	FinanceProjectCreateSchema,
	FinanceProjectSchema,
	FinanceReallocationRequestCreateSchema,
	FinanceReconciliationPostingSchema,
	FinanceReimbursementLinkSchema,
	FinanceTAccountResponseSchema,
} from "../dist/index.js";

describe("finance management contracts", () => {
	test("accepts BuchhaltungsButler booking and assigned invoice numbers", () => {
		const posting = BuchhaltungsButlerTransactionSchema.parse({
			external_id: "BB-1001",
			date: "2026-01-20",
			postingtext: "Sponsoring",
			amount: 15_000,
			currency: "EUR",
			vat: 0,
			credit_type: "credit",
			debit_postingaccount_number: "8450",
			credit_postingaccount_number: "1200",
			booking_number: "21001",
			cost_location: "120",
			cost_location_two: "0",
			transaction_amount: 15_000,
			transaction_purpose: "Partnership",
			receipts_assigned_invoice_numbers: "INV-21001",
		});

		assert.strictEqual(posting.booking_number, "21001");
		assert.strictEqual(posting.receipts_assigned_invoice_numbers, "INV-21001");
	});

	test("accepts signed project targets for valid finance periods", () => {
		const project = FinanceProjectCreateSchema.parse({
			name: "Makeathon 2026",
			department: "Makeathon",
			period_type: "year",
			period_key: "2026",
			tax_area: "wirtschaftlich",
			target_amount: -25_000,
		});

		assert.strictEqual(project.target_amount, -25_000);
	});

	test("validates department budget transfer requests", () => {
		const transfer = FinanceBudgetTransferRequestCreateSchema.parse({
			source_department: "Makeathon",
			target_department: "Community",
			period_type: "year",
			period_key: "2026",
			amount: 2500,
			reason: "Move unused venue budget",
		});
		assert.strictEqual(transfer.amount, 2500);
		assert.strictEqual(
			FinanceBudgetTransferRequestCreateSchema.safeParse({
				...transfer,
				target_department: "Makeathon",
			}).success,
			false,
		);
	});

	test("accepts PostgreSQL timestamptz offsets in project responses", () => {
		const project = FinanceProjectSchema.parse({
			id: "10000000-0000-4000-8000-000000000001",
			parent_project_id: null,
			name: "Makeathon 2026",
			department: "Makeathon",
			period_type: "year",
			period_key: "2026",
			tax_area: "wirtschaftlich",
			target_amount: -20_000,
			status: "active",
			description: null,
			created_at: "2026-07-21T21:28:39.480+00:00",
			updated_at: "2026-07-21T21:28:39.480+00:00",
		});

		assert.strictEqual(project.created_at, "2026-07-21T21:28:39.480+00:00");
	});

	test("requires one allocation mode and a target", () => {
		assert.strictEqual(
			FinancePostingAllocationReplaceSchema.safeParse({
				allocations: [
					{
						department: "Makeathon",
						amount: 50,
						percentage: 50,
					},
				],
			}).success,
			false,
		);
		assert.strictEqual(
			FinancePostingAllocationReplaceSchema.safeParse({
				allocations: [{ percentage: 100 }],
			}).success,
			false,
		);
	});

	test("rejects duplicate normalized allocation targets", () => {
		const allocations = [
			{
				department: " Makeathon ",
				tax_area: null,
				percentage: 60,
			},
			{
				department: "Makeathon",
				percentage: 40,
			},
		];

		const replacement = FinancePostingAllocationReplaceSchema.safeParse({
			allocations,
		});
		assert.strictEqual(replacement.success, false);
		assert.match(
			replacement.error?.issues[0]?.message ?? "",
			/allocation targets must be unique/i,
		);

		const reallocation = FinanceReallocationRequestCreateSchema.safeParse({
			posting_external_id: "BB-1001",
			reason: "Split correction",
			allocations,
		});
		assert.strictEqual(reallocation.success, false);
		assert.match(
			reallocation.error?.issues[0]?.message ?? "",
			/allocation targets must be unique/i,
		);
	});

	test("allows plan-item updates to omit direction", () => {
		const update = FinancePlanItemUpdateSchema.parse({
			label: "Sponsoring income",
			planned_amount: 15_000,
			status: "committed",
		});

		assert.strictEqual(update.direction, undefined);
	});

	test("requires nonnegative reconciliation overmatch amounts", () => {
		const row = {
			posting: {
				external_id: "BB-1001",
				date: "2026-01-20",
				postingtext: "Sponsoring",
				amount: 100,
				currency: "EUR",
				vat: 0,
				credit_type: "credit",
				debit_postingaccount_number: "8450",
				credit_postingaccount_number: "1200",
				cost_location: "120",
				cost_location_two: "0",
				transaction_amount: 100,
				transaction_purpose: "Partnership",
			},
			scope_amount: 100,
			allocations: [],
			matches: [],
			matched_amount: 120,
			unmatched_amount: 0,
			overmatched_amount: 20,
		};

		assert.strictEqual(
			FinanceReconciliationPostingSchema.parse(row).overmatched_amount,
			20,
		);
		assert.strictEqual(
			FinanceReconciliationPostingSchema.safeParse({
				...row,
				overmatched_amount: -1,
			}).success,
			false,
		);
	});

	test("rejects control characters in reimbursement posting links", () => {
		assert.strictEqual(
			FinanceReimbursementLinkSchema.safeParse({
				bb_posting_external_id: "BB-1001\nforged",
			}).success,
			false,
		);
	});

	test("accepts a T-account response with an ungrouped bucket and a project", () => {
		const parsed = FinanceTAccountResponseSchema.safeParse({
			period_type: "year",
			period_key: "2026",
			department: "Makeathon",
			groups: [
				{
					project_id: null,
					project_name: null,
					parent_project_id: null,
					target_amount: null,
					expense_lines: [
						{
							kind: "actual",
							direction: "expense",
							label: "Catering",
							category: "1",
							project_id: null,
							amount: 119,
							vat_amount: 19,
							status: null,
							posting_external_id: "BB-1",
							plan_item_id: null,
						},
					],
					income_lines: [],
					actual: { income: 0, expenses: 119, saldo: -119 },
					plan: { income: 0, expenses: 119, saldo: -119 },
				},
				{
					project_id: "11111111-1111-4111-8111-111111111111",
					project_name: "Hackathon",
					parent_project_id: null,
					target_amount: 50000,
					expense_lines: [],
					income_lines: [
						{
							kind: "plan",
							direction: "income",
							label: "Sponsoring",
							category: null,
							project_id: "11111111-1111-4111-8111-111111111111",
							amount: 15420,
							vat_amount: null,
							status: "planned",
							posting_external_id: null,
							plan_item_id: "22222222-2222-4222-8222-222222222222",
						},
					],
					actual: { income: 0, expenses: 0, saldo: 0 },
					plan: { income: 15420, expenses: 0, saldo: 15420 },
				},
			],
			totals: {
				actual: { income: 0, expenses: 119, saldo: -119 },
				plan: { income: 15420, expenses: 119, saldo: 15301 },
				vat_income: 0,
				vat_expenses: 19,
			},
			source: "mock",
			generated_at: "2026-08-04T10:00:00.000Z",
		});
		assert.strictEqual(parsed.success, true);
	});

	test("rejects a T-account line with a negative amount", () => {
		assert.strictEqual(
			FinanceTAccountResponseSchema.safeParse({
				period_type: "year",
				period_key: "2026",
				department: "Makeathon",
				groups: [
					{
						project_id: null,
						project_name: null,
						parent_project_id: null,
						target_amount: null,
						expense_lines: [
							{
								kind: "actual",
								direction: "expense",
								label: "Catering",
								category: null,
								project_id: null,
								amount: -1,
								vat_amount: null,
								status: null,
								posting_external_id: "BB-1",
								plan_item_id: null,
							},
						],
						income_lines: [],
						actual: { income: 0, expenses: 1, saldo: -1 },
						plan: { income: 0, expenses: 1, saldo: -1 },
					},
				],
				totals: {
					actual: { income: 0, expenses: 1, saldo: -1 },
					plan: { income: 0, expenses: 1, saldo: -1 },
					vat_income: 0,
					vat_expenses: 0,
				},
				source: "mock",
				generated_at: "2026-08-04T10:00:00.000Z",
			}).success,
			false,
		);
	});
});
