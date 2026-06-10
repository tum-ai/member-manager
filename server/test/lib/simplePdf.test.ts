import assert from "node:assert";
import { describe, test } from "node:test";
import { createTextPdf } from "../../src/lib/simplePdf.js";

describe("simplePdf", () => {
	test("uses the contract template page metrics", () => {
		const pdf = createTextPdf(
			"SPONSORINGVERTRAG\n\n§ 1 Vertragsgegenstand\n\nHello Partner with enough words to justify the first line across the contract page width.\n\n- First item\n- Second item",
		);
		const raw = pdf.toString("utf8");

		assert.match(raw, /^%PDF-1\.4/);
		assert.match(raw, /\/BaseFont \/Helvetica-Bold/);
		assert.match(raw, /\/F2 20 Tf/);
		assert.match(raw, /\/F1 11 Tf/);
		assert.match(raw, /1 0 0 1 209\.10 771\.00 Tm/);
		assert.match(raw, /1 0 0 1 71\.00 729\.00 Tm/);
		assert.match(raw, /Tw/);
		assert.match(raw, /\(- First item\) Tj/);
	});
});
