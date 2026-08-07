// The layout model shared by the on-screen preview and the printed PDF, so the
// page Legal reviews is the page the partner receives.
//
// One line of the template is one Word paragraph. A blank line is the paragraph
// spacing Word puts between them; consecutive lines stay tight, exactly as in
// the source documents.
//
// Formatting is declared in the template text rather than guessed:
//
//   # KOOPERATIONSVERTRAG    centered contract title
//   ## § 1 Veranstaltung     bold heading
//   **fett**                 bold inside a line
//   *kursiv*                 italic inside a line
//   - Leistung               bullet list
//   a) Text ...              outline item, hanging indent (recognised as-is)
//   {{partner_signature}}    signature line
//   left | right             columns, e.g. the two-column signature block
//   ---                      page break
//
// Anything without a marker is body text. Nothing else is ever bolded,
// centered or indented on its own.

export type ContractSignatureRole = "partner" | "board";

export interface ContractInlineRun {
	text: string;
	bold?: boolean;
	italics?: boolean;
}

interface Spacing {
	/** True when Word leaves a blank line after this paragraph. */
	spaced: boolean;
}

export type ContractBlock = Spacing &
	(
		| { kind: "title"; runs: ContractInlineRun[] }
		| { kind: "heading"; runs: ContractInlineRun[] }
		| { kind: "paragraph"; runs: ContractInlineRun[] }
		/** "a)", "(1)", "(iii)" and their text, laid out with a hanging indent. */
		| { kind: "outline"; label: string; runs: ContractInlineRun[] }
		| { kind: "list"; items: ContractInlineRun[][] }
		| { kind: "signature"; role: ContractSignatureRole }
		/** Side-by-side cells, as in the two-column signature block. */
		| { kind: "columns"; cells: LooseBlock[][] }
		| { kind: "pagebreak" }
		/** An extra blank line of vertical space. */
		| { kind: "spacer" }
	);

const TITLE_MARKER = /^#\s+(.*)$/;
const HEADING_MARKER = /^##\s+(.*)$/;
const LIST_MARKER = /^[-•]\s+(.*)$/;
/** "a)", "(a)", "(1)", "(iii)", "1." - the outline labels Word prints. */
const OUTLINE_MARKER = /^(\(?[a-z0-9]{1,4}\)|\d{1,2}\.)\s+(.*)$/i;
const SIGNATURE_TOKEN = /\{\{(partner_signature|board_signature)\}\}/;
const PAGE_BREAK_MARKER = /^-{3,}$/;
const COLUMN_SEPARATOR = " | ";
/** `**bold**` first, so a bold span is not mistaken for two italic ones. */
const EMPHASIS_MARKER = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;

/**
 * German contracts wrap asides in dashes ("- im Folgenden TUM.ai genannt -").
 * Those are body text, not bullets.
 */
function isDashAside(line: string): boolean {
	return LIST_MARKER.test(line) && /[-–—]$/.test(line);
}

/** Split a line into plain, bold and italic runs. */
export function parseInlineRuns(line: string): ContractInlineRun[] {
	const runs: ContractInlineRun[] = [];
	let cursor = 0;
	EMPHASIS_MARKER.lastIndex = 0;
	let match = EMPHASIS_MARKER.exec(line);

	while (match) {
		if (match.index > cursor) {
			runs.push({ text: line.slice(cursor, match.index) });
		}
		runs.push(
			match[1] !== undefined
				? { text: match[1], bold: true }
				: { text: match[2], italics: true },
		);
		cursor = match.index + match[0].length;
		match = EMPHASIS_MARKER.exec(line);
	}

	if (cursor < line.length) runs.push({ text: line.slice(cursor) });
	return runs.length > 0 ? runs : [{ text: line }];
}

/** A block before its spacing is known. */
export type LooseBlock =
	| { kind: "title"; runs: ContractInlineRun[] }
	| { kind: "heading"; runs: ContractInlineRun[] }
	| { kind: "paragraph"; runs: ContractInlineRun[] }
	| { kind: "outline"; label: string; runs: ContractInlineRun[] }
	| { kind: "list"; items: ContractInlineRun[][] }
	| { kind: "signature"; role: ContractSignatureRole }
	| { kind: "columns"; cells: LooseBlock[][] }
	| { kind: "pagebreak" }
	| { kind: "spacer" };

/** Everything a single line can turn into, signature tokens included. */
function parseLine(line: string): LooseBlock[] {
	if (PAGE_BREAK_MARKER.test(line)) return [{ kind: "pagebreak" }];

	if (line.includes(COLUMN_SEPARATOR)) {
		return [
			{
				kind: "columns",
				cells: line
					.split(COLUMN_SEPARATOR)
					.map((cell) => parseLine(cell.trim())),
			},
		];
	}

	const signature = SIGNATURE_TOKEN.exec(line);
	if (signature) {
		const blocks: LooseBlock[] = [];
		const before = line.slice(0, signature.index).trim();
		if (before) blocks.push(...parseLine(before));
		blocks.push({
			kind: "signature",
			role: signature[1] === "partner_signature" ? "partner" : "board",
		});
		const after = line.slice(signature.index + signature[0].length).trim();
		if (after) blocks.push(...parseLine(after));
		return blocks;
	}

	const title = TITLE_MARKER.exec(line);
	if (title && !HEADING_MARKER.test(line)) {
		return [{ kind: "title", runs: parseInlineRuns(title[1]) }];
	}

	const heading = HEADING_MARKER.exec(line);
	if (heading) return [{ kind: "heading", runs: parseInlineRuns(heading[1]) }];

	const outline = OUTLINE_MARKER.exec(line);
	if (outline) {
		return [
			{ kind: "outline", label: outline[1], runs: parseInlineRuns(outline[2]) },
		];
	}

	return [{ kind: "paragraph", runs: parseInlineRuns(line) }];
}

/** Parse one group of consecutive lines, merging runs of bullet items. */
function parseGroup(lines: string[]): LooseBlock[] {
	const blocks: LooseBlock[] = [];
	let bullets: ContractInlineRun[][] = [];
	const flushBullets = () => {
		if (bullets.length === 0) return;
		blocks.push({ kind: "list", items: bullets });
		bullets = [];
	};

	for (const line of lines) {
		const bullet = LIST_MARKER.exec(line);
		if (bullet && !isDashAside(line)) {
			bullets.push(parseInlineRuns(bullet[1]));
			continue;
		}
		flushBullets();
		blocks.push(...parseLine(line));
	}

	flushBullets();
	return blocks;
}

/** Parse contract text into the blocks the preview and the PDF both render. */
export function parseContractLayout(text: string): ContractBlock[] {
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	const blocks: ContractBlock[] = [];
	let group: string[] = [];

	const flushGroup = (blankLines: number) => {
		if (group.length === 0) return;
		const parsed = parseGroup(group);
		parsed.forEach((block, index) => {
			// Only the last paragraph of a group carries the blank line that
			// followed it in the source.
			blocks.push({
				...block,
				spaced: index === parsed.length - 1 && blankLines > 0,
			});
		});
		group = [];
		// Word reserves vertical space with further empty paragraphs - above the
		// signature block, for instance. Keep every one of them.
		for (let extra = 1; extra < blankLines; extra += 1) {
			blocks.push({ kind: "spacer", spaced: false });
		}
	};

	let index = 0;
	while (index < lines.length) {
		const line = lines[index].trim();
		if (line) {
			group.push(line);
			index += 1;
			continue;
		}
		let blankLines = 0;
		while (index < lines.length && !lines[index].trim()) {
			blankLines += 1;
			index += 1;
		}
		// Trailing blank lines must not add space after the last paragraph.
		flushGroup(index < lines.length ? blankLines : 0);
	}
	flushGroup(0);

	return blocks;
}

/** The plain text of a run list. */
export function runsToText(runs: ContractInlineRun[]): string {
	return runs.map((run) => run.text).join("");
}
