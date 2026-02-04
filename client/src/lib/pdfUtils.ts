import { jsPDF } from "jspdf";

export const PDF_COLORS = {
	primary: [60, 0, 180] as const,
	text: [40, 40, 40] as const,
} as const;

export const LOGO_PATH = "/img/logo_black.png";

export interface BoardMember {
	name: string;
	title: string;
}

export const DEFAULT_BOARD_MEMBERS = {
	president: { name: "Sami Haddouti", title: "TUM.ai President" },
	vicePresident: { name: "Julian Sikora", title: "TUM.ai Vice President" },
} as const;

export function loadImageAsBase64(src: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (ctx) {
				canvas.width = img.width;
				canvas.height = img.height;
				ctx.drawImage(img, 0, 0);
				resolve(canvas.toDataURL("image/png"));
			} else {
				reject(new Error("Could not get canvas context"));
			}
		};
		img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
		img.src = src;
	});
}

export function formatGermanDate(dateString: string): string {
	const date = new Date(dateString);
	if (Number.isNaN(date.getTime())) {
		return "Invalid Date";
	}
	return date.toLocaleDateString("de-DE", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export function getTodayGermanDate(): string {
	return new Date().toLocaleDateString("de-DE", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export interface PdfDocumentOptions {
	orientation?: "p" | "l";
	margin?: number;
}

export function createPdfDocument(options: PdfDocumentOptions = {}) {
	const { orientation = "p", margin = 20 } = options;
	const doc = new jsPDF(orientation, "mm", "a4");
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const maxWidth = pageWidth - margin * 2;

	return {
		doc,
		pageWidth,
		pageHeight,
		margin,
		maxWidth,
	};
}

export async function addLogoToDocument(
	doc: jsPDF,
	pageWidth: number,
	y = 10,
	logoWidth = 60,
	logoHeight = 15,
): Promise<void> {
	try {
		const base64Logo = await loadImageAsBase64(LOGO_PATH);
		doc.addImage(
			base64Logo,
			"PNG",
			pageWidth / 2 - logoWidth / 2,
			y,
			logoWidth,
			logoHeight,
			undefined,
			"MEDIUM",
		);
	} catch (e) {
		console.warn("Failed to load logo:", e);
	}
}

export interface SignatureBlockOptions {
	president?: BoardMember;
	vicePresident?: BoardMember;
	date?: string;
}

export function addSignatureBlock(
	doc: jsPDF,
	y: number,
	margin: number,
	pageWidth: number,
	options: SignatureBlockOptions = {},
): void {
	const {
		president = DEFAULT_BOARD_MEMBERS.president,
		vicePresident = DEFAULT_BOARD_MEMBERS.vicePresident,
		date = getTodayGermanDate(),
	} = options;

	doc.setFontSize(11);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(PDF_COLORS.text[0], PDF_COLORS.text[1], PDF_COLORS.text[2]);

	doc.text(vicePresident.name, margin, y);
	doc.text(vicePresident.title, margin, y + 6);
	doc.text(`Munich, ${date}`, margin, y + 12);

	const rightX = pageWidth - margin - 60;
	doc.text(president.name, rightX, y);
	doc.text(president.title, rightX, y + 6);
	doc.text(`Munich, ${date}`, rightX, y + 12);
}
