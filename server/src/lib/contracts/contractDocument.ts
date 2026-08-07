import {
	type ContractRenderableBlock,
	type RenderedContractDocument,
	renderContractText as renderSharedContractText,
} from "@member-manager/shared";
import {
	type ContractBlock,
	type ContractInlineRun,
	parseContractLayout,
} from "./contractLayout.js";

// The preview mirrors the printed page: A4 at 11 pt with 1.5 line spacing fits
// roughly this many characters per line and lines per page.
const PREVIEW_MAX_CHARS_PER_LINE = 76;
const PREVIEW_MAX_LINES_PER_PAGE = 39;
/** Width of an outline label ("(a)") in characters, for the hanging indent. */
const OUTLINE_LABEL_WIDTH = 5;

type PreviewLineKind =
	| "title"
	| "heading"
	| "paragraph"
	| "list"
	| "outline"
	| "signature"
	| "columns"
	| "pagebreak"
	| "blank";

interface PreviewLine {
	kind: PreviewLineKind;
	html: string;
	itemStart?: boolean;
	/** Only set on the first line of an outline item. */
	label?: string;
}

/** The preview HTML is built by hand, so every value from a contract is escaped. */
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/** Render inline runs; bold and italic come from the template's ** and * markers. */
function runsToHtml(runs: ContractInlineRun[]): string {
	return runs
		.map((run) => {
			const text = escapeHtml(run.text);
			if (run.bold) return `<strong>${text}</strong>`;
			if (run.italics) return `<em>${text}</em>`;
			return text;
		})
		.join("");
}

/**
 * Wrap a run list to the preview line width, keeping bold spans intact. Runs
 * are split word by word so a bold phrase can break across lines.
 */
function wrapRuns(runs: ContractInlineRun[], width: number): string[] {
	const words: ContractInlineRun[] = [];
	for (const run of runs) {
		for (const word of run.text.split(/(\s+)/)) {
			if (word)
				words.push({ text: word, bold: run.bold, italics: run.italics });
		}
	}

	const lines: string[] = [];
	let current: ContractInlineRun[] = [];
	let length = 0;

	for (const word of words) {
		const isSpace = /^\s+$/.test(word.text);
		if (length + word.text.length > width && length > 0 && !isSpace) {
			lines.push(runsToHtml(current));
			current = [];
			length = 0;
		}
		if (isSpace && length === 0) continue;
		current.push(word);
		length += word.text.length;
	}

	if (current.length > 0) lines.push(runsToHtml(current));
	return lines.length > 0 ? lines : [""];
}

/**
 * Turn one layout block into preview lines. The preview paginates by counting
 * lines, so every block has to be wrapped to the page width here rather than
 * left to the browser.
 */
function blockToPreviewLines(block: ContractBlock): PreviewLine[] {
	switch (block.kind) {
		case "title":
			return wrapRuns(block.runs, PREVIEW_MAX_CHARS_PER_LINE).map((html) => ({
				kind: "title" as const,
				html,
			}));
		case "heading":
			return wrapRuns(block.runs, PREVIEW_MAX_CHARS_PER_LINE).map((html) => ({
				kind: "heading" as const,
				html,
			}));
		case "list":
			return block.items.flatMap((item) =>
				wrapRuns(item, PREVIEW_MAX_CHARS_PER_LINE - 4).map((html, index) => ({
					kind: "list" as const,
					html,
					itemStart: index === 0,
				})),
			);
		case "outline":
			return wrapRuns(
				block.runs,
				PREVIEW_MAX_CHARS_PER_LINE - OUTLINE_LABEL_WIDTH,
			).map((html, index) => ({
				kind: "outline" as const,
				html,
				itemStart: index === 0,
				label: index === 0 ? block.label : undefined,
			}));
		case "signature":
			return [{ kind: "signature" as const, html: "", label: block.role }];
		case "columns":
			return [
				{
					kind: "columns" as const,
					html: block.cells
						.map(
							(cell) =>
								`<div class="column">${cell
									.map((inner) =>
										blockToPreviewLines({ ...inner, spaced: false })
											.map((line) =>
												line.kind === "signature"
													? '<div class="signature-line"></div>'
													: line.html,
											)
											.join("<br>"),
									)
									.join("")}</div>`,
						)
						.join(""),
				},
			];
		case "pagebreak":
			return [{ kind: "pagebreak" as const, html: "" }];
		case "spacer":
			return [{ kind: "blank" as const, html: "" }];
		default:
			return wrapRuns(block.runs, PREVIEW_MAX_CHARS_PER_LINE).map((html) => ({
				kind: "paragraph" as const,
				html,
			}));
	}
}

/** All lines of the document, with the blank lines the template asks for. */
function buildPreviewLines(text: string): PreviewLine[] {
	const previewLines: PreviewLine[] = [];
	for (const block of parseContractLayout(text)) {
		previewLines.push(...blockToPreviewLines(block));
		// Consecutive lines stay tight; a blank line in the template is what
		// separates paragraphs, exactly as in the Word original.
		if (block.spaced) previewLines.push({ kind: "blank", html: "" });
	}
	// A trailing blank line would leave an empty last page.
	while (previewLines.at(-1)?.kind === "blank") previewLines.pop();
	return previewLines;
}

/** Consecutive lines of the same kind share one element, joined by <br>. */
function renderTextGroup(tag: "h1" | "h2" | "p", lines: PreviewLine[]): string {
	return `<${tag}>${lines.map((line) => line.html).join("<br>")}</${tag}>`;
}

function renderListGroup(lines: PreviewLine[]): string {
	const html: string[] = [];
	const items: string[] = [];
	let current: string[] = [];
	const flushItems = () => {
		if (items.length > 0) {
			html.push(`<ul>${items.join("")}</ul>`);
			items.length = 0;
		}
	};

	for (const line of lines) {
		// A page that starts in the middle of an item continues it without a
		// second bullet.
		if (!line.itemStart && items.length === 0 && current.length === 0) {
			html.push(`<div class="list-continuation">${line.html}</div>`);
			continue;
		}
		if (line.itemStart && current.length > 0) {
			items.push(`<li>${current.join("<br>")}</li>`);
			current = [];
		}
		current.push(line.html);
	}
	if (current.length > 0) items.push(`<li>${current.join("<br>")}</li>`);
	flushItems();
	return html.join("");
}

/** Outline items keep their label in a column so wrapped lines hang beside it. */
function renderOutlineGroup(lines: PreviewLine[]): string {
	const html: string[] = [];
	let label = "";
	let current: string[] = [];
	const flush = () => {
		if (current.length === 0) return;
		html.push(
			`<div class="outline"><span class="outline-label">${escapeHtml(label)}</span><span class="outline-text">${current.join("<br>")}</span></div>`,
		);
		current = [];
	};

	for (const line of lines) {
		if (line.itemStart) {
			flush();
			label = line.label ?? "";
		}
		current.push(line.html);
	}
	flush();
	return html.join("");
}

/** Render the lines of a single page, grouping runs of the same kind. */
function pageLinesToHtml(lines: PreviewLine[]): string {
	const html: string[] = [];
	let index = 0;
	while (index < lines.length) {
		const line = lines[index];
		if (line.kind === "blank") {
			html.push('<div class="blank-line">&nbsp;</div>');
			index++;
			continue;
		}
		if (line.kind === "signature") {
			html.push('<div class="signature-line"></div>');
			index++;
			continue;
		}
		if (line.kind === "columns") {
			html.push(`<div class="columns">${line.html}</div>`);
			index++;
			continue;
		}
		if (line.kind === "pagebreak") {
			index++;
			continue;
		}
		const group: PreviewLine[] = [];
		while (index < lines.length && lines[index].kind === line.kind) {
			group.push(lines[index]);
			index++;
		}
		if (line.kind === "title") html.push(renderTextGroup("h1", group));
		else if (line.kind === "heading") html.push(renderTextGroup("h2", group));
		else if (line.kind === "list") html.push(renderListGroup(group));
		else if (line.kind === "outline") html.push(renderOutlineGroup(group));
		else html.push(renderTextGroup("p", group));
	}
	return html.join("");
}

/** Split the contract into A4-sized pages of HTML for the on-screen preview. */
export function renderDocumentPages(text: string): string[] {
	const lines = buildPreviewLines(text);
	const pages: string[] = [];
	let current: PreviewLine[] = [];

	const flushPage = () => {
		pages.push(pageLinesToHtml(current));
		current = [];
	};

	for (const line of lines) {
		// An explicit page break ends the page, as it does in Word.
		if (line.kind === "pagebreak") {
			if (current.length > 0) flushPage();
			continue;
		}
		current.push(line);
		if (current.length >= PREVIEW_MAX_LINES_PER_PAGE) flushPage();
	}
	if (current.length > 0) flushPage();

	return pages.length > 0 ? pages : [""];
}

/** Substitute variables and conditional blocks; reserved tokens survive. */
export function renderContractText(
	contractText: string,
	formData: Record<string, unknown>,
	blocks: ContractRenderableBlock[],
): string {
	return renderSharedContractText(contractText, formData, blocks, {
		formatDates: true,
	});
}

/** The rendered contract as canonical text plus the paginated preview HTML. */
export function renderContractDocument(
	contractText: string,
	formData: Record<string, unknown>,
	blocks: ContractRenderableBlock[],
): RenderedContractDocument {
	const text = renderContractText(contractText, formData, blocks);
	const pages = renderDocumentPages(text);
	return {
		text,
		html: pages.map((page) => `<section>${page}</section>`).join(""),
		pages,
	};
}
