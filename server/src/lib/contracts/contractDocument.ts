import {
	type ContractRenderableBlock,
	type RenderedContractDocument,
	renderContractText as renderSharedContractText,
} from "@member-manager/shared";

const PREVIEW_MAX_CHARS_PER_LINE = 76;
const PREVIEW_MAX_LINES_PER_PAGE = 39;

type PreviewLineKind = "title" | "heading" | "paragraph" | "list" | "blank";

interface PreviewLine {
	kind: PreviewLineKind;
	text: string;
	itemStart?: boolean;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function wrapPreviewLine(line: string): string[] {
	const words = line.split(/\s+/).filter(Boolean);
	if (words.length === 0) return [""];
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (next.length > PREVIEW_MAX_CHARS_PER_LINE && current) {
			lines.push(current);
			current = word;
		} else {
			current = next;
		}
	}

	if (current) lines.push(current);
	return lines;
}

function isTitleParagraph(paragraph: string): boolean {
	return /^SPONSORINGVERTRAG$|^KOOPERATIONSVERTRAG$/i.test(paragraph.trim());
}

function isHeadingParagraph(paragraph: string): boolean {
	const trimmed = paragraph.trim();
	return /^§\s*\d+\s+/.test(trimmed) || /^[A-ZÄÖÜ][^\n]{1,70}$/.test(trimmed);
}

function isListParagraph(lines: string[]): boolean {
	return lines.length > 1 && lines.every((line) => /^[-•]/.test(line));
}

function paragraphToPreviewLines(paragraph: string): PreviewLine[] {
	const trimmed = paragraph.trim();
	if (!trimmed) return [];
	if (isTitleParagraph(trimmed)) {
		return wrapPreviewLine(trimmed).map((line) => ({
			kind: "title",
			text: line,
		}));
	}
	if (isHeadingParagraph(trimmed)) {
		return wrapPreviewLine(trimmed).map((line) => ({
			kind: "heading",
			text: line,
		}));
	}

	const lines = paragraph
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	if (isListParagraph(lines)) {
		return lines.flatMap((line) =>
			wrapPreviewLine(line.replace(/^[-•]\s*/, "")).map(
				(wrappedLine, index) => ({
					kind: "list",
					text: wrappedLine,
					itemStart: index === 0,
				}),
			),
		);
	}
	return lines.flatMap((line) =>
		wrapPreviewLine(line).map((wrappedLine) => ({
			kind: "paragraph",
			text: wrappedLine,
		})),
	);
}

function buildPreviewLines(text: string): PreviewLine[] {
	const paragraphs = text
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);

	const previewLines: PreviewLine[] = [];
	for (const paragraph of paragraphs.length > 0 ? paragraphs : [""]) {
		if (previewLines.length > 0) {
			previewLines.push({ kind: "blank", text: "" });
		}
		previewLines.push(...paragraphToPreviewLines(paragraph));
	}
	return previewLines;
}

function renderTextGroup(tag: "h1" | "h2" | "p", lines: PreviewLine[]): string {
	return `<${tag}>${lines.map((line) => escapeHtml(line.text)).join("<br>")}</${tag}>`;
}

function renderListGroup(lines: PreviewLine[]): string {
	const html: string[] = [];
	let items: string[] = [];
	let current: string[] = [];
	const flushItems = () => {
		if (items.length > 0) {
			html.push(`<ul>${items.join("")}</ul>`);
			items = [];
		}
	};

	for (const line of lines) {
		if (!line.itemStart && items.length === 0 && current.length === 0) {
			html.push(
				`<div class="list-continuation">${escapeHtml(line.text)}</div>`,
			);
			continue;
		}
		if (line.itemStart && current.length > 0) {
			items.push(`<li>${current.map(escapeHtml).join("<br>")}</li>`);
			current = [];
		}
		current.push(line.text);
	}
	if (current.length > 0) {
		items.push(`<li>${current.map(escapeHtml).join("<br>")}</li>`);
	}
	flushItems();
	return html.join("");
}

function renderBlankLine(): string {
	return '<div class="blank-line">&nbsp;</div>';
}

function pageLinesToHtml(lines: PreviewLine[]): string {
	const html: string[] = [];
	let index = 0;
	while (index < lines.length) {
		const line = lines[index];
		if (line.kind === "blank") {
			html.push(renderBlankLine());
			index++;
			continue;
		}
		const group: PreviewLine[] = [];
		while (index < lines.length && lines[index].kind === line.kind) {
			group.push(lines[index]);
			index++;
		}
		if (line.kind === "title") {
			html.push(renderTextGroup("h1", group));
		} else if (line.kind === "heading") {
			html.push(renderTextGroup("h2", group));
		} else if (line.kind === "list") {
			html.push(renderListGroup(group));
		} else {
			html.push(renderTextGroup("p", group));
		}
	}
	return html.join("");
}

export function renderDocumentPages(text: string): string[] {
	const lines = buildPreviewLines(text);
	const pages: string[] = [];
	for (
		let index = 0;
		index < lines.length;
		index += PREVIEW_MAX_LINES_PER_PAGE
	) {
		pages.push(
			pageLinesToHtml(lines.slice(index, index + PREVIEW_MAX_LINES_PER_PAGE)),
		);
	}
	return pages.length > 0 ? pages : [""];
}

export function renderContractText(
	contractText: string,
	formData: Record<string, unknown>,
	blocks: ContractRenderableBlock[],
): string {
	return renderSharedContractText(contractText, formData, blocks, {
		formatDates: true,
	});
}

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
