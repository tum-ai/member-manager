import type { PdfSignatureImage, PdfSignatureRole } from "../simplePdf.js";
import {
	type ContractBlock,
	type ContractInlineRun,
	type LooseBlock,
	parseContractLayout,
} from "./contractLayout.js";
import { CONTRACT_LOGO_DATA_URL } from "./contractLogo.js";

// Page geometry of the Word templates: A4 with ~2.5 cm margins, 11 pt body at
// 1.5 line spacing, justified. Values are PDF points (1/72 inch).
// Word: 2.5 cm side/top margins, 2 cm bottom, header 1.25 cm from the edge.
const MARGIN = 71;
const BOTTOM_MARGIN = 57;
const HEADER_TOP = 35;
const BODY_FONT_SIZE = 11;
const LINE_HEIGHT = 1.5;
const TITLE_FONT_SIZE = 20;
/** The header logo is 1134405 EMU wide in the Word templates. */
const LOGO_WIDTH = 89;
// Word indents an outline item by 36 pt with an 18 pt hanging label.
const OUTLINE_INDENT = 18;
const LABEL_WIDTH = 18;
const SIGNATURE_WIDTH = 134;
/** The blank rule Word draws for a signature: 22 underscores. */
const SIGNATURE_RULE = "_".repeat(22);
/** Vertical space Word leaves between paragraphs, in points. */
const PARAGRAPH_GAP = 8;

export interface ContractDocDefinition {
	pageSize: "A4";
	pageMargins: [number, number, number, number];
	defaultStyle: Record<string, unknown>;
	header: unknown;
	footer: (page: number, total: number) => unknown;
	content: unknown[];
	info: Record<string, string>;
}

const PNG_MAGIC = Buffer.from("89504e470d0a1a0a", "hex");

/**
 * pdfmake throws on anything it cannot decode. A corrupt signature blob must
 * never cost Legal the whole contract PDF, so unreadable images are treated as
 * "not signed yet" and leave the blank rule behind.
 */
function isRenderableImage(png: Buffer): boolean {
	if (png.length > 8 && png.subarray(0, 8).equals(PNG_MAGIC)) return true;
	// JPEG start-of-image marker.
	return (
		png.length > 3 && png[0] === 0xff && png[1] === 0xd8 && png[2] === 0xff
	);
}

/** pdfmake renders a run list as a text array, so bold spans survive. */
function runsToPdf(runs: ContractInlineRun[]): unknown[] {
	return runs.map((run) =>
		run.bold || run.italics
			? { text: run.text, bold: run.bold, italics: run.italics }
			: run.text,
	);
}

/**
 * The signature area of one party: the drawn signature with its caption, or
 * the blank rule the Word template prints while that party has not signed.
 */
function signatureBlock(image: PdfSignatureImage | undefined): unknown {
	if (!image || !isRenderableImage(image.png)) {
		return { text: SIGNATURE_RULE, margin: [0, 6, 0, 6] };
	}
	const caption = [image.label, image.sublabel].filter(Boolean).join(" · ");
	return {
		stack: [
			{
				// pdfmake takes images as data URLs.
				image: `data:image/png;base64,${image.png.toString("base64")}`,
				width: SIGNATURE_WIDTH,
			},
			{ text: caption, fontSize: 9, color: "#555", margin: [0, 2, 0, 0] },
		],
		margin: [0, 6, 0, 10],
	};
}

/** Translate one layout block into a pdfmake node. */
function blockToPdf(
	block: ContractBlock | (LooseBlock & { spaced: boolean }),
	signaturesByRole: Map<PdfSignatureRole, PdfSignatureImage>,
	drawnRoles: Set<PdfSignatureRole>,
): unknown {
	// Consecutive lines stay tight, as in Word; a blank line in the template is
	// what puts space under a paragraph.
	const gap = block.spaced ? PARAGRAPH_GAP : 0;
	switch (block.kind) {
		case "title":
			return {
				text: runsToPdf(block.runs),
				fontSize: TITLE_FONT_SIZE,
				bold: true,
				alignment: "center",
				margin: [0, 12, 0, Math.max(gap, PARAGRAPH_GAP * 2)],
			};
		case "heading":
			return {
				text: runsToPdf(block.runs),
				bold: true,
				alignment: "left",
				margin: [0, PARAGRAPH_GAP, 0, gap],
			};
		case "list":
			return {
				ul: block.items.map((item) => ({ text: runsToPdf(item) })),
				margin: [OUTLINE_INDENT, 0, 0, gap],
			};
		case "outline":
			// Hanging indent: the label sits in its own column so wrapped lines
			// align under the text, exactly like the Word outline.
			return {
				columns: [
					{ text: block.label, width: LABEL_WIDTH, alignment: "left" },
					{ text: runsToPdf(block.runs), width: "*" },
				],
				margin: [OUTLINE_INDENT, 0, 0, gap],
			};
		case "signature":
			drawnRoles.add(block.role);
			return signatureBlock(signaturesByRole.get(block.role));
		case "columns":
			// Word's signature block puts the partner left and TUM.ai right.
			return {
				columns: block.cells.map((cell) => ({
					width: "*",
					stack: cell.map((inner) =>
						blockToPdf(
							{ ...inner, spaced: false },
							signaturesByRole,
							drawnRoles,
						),
					),
				})),
				columnGap: 16,
				margin: [0, 0, 0, gap],
			};
		case "pagebreak":
			return { text: "", pageBreak: "after" };
		case "spacer":
			return { text: " ", margin: [0, 0, 0, 0] };
		default:
			return { text: runsToPdf(block.runs), margin: [0, 0, 0, gap] };
	}
}

/**
 * Build the pdfmake document for a contract from the same layout model the
 * preview uses. Kept free of pdfmake imports so it stays a pure, testable
 * description of the page.
 */
export function buildContractDocDefinition(
	text: string,
	signatures: PdfSignatureImage[] = [],
): ContractDocDefinition {
	const signaturesByRole = new Map<PdfSignatureRole, PdfSignatureImage>();
	for (const signature of signatures) {
		if (signature.role) signaturesByRole.set(signature.role, signature);
	}
	const drawnRoles = new Set<PdfSignatureRole>();

	const content = parseContractLayout(text).map((block) =>
		blockToPdf(block, signaturesByRole, drawnRoles),
	);

	// Signatures the text never referenced keep their trailing page.
	const trailing = signatures.filter(
		(signature) => !signature.role || !drawnRoles.has(signature.role),
	);
	if (trailing.length > 0) {
		content.push({
			text: "Signaturen",
			bold: true,
			pageBreak: "before",
			margin: [0, 0, 0, 12],
		});
		for (const signature of trailing) content.push(signatureBlock(signature));
	}

	return {
		pageSize: "A4",
		pageMargins: [MARGIN, MARGIN, MARGIN, BOTTOM_MARGIN],
		defaultStyle: {
			font: "Helvetica",
			fontSize: BODY_FONT_SIZE,
			lineHeight: LINE_HEIGHT,
			alignment: "justify",
		},
		header: {
			image: CONTRACT_LOGO_DATA_URL,
			width: LOGO_WIDTH,
			alignment: "right",
			margin: [0, HEADER_TOP, MARGIN / 2, 0],
		},
		footer: (page: number, total: number) => ({
			text: `${page} | ${total}`,
			alignment: "right",
			fontSize: 9,
			color: "#666",
			margin: [0, 0, MARGIN / 2, 24],
		}),
		content,
		info: { title: "TUM.ai Vertrag", author: "TUM.ai e.V." },
	};
}
