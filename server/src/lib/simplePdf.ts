const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const START_Y = 790;
const FONT_SIZE = 10;
const LINE_HEIGHT = 14;
const MAX_CHARS_PER_LINE = 92;
const MAX_LINES_PER_PAGE = 52;

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

function wrapLine(line: string): string[] {
	const words = line.split(/\s+/).filter(Boolean);
	if (words.length === 0) return [""];
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (next.length > MAX_CHARS_PER_LINE && current) {
			lines.push(current);
			current = word;
		} else {
			current = next;
		}
	}
	if (current) lines.push(current);
	return lines;
}

function paginate(text: string): string[][] {
	const lines = text
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split("\n")
		.flatMap(wrapLine);
	const pages: string[][] = [];
	for (let i = 0; i < lines.length; i += MAX_LINES_PER_PAGE) {
		pages.push(lines.slice(i, i + MAX_LINES_PER_PAGE));
	}
	return pages.length > 0 ? pages : [[""]];
}

function contentStream(lines: string[]): string {
	const escapedLines = lines
		.map((line) => `(${escapePdfText(line)}) Tj T*`)
		.join("\n");
	return `BT\n/F1 ${FONT_SIZE} Tf\n${LINE_HEIGHT} TL\n${MARGIN_X} ${START_Y} Td\n${escapedLines}\nET`;
}

export function createTextPdf(text: string): Buffer {
	const pages = paginate(text);
	const objects: string[] = [];
	const addObject = (body: string): number => {
		objects.push(body);
		return objects.length;
	};

	const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
	const pagesObjectIndex = addObject("__PAGES__");
	const fontId = addObject(
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	);
	const pageIds: number[] = [];

	for (const pageLines of pages) {
		const stream = contentStream(pageLines);
		const contentId = addObject(
			`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
		);
		const pageId = addObject(
			`<< /Type /Page /Parent ${pagesObjectIndex} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
		);
		pageIds.push(pageId);
	}

	objects[pagesObjectIndex - 1] =
		`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

	let body = "%PDF-1.4\n";
	const offsets = [0];
	for (let i = 0; i < objects.length; i++) {
		offsets.push(Buffer.byteLength(body, "utf8"));
		body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
	}
	const xrefOffset = Buffer.byteLength(body, "utf8");
	body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (let i = 1; i < offsets.length; i++) {
		body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
	}
	body += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
	return Buffer.from(body, "utf8");
}
