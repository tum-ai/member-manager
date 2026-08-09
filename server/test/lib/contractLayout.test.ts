import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { renderDocumentPages } from "../../src/lib/contracts/contractDocument.js";
import { parseContractLayout } from "../../src/lib/contracts/contractLayout.js";

const html = (text: string): string => renderDocumentPages(text).join("");

describe("contract layout", () => {
	test("only marked lines become titles and headings", () => {
		const blocks = parseContractLayout(
			[
				"# SPONSORINGVERTRAG",
				"## § 1 Gegenstand",
				"Vor diesem Hintergrund treffen die Parteien die folgende Vereinbarung:",
				"TUM.ai e.V.",
			].join("\n\n"),
		);

		assert.deepEqual(
			blocks.map((block) => block.kind),
			["title", "heading", "paragraph", "paragraph"],
		);
	});

	test("keeps bold spans as runs", () => {
		const [block] = parseContractLayout(
			"Zahlung **innerhalb von 14 Tagen** fällig.",
		);

		assert.equal(block.kind, "paragraph");
		assert.deepEqual(block.kind === "paragraph" ? block.runs : [], [
			{ text: "Zahlung " },
			{ text: "innerhalb von 14 Tagen", bold: true },
			{ text: " fällig." },
		]);
	});

	test("marks *italic* spans, and keeps **bold** intact", () => {
		const [aside] = parseContractLayout(
			"*- im Folgenden Veranstalter genannt -*",
		);
		const [strong] = parseContractLayout("**TUM.ai e.V.,**");

		assert.deepEqual(aside.kind === "paragraph" ? aside.runs : [], [
			{ text: "- im Folgenden Veranstalter genannt -", italics: true },
		]);
		assert.deepEqual(strong.kind === "paragraph" ? strong.runs : [], [
			{ text: "TUM.ai e.V.,", bold: true },
		]);
	});

	test("recognises outline items and their label", () => {
		const [block] = parseContractLayout("(a) Das Partnerunternehmen zahlt.");

		assert.equal(block.kind, "outline");
		assert.equal(block.kind === "outline" ? block.label : "", "(a)");
	});

	test("keeps a dash-wrapped aside as body text", () => {
		const [block] = parseContractLayout('- im Folgenden "TUM.ai" genannt -');

		assert.equal(block.kind, "paragraph");
	});

	test("recognises dash lists", () => {
		const [block] = parseContractLayout("- Erste Leistung\n- Zweite Leistung");

		assert.equal(block.kind, "list");
		assert.equal(block.kind === "list" ? block.items.length : 0, 2);
	});

	test("reads a pipe row as side-by-side columns", () => {
		const [block] = parseContractLayout(
			"Unterschrift: {{partner_signature}} | Unterschrift: {{board_signature}}",
		);

		assert.equal(block.kind, "columns");
		const cells = block.kind === "columns" ? block.cells : [];
		assert.equal(cells.length, 2);
		assert.deepEqual(
			cells.map((cell) => cell.map((inner) => inner.kind)),
			[
				["paragraph", "signature"],
				["paragraph", "signature"],
			],
		);
	});

	test("turns --- into a page break", () => {
		const blocks = parseContractLayout("Text\n\n---\n\n## Annex 1");

		assert.deepEqual(
			blocks.map((block) => block.kind),
			["paragraph", "pagebreak", "heading"],
		);
	});

	test("keeps the vertical space Word reserves with empty paragraphs", () => {
		const blocks = parseContractLayout("Text\n\n\n\nUnterschrift:");

		assert.deepEqual(
			blocks.map((block) => block.kind),
			["paragraph", "spacer", "spacer", "paragraph"],
		);
	});

	test("splits a paragraph around a signature token", () => {
		const blocks = parseContractLayout(
			"Unterschrift: {{partner_signature}}\n\nTUM.ai e.V.",
		);

		assert.deepEqual(
			blocks.map((block) => block.kind),
			["paragraph", "signature", "paragraph"],
		);
		assert.equal(
			blocks[1].kind === "signature" ? blocks[1].role : "",
			"partner",
		);
	});

	// One template line is one Word paragraph: an address block becomes three
	// tight paragraphs, and only the last one carries the blank line after it.
	test("keeps each line its own paragraph and marks the spacing", () => {
		const blocks = parseContractLayout(
			"TUM.ai e.V.,\nArcisstraße 21\n80333 München\n\nund",
		);

		assert.equal(blocks.length, 4);
		// The last paragraph has no blank line after it, so it adds no space.
		assert.deepEqual(
			blocks.map((block) => block.spaced),
			[false, false, true, false],
		);
	});

	test("applies markers on a line inside a tight block", () => {
		const blocks = parseContractLayout(
			"## § 1 Veranstaltung\nDer Veranstalter richtet die Veranstaltung aus.",
		);

		assert.deepEqual(
			blocks.map((block) => block.kind),
			["heading", "paragraph"],
		);
	});
});

describe("preview html", () => {
	test("renders titles, headings, bold and italic spans", () => {
		const out = html(
			"# SPONSORINGVERTRAG\n\n## § 1 Gegenstand\n\nText **fett** und *kursiv* hier.",
		);

		assert.match(out, /<h1>SPONSORINGVERTRAG<\/h1>/);
		assert.match(out, /<h2>§ 1 Gegenstand<\/h2>/);
		assert.match(out, /<strong>fett<\/strong>/);
		assert.match(out, /<em>kursiv<\/em>/);
	});

	test("does not bold unmarked short lines", () => {
		const out = html(
			"TUM.ai e.V.\n\nVor diesem Hintergrund treffen die Parteien die Vereinbarung:",
		);

		assert.doesNotMatch(out, /<h1>|<h2>/);
	});

	test("gives outline items a hanging indent", () => {
		const out = html("(a) Das Partnerunternehmen zahlt einen Betrag.");

		assert.match(out, /<div class="outline">/);
		assert.match(out, /<span class="outline-label">\(a\)<\/span>/);
	});

	test("draws a signature line instead of the raw token", () => {
		const out = html("Unterschrift: {{partner_signature}}");

		assert.match(out, /<div class="signature-line"><\/div>/);
		assert.doesNotMatch(out, /partner_signature/);
	});

	test("starts a new preview page at a page break", () => {
		const pages = renderDocumentPages("Vor dem Umbruch\n\n---\n\n## Annex 1");

		assert.equal(pages.length, 2);
		assert.match(pages[0], /Vor dem Umbruch/);
		assert.match(pages[1], /<h2>Annex 1<\/h2>/);
	});

	test("renders a pipe row as columns", () => {
		const out = html("links | rechts");

		assert.match(out, /<div class="columns">/);
		assert.equal((out.match(/<div class="column">/g) ?? []).length, 2);
	});

	test("escapes markup coming from form data", () => {
		const out = html("Partner: <script>alert(1)</script>");

		assert.match(out, /&lt;script&gt;/);
		assert.doesNotMatch(out, /<script>/i);
	});
});
