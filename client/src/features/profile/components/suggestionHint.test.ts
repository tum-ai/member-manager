import { describe, expect, it } from "vitest";
import { suggestionHint } from "./suggestionHint";

describe("suggestionHint", () => {
	it("hints only at fields that are prefilled from a suggestion", () => {
		expect(suggestionHint(["batch"], "batch")).toMatch(/suggested/i);
		expect(suggestionHint(["batch"], "surname")).toBeUndefined();
		expect(suggestionHint([], "batch")).toBeUndefined();
	});
});
