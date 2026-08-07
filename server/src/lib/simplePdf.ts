import PdfPrinter from "pdfmake";
import { buildContractDocDefinition } from "./contracts/contractPdfDocument.js";

// Contract PDFs are typeset with pdfmake: pure JavaScript, no service and no
// headless browser. Only the 14 standard PDF fonts are used, so no font files
// have to be shipped or read at runtime.
//
// The page layout lives in contracts/contractPdfDocument.ts; this module only
// turns that description into bytes.

/** Which party a signature belongs to; matches the inline template tokens. */
export type PdfSignatureRole = "partner" | "board";

/** One signature to embed in the document. */
export interface PdfSignatureImage {
	/**
	 * When set and the document body contains the matching
	 * `{{partner_signature}}` / `{{board_signature}}` token, the image is drawn
	 * inline at that position instead of on the trailing signature page.
	 */
	role?: PdfSignatureRole;
	/** Caption shown under the image, e.g. "Partner: Jane Doe". */
	label: string;
	/** Optional second caption part, e.g. the signing date. */
	sublabel?: string;
	/** Raw PNG bytes (already stripped of any data-URL prefix). */
	png: Buffer;
}

const STANDARD_FONTS = {
	Helvetica: {
		normal: "Helvetica",
		bold: "Helvetica-Bold",
		italics: "Helvetica-Oblique",
		bolditalics: "Helvetica-BoldOblique",
	},
};

let printer: PdfPrinter | null = null;

/** One printer per process: it parses the font metrics on construction. */
function getPrinter(): PdfPrinter {
	if (!printer) printer = new PdfPrinter(STANDARD_FONTS);
	return printer;
}

/** Render contract text (plus any signatures) into a PDF document. */
export async function createTextPdf(
	text: string,
	signatures: PdfSignatureImage[] = [],
): Promise<Buffer> {
	const definition = buildContractDocDefinition(text, signatures);
	const document = getPrinter().createPdfKitDocument(definition);

	return await new Promise<Buffer>((resolve, reject) => {
		const chunks: Buffer[] = [];
		document.on("data", (chunk: Buffer) => chunks.push(chunk));
		document.on("end", () => resolve(Buffer.concat(chunks)));
		document.on("error", reject);
		document.end();
	});
}
