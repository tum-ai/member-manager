import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deflateSync } from "node:zlib";
import { buildContractDocDefinition } from "../../src/lib/contracts/contractPdfDocument.js";
import { createTextPdf } from "../../src/lib/simplePdf.js";

// Build a minimal 1x1 RGB PNG. Only the chunk structure and the IDAT deflate
// stream have to be valid for pdfmake to embed it.
function tinyPng(): Buffer {
	const table = new Uint32Array(256);
	for (let index = 0; index < 256; index += 1) {
		let value = index;
		for (let bit = 0; bit < 8; bit += 1) {
			value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}
		table[index] = value >>> 0;
	}
	const crc = (buffer: Buffer): number => {
		let value = 0xffffffff;
		for (const byte of buffer)
			value = table[(value ^ byte) & 0xff] ^ (value >>> 8);
		return (value ^ 0xffffffff) >>> 0;
	};
	const chunk = (type: string, data: Buffer): Buffer => {
		const length = Buffer.alloc(4);
		length.writeUInt32BE(data.length, 0);
		const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
		const checksum = Buffer.alloc(4);
		checksum.writeUInt32BE(crc(body), 0);
		return Buffer.concat([length, body, checksum]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(1, 0);
	ihdr.writeUInt32BE(1, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	return Buffer.concat([
		Buffer.from("89504e470d0a1a0a", "hex"),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(Buffer.from([0, 10, 20, 30]))),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

// biome-ignore lint/suspicious/noExplicitAny: the doc definition is deliberately untyped structure.
type Block = any;

/** pdfmake keeps inline runs as an array; flatten it back to plain text. */
function textOf(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(textOf).join("");
	if (value && typeof value === "object" && "text" in value) {
		return textOf((value as { text: unknown }).text);
	}
	return "";
}

function blocksOf(
	text: string,
	signatures: Parameters<typeof createTextPdf>[1] = [],
) {
	return buildContractDocDefinition(text, signatures).content as Block[];
}

describe("contract pdf document", () => {
	test("uses the contract template page setup", () => {
		const definition = buildContractDocDefinition("Body");

		assert.equal(definition.pageSize, "A4");
		assert.deepEqual(definition.pageMargins, [71, 71, 71, 57]);
		assert.equal(definition.defaultStyle.fontSize, 11);
		assert.equal(definition.defaultStyle.lineHeight, 1.5);
		assert.equal(definition.defaultStyle.alignment, "justify");
		assert.equal(definition.defaultStyle.font, "Helvetica");
	});

	test("prints the TUM.ai logo and a page footer", () => {
		const definition = buildContractDocDefinition("Body");

		const header = definition.header as Block;
		assert.match(String(header.image), /^data:image\/png;base64,/);
		assert.equal(header.alignment, "right");
		assert.equal((definition.footer(2, 7) as Block).text, "2 | 7");
	});

	test("centers the contract title in bold", () => {
		const [title] = blocksOf("# SPONSORINGVERTRAG\n\nBody text");

		assert.equal(textOf(title.text), "SPONSORINGVERTRAG");
		assert.equal(title.bold, true);
		assert.equal(title.alignment, "center");
	});

	test("sets § headings in bold, flush left", () => {
		const blocks = blocksOf("## § 1 Vertragsgegenstand\n\nDer Vertrag gilt.");

		assert.equal(textOf(blocks[0].text), "§ 1 Vertragsgegenstand");
		assert.equal(blocks[0].bold, true);
		assert.equal(blocks[0].alignment, "left");
		assert.equal(textOf(blocks[1].text), "Der Vertrag gilt.");
	});

	test("hangs outline items beside their label", () => {
		const [item] = blocksOf(
			"(a) Das Partnerunternehmen zahlt einen Betrag, der über mehrere Zeilen läuft.",
		);

		assert.equal(item.columns[0].text, "(a)");
		assert.equal(
			textOf(item.columns[1].text),
			"Das Partnerunternehmen zahlt einen Betrag, der über mehrere Zeilen läuft.",
		);
	});

	test("renders dash lists as bullet lists", () => {
		const [list] = blocksOf("- Erste Leistung\n- Zweite Leistung");

		assert.deepEqual(list.ul.map(textOf), [
			"Erste Leistung",
			"Zweite Leistung",
		]);
	});

	// One template line is one Word paragraph, so an address block prints as
	// three tight paragraphs rather than one stretched, justified block.
	test("keeps address lines tight, with space only after the last one", () => {
		const blocks = blocksOf(
			"TUM.ai e.V.,\nArcisstraße 21\n80333 München\n\nund",
		);

		assert.deepEqual(
			blocks.slice(0, 3).map((block: Block) => textOf(block.text)),
			["TUM.ai e.V.,", "Arcisstraße 21", "80333 München"],
		);
		assert.deepEqual(
			blocks.slice(0, 3).map((block: Block) => block.margin[3]),
			[0, 0, 8],
		);
	});

	test("draws a signature inline at its token, with the text around it", () => {
		const blocks = blocksOf("Unterschrift Partner: {{partner_signature}} Ort", [
			{
				role: "partner",
				label: "Partner: Jane Doe",
				sublabel: "2026-07-01",
				png: tinyPng(),
			},
		]);

		assert.equal(textOf(blocks[0].text), "Unterschrift Partner:");
		assert.match(String(blocks[1].stack[0].image), /^data:image\/png;base64,/);
		assert.equal(blocks[1].stack[1].text, "Partner: Jane Doe · 2026-07-01");
		assert.equal(textOf(blocks[2].text), "Ort");
		// The raw token never reaches the page.
		assert.doesNotMatch(JSON.stringify(blocks), /partner_signature/);
	});

	test("leaves a blank rule for an unsigned token", () => {
		const blocks = blocksOf("Unterschrift: {{board_signature}}");

		assert.match(blocks[1].text, /^_+$/);
		assert.doesNotMatch(JSON.stringify(blocks), /board_signature/);
	});

	test("keeps signatures without a token on a trailing page", () => {
		const blocks = blocksOf("Vertragstext ohne Tokens.", [
			{ role: "partner", label: "Partner: Jane Doe", png: tinyPng() },
			{ role: "board", label: "TUM.ai / Board: Max", png: tinyPng() },
		]);

		const heading = blocks.find((block: Block) => block.text === "Signaturen");
		assert.ok(heading);
		assert.equal(heading.pageBreak, "before");
		assert.equal(
			blocks.filter((block: Block) => block.stack?.[0]?.image).length,
			2,
		);
	});

	test("only trails the signatures that had no token", () => {
		const blocks = blocksOf("Vertragstext.\n\n{{partner_signature}}", [
			{ role: "partner", label: "Partner: Jane Doe", png: tinyPng() },
			{ role: "board", label: "TUM.ai / Board: Max", png: tinyPng() },
		]);

		const heading = blocks.filter(
			(block: Block) => block.text === "Signaturen",
		);
		assert.equal(heading.length, 1);
		assert.equal(
			blocks.filter((block: Block) => block.stack?.[0]?.image).length,
			2,
		);
	});
});

/** How many images the PDF embeds; the header logo always accounts for one. */
function imageCount(pdf: Buffer): number {
	return (pdf.toString("latin1").match(/\/Subtype \/Image/g) ?? []).length;
}

describe("createTextPdf", () => {
	test("uses the oblique face for italic spans", async () => {
		const pdf = await createTextPdf("*im Folgenden Veranstalter genannt*");

		assert.match(pdf.toString("latin1"), /\/BaseFont \/Helvetica-Oblique/);
	});

	test("matches the Word page geometry", () => {
		const definition = buildContractDocDefinition("Body");

		// Word: 2.5 cm side/top margins, 2 cm bottom, header 1.25 cm from the edge.
		assert.deepEqual(definition.pageMargins, [71, 71, 71, 57]);
		const header = definition.header as Block;
		assert.equal(header.width, 89);
		assert.equal(header.margin[1], 35);
	});

	test("renders a PDF with the standard fonts and no font assets", async () => {
		const pdf = await createTextPdf(
			"# SPONSORINGVERTRAG\n\n## § 1 Vertragsgegenstand\n\nDer Vertrag gilt für ein Jahr.",
		);
		const raw = pdf.toString("latin1");

		assert.match(raw, /^%PDF-1\./);
		assert.match(raw, /\/BaseFont \/Helvetica\b/);
		assert.match(raw, /\/BaseFont \/Helvetica-Bold/);
	});

	test("embeds signature images", async () => {
		const pdf = await createTextPdf("Vertragstext.\n\n{{partner_signature}}", [
			{ role: "partner", label: "Partner: Jane Doe", png: tinyPng() },
		]);

		// The header logo plus the signature.
		assert.equal(imageCount(pdf), 2);
	});

	test("skips an unreadable signature instead of failing the contract", async () => {
		const pdf = await createTextPdf("Vertragstext.\n\n{{partner_signature}}", [
			{ role: "partner", label: "Partner: Broken", png: Buffer.from("nope") },
		]);
		assert.match(pdf.toString("latin1"), /^%PDF-1\./);
		// Only the header logo: the blank rule stands in for the broken signature.
		assert.equal(imageCount(pdf), 1);
	});
});
