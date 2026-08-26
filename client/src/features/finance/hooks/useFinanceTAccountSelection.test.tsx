import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	tAccountGroup as group,
	tAccountLine as line,
} from "@/features/finance/financeTAccountFixtures";
import type { FinanceTAccountGroup } from "@/features/finance/financeTypes";
import { useFinanceTAccountSelection } from "./useFinanceTAccountSelection";

const MAKEATHON = "11111111-1111-4111-8111-111111111111";

function groups(): FinanceTAccountGroup[] {
	return [
		group({
			expense_lines: [
				line({ kind: "actual", amount: 119, posting_external_id: "BB-1" }),
				line({ kind: "actual", amount: 340, posting_external_id: "BB-2" }),
				// A Planposten is not an invoice and can never be selected.
				line({ kind: "plan", amount: 800, plan_item_id: "plan-venue" }),
			],
			income_lines: [
				line({
					kind: "actual",
					direction: "income",
					amount: 3000,
					posting_external_id: "BB-3",
				}),
			],
		}),
	];
}

function renderSelection(initial?: {
	groups?: FinanceTAccountGroup[];
	department?: string;
	periodKey?: string;
}) {
	return renderHook(
		(props: {
			groups: FinanceTAccountGroup[];
			department: string;
			periodKey: string;
		}) =>
			useFinanceTAccountSelection({
				groups: props.groups,
				department: props.department,
				periodType: "year",
				periodKey: props.periodKey,
			}),
		{
			initialProps: {
				groups: initial?.groups ?? groups(),
				department: initial?.department ?? "Makeathon",
				periodKey: initial?.periodKey ?? "2026",
			},
		},
	);
}

describe("useFinanceTAccountSelection", () => {
	it("toggles invoices and sums their gross amounts", () => {
		const { result } = renderSelection();

		expect(result.current.count).toBe(0);
		expect(result.current.grossSum).toBe(0);

		act(() => result.current.toggle("BB-1"));
		act(() => result.current.toggle("BB-3"));

		expect(result.current.count).toBe(2);
		expect(result.current.selectedIds).toEqual(["BB-1", "BB-3"]);
		expect(result.current.isSelected("BB-1")).toBe(true);
		expect(result.current.isSelected("BB-2")).toBe(false);
		// Gross magnitudes across both columns — the bar states what is ticked,
		// not a net.
		expect(result.current.grossSum).toBe(3119);

		act(() => result.current.toggle("BB-1"));
		expect(result.current.count).toBe(1);
		expect(result.current.grossSum).toBe(3000);
	});

	it("collects across folders, since a new project spans sub-teams (FR-K1)", () => {
		const { result } = renderSelection({
			groups: [
				group({
					project_name: "Big Makeathon",
					sub_team: "Big Makeathon",
					is_sub_team: true,
					expense_lines: [
						line({ kind: "actual", amount: 500, posting_external_id: "BB-A" }),
					],
				}),
				group({
					project_id: MAKEATHON,
					project_name: "Makeathon",
					expense_lines: [
						line({ kind: "actual", amount: 250, posting_external_id: "BB-B" }),
					],
				}),
			],
		});

		act(() => result.current.toggle("BB-A"));
		act(() => result.current.toggle("BB-B"));

		expect(result.current.count).toBe(2);
		expect(result.current.grossSum).toBe(750);
	});

	it("sums both shares of a posting split across two projects", () => {
		const { result } = renderSelection({
			groups: [
				group({
					project_id: MAKEATHON,
					expense_lines: [
						line({
							kind: "actual",
							amount: 60,
							posting_external_id: "BB-split",
						}),
					],
				}),
				group({
					expense_lines: [
						line({
							kind: "actual",
							amount: 40,
							posting_external_id: "BB-split",
						}),
					],
				}),
			],
		});

		act(() => result.current.toggle("BB-split"));

		// The selection holds whole invoices, so the ticked invoice is worth its
		// full 100, not just the share of the folder it was ticked in.
		expect(result.current.count).toBe(1);
		expect(result.current.grossSum).toBe(100);
	});

	it("survives a background refetch (FR-K7)", () => {
		const { result, rerender } = renderSelection();

		act(() => result.current.toggle("BB-1"));
		expect(result.current.count).toBe(1);

		// A refetch hands back a fresh array with the same content; the ticks stay.
		rerender({ groups: groups(), department: "Makeathon", periodKey: "2026" });

		expect(result.current.count).toBe(1);
		expect(result.current.isSelected("BB-1")).toBe(true);
	});

	it("clears on a department or period change (FR-K7)", () => {
		const { result, rerender } = renderSelection();

		act(() => result.current.toggle("BB-1"));
		rerender({ groups: groups(), department: "Community", periodKey: "2026" });
		expect(result.current.count).toBe(0);

		act(() => result.current.toggle("BB-2"));
		expect(result.current.count).toBe(1);
		rerender({ groups: groups(), department: "Community", periodKey: "2025" });
		expect(result.current.count).toBe(0);
	});

	it("clears on demand", () => {
		const { result } = renderSelection();

		act(() => result.current.toggle("BB-1"));
		act(() => result.current.toggle("BB-2"));
		act(() => result.current.clear());

		expect(result.current.count).toBe(0);
		expect(result.current.selectedIds).toEqual([]);
	});
});
