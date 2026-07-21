import type { ContractConditionalBlock } from "@member-manager/shared";
import { describe, expect, it } from "vitest";
import { renderContractText } from "./renderContract";

function block(
	overrides: Partial<ContractConditionalBlock> &
		Pick<ContractConditionalBlock, "condition_type">,
): ContractConditionalBlock {
	return {
		id: overrides.id ?? "b1",
		template_id: "t1",
		name: overrides.name ?? "block",
		condition_variable: null,
		condition_value: null,
		block_text: "",
		sort_order: 0,
		...overrides,
	};
}

describe("renderContractText", () => {
	it("substitutes simple variables, including booleans, arrays and objects", () => {
		const out = renderContractText(
			"Name: {{name}} / Flag: {{flag}} / List: {{list}} / Obj: {{obj}} / Missing: {{missing}}",
			{
				name: "ACME",
				flag: true,
				list: ["a", "b"],
				obj: { k: 1 },
				missing: null,
			},
			[],
		);
		expect(out).toContain("Name: ACME");
		expect(out).toContain("Flag: Yes");
		expect(out).toContain("List: a, b");
		expect(out).toContain('Obj: {"k":1}');
		expect(out).toContain("Missing: ");
	});

	it("renders boolean false as No and numbers as strings", () => {
		const out = renderContractText(
			"{{flag}}-{{count}}",
			{ flag: false, count: 3 },
			[],
		);
		expect(out).toBe("No-3");
	});

	it("evaluates inline THEN/ELSE conditionals for each operator", () => {
		const text = [
			'[WENN {{tier}} = "gold" DANN {is-gold} SONST {not-gold}]',
			'[IF {{tier}} != "silver" THEN {not-silver}]',
			'[WENN {{note}} enthält "abc" DANN {has-abc}]',
			'[IF {{note}} contains "ZZZ" THEN {has-zzz} ELSE {no-zzz}]',
		].join(" ");
		const out = renderContractText(
			text,
			{ tier: "gold", note: "xx abc yy" },
			[],
		);
		expect(out).toContain("is-gold");
		expect(out).toContain("not-silver");
		expect(out).toContain("has-abc");
		expect(out).toContain("no-zzz");
		expect(out).not.toContain("not-gold");
	});

	it("drops a conditional with no ELSE branch when unmatched", () => {
		const out = renderContractText(
			'[WENN {{x}} = "1" DANN {yes}]',
			{ x: "0" },
			[],
		);
		expect(out.trim()).toBe("");
	});

	it("appends ALWAYS blocks in sort order and skips empty ones", () => {
		const out = renderContractText("Base", {}, [
			block({
				id: "second",
				condition_type: "ALWAYS",
				block_text: "B2",
				sort_order: 2,
			}),
			block({
				id: "first",
				condition_type: "ALWAYS",
				block_text: "B1",
				sort_order: 1,
			}),
			block({
				id: "empty",
				condition_type: "ALWAYS",
				block_text: "   ",
				sort_order: 3,
			}),
		]);
		expect(out).toBe("Base\n\nB1\n\nB2");
	});

	it("matches IF_YES blocks for truthy yes-like values", () => {
		for (const value of [true, "yes", "ja", "TRUE"]) {
			const out = renderContractText("Base", { consent: value }, [
				block({
					condition_type: "IF_YES",
					condition_variable: "consent",
					block_text: "OK",
				}),
			]);
			expect(out).toBe("Base\n\nOK");
		}
		const no = renderContractText("Base", { consent: false }, [
			block({
				condition_type: "IF_YES",
				condition_variable: "consent",
				block_text: "OK",
			}),
		]);
		expect(no).toBe("Base");
	});

	it("matches IF_NO blocks for falsy/no-like values including empty", () => {
		for (const value of [false, "no", "nein", "FALSE", ""]) {
			const out = renderContractText("Base", { consent: value }, [
				block({
					condition_type: "IF_NO",
					condition_variable: "consent",
					block_text: "NO",
				}),
			]);
			expect(out).toBe("Base\n\nNO");
		}
		const yes = renderContractText("Base", { consent: "yes" }, [
			block({
				condition_type: "IF_NO",
				condition_variable: "consent",
				block_text: "NO",
			}),
		]);
		expect(yes).toBe("Base");
	});

	it("matches IF_VALUE blocks against the configured value", () => {
		const match = renderContractText("Base", { tier: "gold" }, [
			block({
				condition_type: "IF_VALUE",
				condition_variable: "tier",
				condition_value: "gold",
				block_text: "GOLD",
			}),
		]);
		expect(match).toBe("Base\n\nGOLD");

		const noConfiguredValue = renderContractText("Base", { tier: "" }, [
			block({
				condition_type: "IF_VALUE",
				condition_variable: "tier",
				condition_value: null,
				block_text: "X",
			}),
		]);
		expect(noConfiguredValue).toBe("Base\n\nX");
	});

	it("ignores conditional blocks with no condition variable", () => {
		const out = renderContractText("Base", {}, [
			block({
				condition_type: "IF_YES",
				condition_variable: null,
				block_text: "NEVER",
			}),
		]);
		expect(out).toBe("Base");
	});
});
