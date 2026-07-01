import assert from "node:assert";
import { describe, test } from "node:test";
import { deflateSync } from "node:zlib";
import { createTextPdf } from "../../src/lib/simplePdf.js";

// Build a minimal 1x1 RGB PNG. The decoder skips CRCs, so dummy CRC bytes are
// fine; only the chunk structure and IDAT deflate stream must be valid.
function tinyPng(): Buffer {
	const chunk = (type: string, data: Buffer): Buffer => {
		const length = Buffer.alloc(4);
		length.writeUInt32BE(data.length, 0);
		return Buffer.concat([
			length,
			Buffer.from(type, "ascii"),
			data,
			Buffer.alloc(4),
		]);
	};
	const signature = Buffer.from("89504e470d0a1a0a", "hex");
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(1, 0); // width
	ihdr.writeUInt32BE(1, 4); // height
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // color type: RGB
	// scanline: filter byte 0 + one RGB pixel.
	const idat = deflateSync(Buffer.from([0, 10, 20, 30]));
	return Buffer.concat([
		signature,
		chunk("IHDR", ihdr),
		chunk("IDAT", idat),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

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

	test("embeds signature images as XObjects on an appended page", () => {
		const pdf = createTextPdf("Contract body text.", [
			{ label: "Partner: Jane Doe", sublabel: "2026-07-01", png: tinyPng() },
		]);
		const raw = pdf.toString("latin1");

		assert.match(raw, /\/Subtype \/Image/);
		assert.match(raw, /\/Im0 Do/);
		assert.match(raw, /\(Signaturen\) Tj/);
		assert.match(raw, /\(Partner: Jane Doe\) Tj/);
	});

	test("skips invalid signature images instead of throwing", () => {
		assert.doesNotThrow(() =>
			createTextPdf("Contract body text.", [
				{ label: "Partner: Broken", png: Buffer.from("not a png") },
			]),
		);
		const pdf = createTextPdf("Body", [
			{ label: "Partner: Broken", png: Buffer.from("not a png") },
		]);
		// No image XObject is emitted for an undecodable signature.
		assert.doesNotMatch(pdf.toString("latin1"), /\/Subtype \/Image/);
	});
});
