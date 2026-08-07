import assert from "node:assert/strict";
import { test } from "node:test";
import {
	docxToTemplateText,
	normalizeTypography,
} from "./docx-to-template.mjs";

// ---------------------------------------------------------------------------
// A minimal DOCX (= ZIP of XML parts) builder. Entries are stored uncompressed
// and the CRC is left at zero: the converter never verifies it.
// ---------------------------------------------------------------------------

function buildZip(files) {
	const locals = [];
	const centrals = [];
	let offset = 0;

	for (const [name, content] of Object.entries(files)) {
		const nameBytes = Buffer.from(name, "utf8");
		const data = Buffer.from(content, "utf8");

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt32LE(data.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(nameBytes.length, 26);
		locals.push(local, nameBytes, data);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 6);
		central.writeUInt32LE(data.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(nameBytes.length, 28);
		central.writeUInt32LE(offset, 42);
		centrals.push(central, nameBytes);

		offset += local.length + nameBytes.length + data.length;
	}

	const centralBuffer = Buffer.concat(centrals);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(Object.keys(files).length, 8);
	eocd.writeUInt16LE(Object.keys(files).length, 10);
	eocd.writeUInt32LE(centralBuffer.length, 12);
	eocd.writeUInt32LE(offset, 16);

	return Buffer.concat([Buffer.concat(locals), centralBuffer, eocd]);
}

const NUMBERING_XML = `<?xml version="1.0"?>
<w:numbering xmlns:w="urn:w">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="§ %1"/></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="(%2)"/></w:lvl>
    <w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="(%3)"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="7"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

const STYLES_XML = `<?xml version="1.0"?>
<w:styles xmlns:w="urn:w">
  <w:style w:styleId="L1"><w:pPr><w:numPr><w:numId w:val="7"/></w:numPr><w:spacing w:after="240"/></w:pPr></w:style>
  <w:style w:styleId="L2"><w:basedOn w:val="L1"/><w:pPr><w:numPr><w:ilvl w:val="1"/></w:numPr></w:pPr></w:style>
  <w:style w:styleId="L3"><w:basedOn w:val="L1"/><w:pPr><w:numPr><w:ilvl w:val="2"/></w:numPr></w:pPr></w:style>
</w:styles>`;

function paragraph(text, { style, ilvl, numId, spacing } = {}) {
	const numPr =
		numId !== undefined || ilvl !== undefined
			? `<w:numPr>${ilvl === undefined ? "" : `<w:ilvl w:val="${ilvl}"/>`}${
					numId === undefined ? "" : `<w:numId w:val="${numId}"/>`
				}</w:numPr>`
			: "";
	const properties =
		style || numPr || spacing
			? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${numPr}${
					spacing ? `<w:spacing w:after="${spacing}"/>` : ""
				}</w:pPr>`
			: "";
	return `<w:p>${properties}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function docx(bodyXml) {
	return buildZip({
		"word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="urn:w"><w:body>${bodyXml}</w:body></w:document>`,
		"word/numbering.xml": NUMBERING_XML,
		"word/styles.xml": STYLES_XML,
	});
}

test("resolves numbering declared directly on the paragraph", () => {
	const text = docxToTemplateText(
		docx(
			paragraph("Gegenstand", { numId: 7, ilvl: 0 }) +
				paragraph("Schutzrechte", { numId: 7, ilvl: 0 }),
		),
	);

	assert.equal(text, "§ 1 Gegenstand\n§ 2 Schutzrechte\n");
});

test("inherits the list through the style chain and keeps the style's level", () => {
	const text = docxToTemplateText(
		docx(
			paragraph("Gegenstand", { style: "L1" }) +
				paragraph("Erste Leistung", { style: "L2" }) +
				paragraph("Zweite Leistung", { style: "L2" }) +
				paragraph("Unterpunkt", { style: "L3" }) +
				paragraph("Schutzrechte", { style: "L1" }) +
				paragraph("Dritte Leistung", { style: "L2" }),
		),
	);

	// A new § restarts the letter level; the paragraph style only carries the
	// outline level, the numId comes from the basedOn style.
	assert.deepEqual(text.split("\n\n"), [
		"§ 1 Gegenstand",
		"(a) Erste Leistung",
		"(b) Zweite Leistung",
		"(i) Unterpunkt",
		"§ 2 Schutzrechte",
		"(a) Dritte Leistung\n",
	]);
});

test("turns paragraph spacing into blank lines and keeps tight runs together", () => {
	const text = docxToTemplateText(
		docx(
			paragraph("TUM.ai e.V.,") +
				paragraph("Arcisstraße 21", { spacing: 240 }) +
				paragraph("Präambel"),
		),
	);

	assert.equal(text, "TUM.ai e.V.,\nArcisstraße 21\n\nPräambel\n");
});

test("flattens tables to label/value lines", () => {
	const row = `<w:tr><w:tc>${paragraph("An:")}</w:tc><w:tc>${paragraph("TUM.ai e.V.")}</w:tc></w:tr>`;
	const text = docxToTemplateText(
		docx(`<w:tbl>${row}</w:tbl>${paragraph("Danach")}`),
	);

	assert.equal(text, "An: TUM.ai e.V.\n\nDanach\n");
});

test("keeps Word placeholders untouched", () => {
	const text = docxToTemplateText(
		docx(paragraph("Betrag [●] EUR für [Sponsor]")),
	);

	assert.equal(text, "Betrag [●] EUR für [Sponsor]\n");
});

test("normalises Word typography to the seeded template style", () => {
	assert.equal(
		normalizeTypography("– im Folgenden „TUM.ai“ genannt –"),
		'- im Folgenden "TUM.ai" genannt -',
	);
	assert.equal(normalizeTypography("fünf (5)​Jahre…"), "fünf (5)Jahre...");
	assert.equal(normalizeTypography("a\tb   c"), "a b c");
});
