import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	contractBlockMatches,
	evaluateContractCondition,
	renderContractText,
	stringifyContractVariable,
} from "../src/contractRenderer.ts";
import type { ContractRenderableBlock } from "../src/contracts.ts";

function block(
	overrides: Partial<ContractRenderableBlock> &
		Pick<ContractRenderableBlock, "condition_type">,
): ContractRenderableBlock {
	return {
		condition_variable: null,
		condition_value: null,
		block_text: "",
		sort_order: 0,
		...overrides,
	};
}

describe("contract renderer", () => {
	test("substitutes values and evaluates inline conditions", () => {
		const template = [
			"Name: {{name}}",
			'[IF {{tier}} = "gold" THEN {Gold} ELSE {Standard}]',
			'[WENN {{note}} enthält "priority" DANN {Priority}]',
		].join("\n");

		assert.equal(
			renderContractText(
				template,
				{
					name: "ACME",
					tier: "gold",
					note: "priority customer",
				},
				[],
			),
			"Name: ACME\nGold\nPriority",
		);
	});

	test("appends matching blocks in sort order", () => {
		const blocks = [
			block({
				condition_type: "IF_VALUE",
				condition_variable: "tier",
				condition_value: "gold",
				block_text: "Second",
				sort_order: 2,
			}),
			block({
				condition_type: "ALWAYS",
				block_text: "First",
				sort_order: 1,
			}),
			block({
				condition_type: "IF_NO",
				condition_variable: "enabled",
				block_text: "Third",
				sort_order: 3,
			}),
		];

		assert.equal(
			renderContractText("Base", { tier: "gold", enabled: false }, blocks),
			"Base\n\nFirst\n\nSecond\n\nThird",
		);
	});

	test("supports yes, no, value, and missing-variable block conditions", () => {
		assert.equal(
			contractBlockMatches(
				block({
					condition_type: "IF_YES",
					condition_variable: "answer",
				}),
				{ answer: "ja" },
			),
			true,
		);
		assert.equal(
			contractBlockMatches(
				block({
					condition_type: "IF_NO",
					condition_variable: "answer",
				}),
				{ answer: "" },
			),
			true,
		);
		assert.equal(
			contractBlockMatches(
				block({
					condition_type: "IF_VALUE",
					condition_variable: "answer",
					condition_value: "custom",
				}),
				{ answer: "custom" },
			),
			true,
		);
		assert.equal(
			contractBlockMatches(
				block({
					condition_type: "IF_YES",
					condition_variable: null,
				}),
				{},
			),
			false,
		);
	});

	test("preserves client and server date formatting modes", () => {
		const date = new Date("2026-07-14T12:30:00.000Z");

		assert.equal(stringifyContractVariable(date), '"2026-07-14T12:30:00.000Z"');
		assert.equal(
			stringifyContractVariable(date, { formatDates: true }),
			"2026-07-14",
		);
	});

	test("keeps unsupported inline operators unmatched", () => {
		assert.equal(evaluateContractCondition("a", ">", "b"), false);
	});
});
