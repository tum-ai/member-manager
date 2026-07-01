import { type ImageDataForPdf, imageDataForPdf } from "./pdfImage.js";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 71;
const START_Y = 771;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const FONT_SIZE = 11;
const TITLE_FONT_SIZE = 20;
const LINE_HEIGHT = 17;
const TITLE_LINE_HEIGHT = 25;
const LIST_INDENT = 16;
const MAX_LINES_PER_PAGE = 39;
const MAX_CHARS_PER_LINE = 76;
const SIGNATURE_MAX_WIDTH = 220;
const SIGNATURE_MAX_HEIGHT = 90;

/** One signature to embed on the appended signature page. */
export interface PdfSignatureImage {
	/** Caption shown above the image, e.g. "Partner: Jane Doe". */
	label: string;
	/** Optional second caption line, e.g. the signing date. */
	sublabel?: string;
	/** Raw PNG bytes (already stripped of any data-URL prefix). */
	png: Buffer;
}

type PdfFont = "F1" | "F2";

interface PdfLine {
	text: string;
	font: PdfFont;
	fontSize: number;
	lineHeight: number;
	x: number;
	wordSpacing?: number;
}

function escapePdfText(value: string): string {
	const normalized = Array.from(value)
		.map((char) => {
			const replacement: Record<string, string> = {
				"€": "EUR",
				"–": "-",
				"—": "-",
				"“": '"',
				"”": '"',
				"„": '"',
				ä: "ae",
				ö: "oe",
				ü: "ue",
				Ä: "Ae",
				Ö: "Oe",
				Ü: "Ue",
				ß: "ss",
			};
			const code = char.charCodeAt(0);
			return code >= 32 && code <= 126 ? char : (replacement[char] ?? "");
		})
		.join("");

	return normalized
		.replace(/\\/g, "\\\\")
		.replace(/\(/g, "\\(")
		.replace(/\)/g, "\\)");
}

function approximateTextWidth(text: string, fontSize: number): number {
	return text.length * fontSize * 0.52;
}

function wrapText(text: string, maxChars: number): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	if (words.length === 0) return [""];
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (next.length > maxChars && current) {
			lines.push(current);
			current = word;
		} else {
			current = next;
		}
	}
	if (current) lines.push(current);
	return lines;
}

function isTitle(paragraph: string): boolean {
	return /^SPONSORINGVERTRAG$|^KOOPERATIONSVERTRAG$/i.test(paragraph.trim());
}

function isHeading(paragraph: string): boolean {
	const trimmed = paragraph.trim();
	return /^§\s*\d+\s+/.test(trimmed) || /^[A-ZÄÖÜ][^\n]{1,70}$/.test(trimmed);
}

function isList(paragraph: string): boolean {
	const lines = paragraph
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	return lines.length > 1 && lines.every((line) => /^[-•]/.test(line));
}

function paragraphToLines(paragraph: string): PdfLine[] {
	const trimmed = paragraph.trim();
	if (!trimmed) return [];

	if (isTitle(trimmed)) {
		return wrapText(trimmed, MAX_CHARS_PER_LINE).map((line) => ({
			text: line,
			font: "F2",
			fontSize: TITLE_FONT_SIZE,
			lineHeight: TITLE_LINE_HEIGHT,
			x: Math.max(
				MARGIN_X,
				(PAGE_WIDTH - approximateTextWidth(line, TITLE_FONT_SIZE)) / 2,
			),
		}));
	}

	if (isList(trimmed)) {
		return trimmed
			.split("\n")
			.map((line) => line.trim().replace(/^[-•]\s*/, ""))
			.filter(Boolean)
			.flatMap((item) =>
				wrapText(item, MAX_CHARS_PER_LINE).map((line, index) => ({
					text: `${index === 0 ? "- " : "  "}${line}`,
					font: "F1" as const,
					fontSize: FONT_SIZE,
					lineHeight: LINE_HEIGHT,
					x: MARGIN_X + LIST_INDENT,
				})),
			);
	}

	if (isHeading(trimmed)) {
		return wrapText(trimmed, MAX_CHARS_PER_LINE).map((line) => ({
			text: line,
			font: "F2",
			fontSize: FONT_SIZE,
			lineHeight: LINE_HEIGHT,
			x: MARGIN_X,
		}));
	}

	const lines = trimmed
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.flatMap((line) => wrapText(line, MAX_CHARS_PER_LINE));

	return lines.map((line, index) => {
		const spaces = line.split(" ").length - 1;
		const isLastLine = index === lines.length - 1;
		const textWidth = approximateTextWidth(line, FONT_SIZE);
		const remaining = CONTENT_WIDTH - textWidth;
		return {
			text: line,
			font: "F1",
			fontSize: FONT_SIZE,
			lineHeight: LINE_HEIGHT,
			x: MARGIN_X,
			wordSpacing:
				!isLastLine && spaces > 0 && remaining > 0
					? Math.min(remaining / spaces, 5)
					: undefined,
		};
	});
}

function buildLines(text: string): PdfLine[] {
	const paragraphs = text
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);

	const lines: PdfLine[] = [];
	for (const paragraph of paragraphs.length > 0 ? paragraphs : [""]) {
		if (lines.length > 0) {
			lines.push({
				text: "",
				font: "F1",
				fontSize: FONT_SIZE,
				lineHeight: LINE_HEIGHT,
				x: MARGIN_X,
			});
		}
		lines.push(...paragraphToLines(paragraph));
	}
	return lines;
}

function paginate(text: string): PdfLine[][] {
	const lines = buildLines(text);
	const pages: PdfLine[][] = [];
	for (let i = 0; i < lines.length; i += MAX_LINES_PER_PAGE) {
		pages.push(lines.slice(i, i + MAX_LINES_PER_PAGE));
	}
	return pages.length > 0 ? pages : [[]];
}

function contentStream(lines: PdfLine[]): string {
	const commands = ["BT"];
	let y = START_Y;
	for (const line of lines) {
		commands.push(`/${line.font} ${line.fontSize} Tf`);
		commands.push(`1 0 0 1 ${line.x.toFixed(2)} ${y.toFixed(2)} Tm`);
		if (line.wordSpacing !== undefined) {
			commands.push(`${line.wordSpacing.toFixed(2)} Tw`);
		}
		commands.push(`(${escapePdfText(line.text)}) Tj`);
		if (line.wordSpacing !== undefined) {
			commands.push("0 Tw");
		}
		y -= line.lineHeight;
	}
	commands.push("ET");
	return commands.join("\n");
}

function streamObject(dictionary: string, data: Buffer): Buffer {
	return Buffer.concat([
		Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`),
		data,
		Buffer.from("\nendstream"),
	]);
}

function drawSignatureText(
	commands: string[],
	font: PdfFont,
	fontSize: number,
	x: number,
	y: number,
	text: string,
): void {
	commands.push(
		"BT",
		`/${font} ${fontSize} Tf`,
		`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`,
		`(${escapePdfText(text)}) Tj`,
		"ET",
	);
}

/**
 * Content stream + decoded images for the appended signature page. Each image
 * is referenced as `/Im{index}` in the page resources, in the returned order.
 */
function buildSignaturePage(signatures: PdfSignatureImage[]): {
	stream: string;
	images: ImageDataForPdf[];
} {
	const commands: string[] = [];
	const images: ImageDataForPdf[] = [];
	let y = START_Y;

	drawSignatureText(commands, "F2", TITLE_FONT_SIZE, MARGIN_X, y, "Signaturen");
	y -= TITLE_LINE_HEIGHT + 12;

	for (const signature of signatures) {
		if (y < 140) break; // no room; keep it on one page for simplicity
		// Decode first: a corrupt/unsupported signature image must not break the
		// whole PDF — skip the entry (label included) instead of throwing.
		let image: ImageDataForPdf;
		try {
			image = imageDataForPdf(signature.png, "image/png");
		} catch {
			continue;
		}
		drawSignatureText(commands, "F2", FONT_SIZE, MARGIN_X, y, signature.label);
		y -= LINE_HEIGHT;
		if (signature.sublabel) {
			drawSignatureText(
				commands,
				"F1",
				FONT_SIZE - 1,
				MARGIN_X,
				y,
				signature.sublabel,
			);
			y -= LINE_HEIGHT;
		}

		const scale = Math.min(
			SIGNATURE_MAX_WIDTH / image.width,
			SIGNATURE_MAX_HEIGHT / image.height,
		);
		const width = image.width * scale;
		const height = image.height * scale;
		const imageBottom = y - height - 4;
		const index = images.length;
		images.push(image);
		commands.push(
			"q",
			`${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${MARGIN_X.toFixed(2)} ${imageBottom.toFixed(2)} cm`,
			`/Im${index} Do`,
			"Q",
		);
		y = imageBottom - 28;
	}

	return { stream: commands.join("\n"), images };
}

export function createTextPdf(
	text: string,
	signatures: PdfSignatureImage[] = [],
): Buffer {
	const pages = paginate(text);
	const objects: Buffer[] = [];
	const addObject = (body: Buffer | string): number => {
		objects.push(typeof body === "string" ? Buffer.from(body) : body);
		return objects.length;
	};

	const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
	const pagesObjectIndex = addObject("__PAGES__");
	const fontId = addObject(
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	);
	const boldFontId = addObject(
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
	);
	const pageIds: number[] = [];

	for (const pageLines of pages) {
		const stream = contentStream(pageLines);
		const contentId = addObject(streamObject("", Buffer.from(stream, "utf8")));
		const pageId = addObject(
			`<< /Type /Page /Parent ${pagesObjectIndex} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
		);
		pageIds.push(pageId);
	}

	if (signatures.length > 0) {
		const { stream, images } = buildSignaturePage(signatures);
		const imageIds = images.map((image) =>
			addObject(
				streamObject(
					`/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${image.filter}`,
					image.data,
				),
			),
		);
		const contentId = addObject(streamObject("", Buffer.from(stream, "utf8")));
		const xobjectResources = imageIds
			.map((id, index) => `/Im${index} ${id} 0 R`)
			.join(" ");
		const pageId = addObject(
			`<< /Type /Page /Parent ${pagesObjectIndex} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> /XObject << ${xobjectResources} >> >> /Contents ${contentId} 0 R >>`,
		);
		pageIds.push(pageId);
	}

	objects[pagesObjectIndex - 1] = Buffer.from(
		`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
	);

	const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n")];
	const offsets: number[] = [];
	let length = chunks[0].length;
	objects.forEach((object, index) => {
		offsets.push(length);
		const header = Buffer.from(`${index + 1} 0 obj\n`);
		const footer = Buffer.from("\nendobj\n");
		chunks.push(header, object, footer);
		length += header.length + object.length + footer.length;
	});

	const xrefOffset = length;
	const xrefLines = [
		"xref",
		`0 ${objects.length + 1}`,
		"0000000000 65535 f ",
		...offsets.map(
			(offset) => `${offset.toString().padStart(10, "0")} 00000 n `,
		),
		"trailer",
		`<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>`,
		"startxref",
		String(xrefOffset),
		"%%EOF",
		"",
	].join("\n");
	chunks.push(Buffer.from(xrefLines));

	return Buffer.concat(chunks);
}
