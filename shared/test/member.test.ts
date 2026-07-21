import assert from "node:assert";
import { describe, test } from "node:test";
import { TUMAI_DEPARTMENTS } from "../dist/index.js";

describe("TUMAI_DEPARTMENTS", () => {
	test("matches the operational departments used by seeded members", () => {
		assert.deepStrictEqual(TUMAI_DEPARTMENTS, [
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
