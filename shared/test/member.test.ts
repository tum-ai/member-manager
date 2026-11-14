import assert from "node:assert";
import { describe, test } from "node:test";
import { TUMAI_DEPARTMENTS } from "../dist/index.js";

describe("TUMAI_DEPARTMENTS", () => {
	test("lists the operational departments in alphabetical order", () => {
		assert.deepStrictEqual(TUMAI_DEPARTMENTS, [
			"Alumni Relations",
			"Community",
			"Innovation Department",
			"Legal & Finance",
			"Makeathon",
			"Marketing",
			"Partners & Sponsors",
			"Research",
			"Software Development",
			"Venture",
		]);
	});
});
