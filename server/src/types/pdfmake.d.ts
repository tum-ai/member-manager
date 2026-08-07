// `@types/pdfmake` describes the browser build; the Node entry point exports the
// PdfPrinter class instead. Only the surface we use is declared here.
declare module "pdfmake" {
	import type { Readable } from "node:stream";

	interface PdfFontDescriptor {
		normal: string;
		bold: string;
		italics: string;
		bolditalics: string;
	}

	interface PdfKitDocument extends Readable {
		end(): void;
	}

	// biome-ignore lint/style/noDefaultExport: pdfmake's Node entry point really is a default export.
	export default class PdfPrinter {
		constructor(fonts: Record<string, PdfFontDescriptor>);
		createPdfKitDocument(
			documentDefinition: unknown,
			options?: Record<string, unknown>,
		): PdfKitDocument;
	}
}
