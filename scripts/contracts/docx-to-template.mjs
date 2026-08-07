#!/usr/bin/env node
// Convert a contract source DOCX (data/contracts/*.docx) into the plain text
// the contract generator stores in `contract_templates.contract_text`.
//
// Word keeps the visible "§ 1" / "(a)" prefixes in numbering.xml rather than in
// the paragraph text, so a naive text dump silently loses the whole outline.
// This converter resolves the numbering (directly on the paragraph and through
// the paragraph style chain), flattens tables to text lines — the PDF renderer
// in server/src/lib/simplePdf.ts has no table support — and normalises the
// typography to the ASCII quotes/dashes the seeded templates already use.
//
// Word placeholders ([Sponsor], [●], ...) are intentionally left alone: mapping
// them onto {{variables}} is a legal judgement call and happens by hand in the
// migration.
//
// Usage: node scripts/contracts/docx-to-template.mjs <file.docx>

import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

// Word measures paragraph spacing in twentieths of a point. Anything from 6 pt
// upwards reads as a paragraph break and becomes a blank line in the template.
const PARAGRAPH_BREAK_TWIPS = 120;

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/** A ZIP is read back to front: the central directory is announced at the end. */
function findEndOfCentralDirectory(buffer) {
	for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
		if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
	}
	throw new Error("Not a ZIP file: end of central directory not found");
}

/** Read a ZIP archive into a `Map<name, Buffer>`. Supports stored + deflated. */
export function readZipEntries(buffer) {
	const eocd = findEndOfCentralDirectory(buffer);
	const entryCount = buffer.readUInt16LE(eocd + 10);
	let offset = buffer.readUInt32LE(eocd + 16);
	const entries = new Map();

	for (let index = 0; index < entryCount; index += 1) {
		if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
			throw new Error("Corrupt ZIP: bad central directory entry");
		}
		const method = buffer.readUInt16LE(offset + 10);
		const compressedSize = buffer.readUInt32LE(offset + 20);
		const nameLength = buffer.readUInt16LE(offset + 28);
		const extraLength = buffer.readUInt16LE(offset + 30);
		const commentLength = buffer.readUInt16LE(offset + 32);
		const localOffset = buffer.readUInt32LE(offset + 42);
		const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

		const localNameLength = buffer.readUInt16LE(localOffset + 26);
		const localExtraLength = buffer.readUInt16LE(localOffset + 28);
		const dataStart = localOffset + 30 + localNameLength + localExtraLength;
		const data = buffer.subarray(dataStart, dataStart + compressedSize);
		entries.set(name, method === 0 ? Buffer.from(data) : inflateRawSync(data));

		offset += 46 + nameLength + extraLength + commentLength;
	}

	return entries;
}

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

const XML_ENTITIES = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
};

// ---- Tiny XML reader ----------------------------------------------------
// OOXML parts are machine generated: no DTDs, no CDATA, so tags plus text nodes
// are all that has to be handled.
function decodeXmlText(value) {
	return value.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (full, entity) => {
		if (entity.startsWith("#x") || entity.startsWith("#X")) {
			return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
		}
		if (entity.startsWith("#")) {
			return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
		}
		return XML_ENTITIES[entity] ?? full;
	});
}

function parseAttributes(raw) {
	const attributes = {};
	const pattern = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
	let match = pattern.exec(raw);
	while (match) {
		attributes[match[1]] = decodeXmlText(match[2]);
		match = pattern.exec(raw);
	}
	return attributes;
}

/**
 * Minimal XML tree parser. OOXML parts are machine generated and contain no
 * DTDs or CDATA, so tags plus text nodes are all that has to be handled.
 */
export function parseXml(xml) {
	const root = { name: "#root", attributes: {}, children: [] };
	const stack = [root];
	const pattern = /<([?!/]?)([\w:.-]*)((?:"[^"]*"|[^>"])*?)(\/?)>/g;
	let cursor = 0;
	let match = pattern.exec(xml);

	while (match) {
		const [full, prefix, name, rawAttributes, selfClosing] = match;
		const text = xml.slice(cursor, match.index);
		if (text) {
			stack[stack.length - 1].children.push({
				text: decodeXmlText(text),
			});
		}
		cursor = match.index + full.length;

		if (prefix === "?" || prefix === "!") {
			match = pattern.exec(xml);
			continue;
		}
		if (prefix === "/") {
			if (stack.length > 1) stack.pop();
			match = pattern.exec(xml);
			continue;
		}

		const node = {
			name,
			attributes: parseAttributes(rawAttributes),
			children: [],
		};
		stack[stack.length - 1].children.push(node);
		if (!selfClosing) stack.push(node);
		match = pattern.exec(xml);
	}

	return root;
}

function localName(node) {
	return node.name ? node.name.replace(/^.*:/, "") : "";
}

function attribute(node, name) {
	if (!node?.attributes) return undefined;
	for (const [key, value] of Object.entries(node.attributes)) {
		if (key.replace(/^.*:/, "") === name) return value;
	}
	return undefined;
}

function childrenNamed(node, name) {
	return (node.children ?? []).filter((child) => localName(child) === name);
}

function firstChild(node, name) {
	return childrenNamed(node, name)[0];
}

function descendants(node, name) {
	const found = [];
	const walk = (current) => {
		for (const child of current.children ?? []) {
			if (localName(child) === name) found.push(child);
			walk(child);
		}
	};
	walk(node);
	return found;
}

function valueAttribute(node, name) {
	return attribute(firstChild(node, name), "val");
}

// ---------------------------------------------------------------------------
// Numbering
// ---------------------------------------------------------------------------

const ROMAN = [
	[1000, "m"],
	[900, "cm"],
	[500, "d"],
	[400, "cd"],
	[100, "c"],
	[90, "xc"],
	[50, "l"],
	[40, "xl"],
	[10, "x"],
	[9, "ix"],
	[5, "v"],
	[4, "iv"],
	[1, "i"],
];

/** Word numbers levels as decimal, letters or roman numerals; render each. */
function toRoman(value) {
	let remaining = value;
	let out = "";
	for (const [amount, numeral] of ROMAN) {
		while (remaining >= amount) {
			out += numeral;
			remaining -= amount;
		}
	}
	return out;
}

function toLetter(value) {
	let remaining = value;
	let out = "";
	while (remaining > 0) {
		const index = (remaining - 1) % 26;
		out = String.fromCharCode(97 + index) + out;
		remaining = Math.floor((remaining - 1) / 26);
	}
	return out;
}

function formatCounter(counter, format) {
	switch (format) {
		case "lowerLetter":
			return toLetter(counter);
		case "upperLetter":
			return toLetter(counter).toUpperCase();
		case "lowerRoman":
			return toRoman(counter);
		case "upperRoman":
			return toRoman(counter).toUpperCase();
		case "none":
			return "";
		default:
			return String(counter);
	}
}

/**
 * Index numbering.xml: which list (numId) uses which abstract definition, and
 * what each level prints ("§ %1", "(%2)") with which number format.
 */
function buildNumbering(numberingXml) {
	const abstracts = new Map();
	const numToAbstract = new Map();
	const overrides = new Map();
	if (!numberingXml) return { abstracts, numToAbstract, overrides };

	const root = parseXml(numberingXml);
	for (const abstract of descendants(root, "abstractNum")) {
		const id = attribute(abstract, "abstractNumId");
		const levels = new Map();
		for (const level of childrenNamed(abstract, "lvl")) {
			levels.set(Number(attribute(level, "ilvl") ?? 0), {
				format: valueAttribute(level, "numFmt") ?? "decimal",
				text: valueAttribute(level, "lvlText") ?? "",
				start: Number(valueAttribute(level, "start") ?? 1),
			});
		}
		abstracts.set(id, levels);
	}
	for (const num of descendants(root, "num")) {
		const numId = attribute(num, "numId");
		numToAbstract.set(numId, valueAttribute(num, "abstractNumId"));
		for (const override of childrenNamed(num, "lvlOverride")) {
			const ilvl = Number(attribute(override, "ilvl") ?? 0);
			const start = valueAttribute(override, "startOverride");
			if (start !== undefined) {
				overrides.set(`${numId}:${ilvl}`, Number(start));
			}
		}
	}

	return { abstracts, numToAbstract, overrides };
}

/** Paragraph spacing in twips, as declared directly on a paragraph or style. */
function spacingOf(properties) {
	const spacing = properties ? firstChild(properties, "spacing") : undefined;
	return {
		before: spacing ? attribute(spacing, "before") : undefined,
		after: spacing ? attribute(spacing, "after") : undefined,
	};
}

/** Index styles.xml: the numbering and spacing a paragraph style contributes. */
function buildStyles(stylesXml) {
	const styles = new Map();
	if (!stylesXml) return styles;
	const root = parseXml(stylesXml);
	for (const style of descendants(root, "style")) {
		const properties = firstChild(style, "pPr");
		const numPr = properties ? firstChild(properties, "numPr") : undefined;
		styles.set(attribute(style, "styleId"), {
			basedOn: valueAttribute(style, "basedOn"),
			numId: numPr ? valueAttribute(numPr, "numId") : undefined,
			ilvl: numPr ? valueAttribute(numPr, "ilvl") : undefined,
			spacing: spacingOf(properties),
		});
	}
	return styles;
}

/**
 * Resolve the paragraph spacing in twips through the style chain. Word uses it
 * instead of empty paragraphs in the long-term template, so it is what tells us
 * where a blank line belongs in the converted text.
 */
function paragraphSpacing(paragraph, styles) {
	const properties = firstChild(paragraph, "pPr");
	const direct = spacingOf(properties);
	let before = direct.before;
	let after = direct.after;

	let styleId = properties ? valueAttribute(properties, "pStyle") : undefined;
	const seen = new Set();
	while (
		styleId &&
		!seen.has(styleId) &&
		(before === undefined || after === undefined)
	) {
		seen.add(styleId);
		const style = styles.get(styleId);
		if (!style) break;
		before ??= style.spacing.before;
		after ??= style.spacing.after;
		styleId = style.basedOn;
	}

	return { before: Number(before ?? 0), after: Number(after ?? 0) };
}

function paragraphNumbering(paragraph, styles) {
	const properties = firstChild(paragraph, "pPr");
	if (!properties) return null;
	const numPr = firstChild(properties, "numPr");
	const directNumId = numPr ? valueAttribute(numPr, "numId") : undefined;
	if (directNumId) {
		return {
			numId: directNumId,
			ilvl: Number(valueAttribute(numPr, "ilvl") ?? 0),
		};
	}

	// Numbering can also come from the paragraph style, which is how the
	// long-term template numbers its § headings: a "Firm1L1" style owns the
	// numId while "Firm1L2".."Firm1L9" only carry their outline level and
	// inherit the list through basedOn.
	let styleId = valueAttribute(properties, "pStyle");
	let ilvl = numPr ? valueAttribute(numPr, "ilvl") : undefined;
	const seen = new Set();
	while (styleId && !seen.has(styleId)) {
		seen.add(styleId);
		const style = styles.get(styleId);
		if (!style) return null;
		if (ilvl === undefined) ilvl = style.ilvl;
		if (style.numId) return { numId: style.numId, ilvl: Number(ilvl ?? 0) };
		styleId = style.basedOn;
	}
	return null;
}

/**
 * Counts the list items as the document is walked and renders the prefix Word
 * displays. A new item at one level restarts every deeper level, like Word.
 */
function createNumberFormatter(numbering) {
	const counters = new Map();

	return function numberFor(numId, ilvl) {
		const abstractId = numbering.numToAbstract.get(numId);
		const levels = numbering.abstracts.get(abstractId);
		const level = levels?.get(ilvl);
		if (!level || level.format === "bullet") return level ? "-" : "";

		const key = `${numId}:${ilvl}`;
		const start = numbering.overrides.get(key) ?? level.start;
		counters.set(key, (counters.get(key) ?? start - 1) + 1);
		// A new item at this level restarts every deeper level.
		for (const deeper of counters.keys()) {
			const [otherNumId, otherLevel] = deeper.split(":");
			if (otherNumId === numId && Number(otherLevel) > ilvl) {
				counters.delete(deeper);
			}
		}

		return level.text.replace(/%(\d)/g, (_full, position) => {
			const referenced = Number(position) - 1;
			const referencedLevel = levels.get(referenced);
			const referencedKey = `${numId}:${referenced}`;
			const counter =
				counters.get(referencedKey) ?? referencedLevel?.start ?? 1;
			return formatCounter(counter, referencedLevel?.format ?? "decimal");
		});
	};
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const TYPOGRAPHY = [
	[/[‐-―]/g, "-"],
	[/[“”„‟]/g, '"'],
	[/[‘’‚‛]/g, "'"],
	[/…/g, "..."],
	[/ | | /g, " "],
	[/[​-‏­﻿]/g, ""],
	[/\t/g, " "],
];

/** ASCII-fold the Word typography to what the seeded templates already use. */
export function normalizeTypography(text) {
	let out = text;
	for (const [pattern, replacement] of TYPOGRAPHY) {
		out = out.replace(pattern, replacement);
	}
	return out.replace(/ {2,}/g, " ").trim();
}

/** The visible text of a paragraph: tabs become spaces, breaks become newlines. */
function paragraphText(paragraph) {
	let out = "";
	const walk = (node) => {
		for (const child of node.children ?? []) {
			const name = localName(child);
			if (name === "t") {
				out += (child.children ?? []).map((leaf) => leaf.text ?? "").join("");
				continue;
			}
			if (name === "tab") out += " ";
			else if (name === "br" || name === "cr") out += "\n";
			else if (name === "delText") continue;
			walk(child);
		}
	};
	walk(paragraph);
	return out;
}

/** One paragraph as text, prefixed with the number Word would display. */
function renderParagraph(paragraph, styles, numberFor) {
	const text = normalizeTypography(paragraphText(paragraph));
	const numbering = paragraphNumbering(paragraph, styles);
	if (!numbering) return text;
	const prefix = normalizeTypography(
		numberFor(numbering.numId, numbering.ilvl),
	);
	if (!prefix) return text;
	return text ? `${prefix} ${text}` : prefix;
}

/**
 * Tables become plain lines ("Label: value"): the contract PDF renderer has no
 * table support, and the tables here are label/value blocks anyway.
 */
function renderTable(table, styles, numberFor) {
	const lines = [];
	for (const row of childrenNamed(table, "tr")) {
		const cells = childrenNamed(row, "tc")
			.map((cell) =>
				childrenNamed(cell, "p")
					.map((paragraph) => renderParagraph(paragraph, styles, numberFor))
					.filter(Boolean)
					.join(" "),
			)
			.filter(Boolean);
		if (cells.length === 0) continue;
		lines.push(
			cells.length === 2
				? `${cells[0].replace(/:$/, "")}: ${cells[1]}`
				: cells.join(" | "),
		);
	}
	return lines;
}

/** Convert the bytes of a DOCX file into contract template text. */
export function docxToTemplateText(buffer) {
	const entries = readZipEntries(buffer);
	const documentXml = entries.get("word/document.xml");
	if (!documentXml)
		throw new Error("Not a DOCX file: word/document.xml missing");

	const numbering = buildNumbering(
		entries.get("word/numbering.xml")?.toString("utf8"),
	);
	const styles = buildStyles(entries.get("word/styles.xml")?.toString("utf8"));
	const numberFor = createNumberFormatter(numbering);

	const root = parseXml(documentXml.toString("utf8"));
	const body = descendants(root, "body")[0];
	if (!body) return "";

	const blocks = [];
	for (const node of body.children ?? []) {
		const name = localName(node);
		if (name === "p") {
			blocks.push({
				text: renderParagraph(node, styles, numberFor).trim(),
				...paragraphSpacing(node, styles),
			});
		} else if (name === "tbl") {
			for (const line of renderTable(node, styles, numberFor)) {
				blocks.push({ text: line, before: 0, after: 0 });
			}
			// Tables render as tight label/value lines; keep them off the next
			// paragraph.
			blocks.push({ text: "", before: 0, after: 0 });
		}
	}

	const lines = [];
	blocks.forEach((block, index) => {
		lines.push(block.text);
		const next = blocks[index + 1];
		if (!next || !block.text || !next.text) return;
		if (
			block.after >= PARAGRAPH_BREAK_TWIPS ||
			next.before >= PARAGRAPH_BREAK_TWIPS
		) {
			lines.push("");
		}
	});

	return `${lines
		.filter((line, index) => line !== "" || lines[index - 1] !== "")
		.join("\n")
		.trim()}\n`;
}

const invokedDirectly =
	process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
	const [, , file] = process.argv;
	if (!file) {
		console.error(
			"Usage: node scripts/contracts/docx-to-template.mjs <file.docx>",
		);
		process.exit(1);
	}
	process.stdout.write(docxToTemplateText(readFileSync(file)));
}
