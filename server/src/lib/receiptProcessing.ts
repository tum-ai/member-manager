import { fetchWithTimeout } from "./fetchWithTimeout.js";
import { imageDataForPdf } from "./pdfImage.js";

const OPENAI_CHAT_COMPLETIONS_URL =
	"https://api.openai.com/v1/chat/completions";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 40;

export interface ProcessReceiptFileInput {
	fileBase64: string;
	filename: string;
	mimeType: string;
	billingDate: string;
	personName: string;
	description: string;
}

export interface ProcessReceiptFileOutput {
	pdfBase64: string;
	generatedFilename: string;
	originalFilename: string;
}

export function stripDataUrlPrefix(value: string): string {
	const marker = "base64,";
	const markerIndex = value.indexOf(marker);
	return markerIndex >= 0 ? value.slice(markerIndex + marker.length) : value;
}

export function sanitizeReceiptFilename(value: string): string {
	return value
		.trim()
		.replace(/[/\\?%*:|"<>]/g, "")
		.replace(/[^\w.\- ]+/g, "")
		.replace(/\s+/g, "_")
		.slice(0, 255);
}

function sanitizeFilenamePart(value: string): string {
	return value
		.trim()
		.replace(/[^a-zA-Z0-9\s]/g, "")
		.replace(/\s+/g, "_");
}

function formatReceiptDate(value: string): string {
	const [year, month, day] = value.split("-");
	return `${day}${month}${year.slice(-2)}`;
}

async function generateIdentifier(description: string): Promise<string> {
	const apiKey = process.env.OPENAI_API_KEY?.trim();
	if (!apiKey) {
		return "Expense";
	}

	try {
		const response = await fetchWithTimeout(OPENAI_CHAT_COMPLETIONS_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "system",
						content:
							"Summarize reimbursement descriptions into one English filename word.",
					},
					{
						role: "user",
						content: `Use one descriptive word, no punctuation: "${description}"`,
					},
				],
				max_tokens: 10,
				temperature: 0.3,
			}),
		});

		if (!response.ok) {
			return "Expense";
		}

		const data = (await response.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
		};
		const rawIdentifier = data.choices?.[0]?.message?.content?.trim();
		const identifier = rawIdentifier
			? sanitizeFilenamePart(rawIdentifier.split(/\s+/)[0] ?? "")
			: "";
		return identifier || "Expense";
	} catch {
		return "Expense";
	}
}

async function generateReceiptFilename({
	billingDate,
	personName,
	description,
}: Pick<
	ProcessReceiptFileInput,
	"billingDate" | "personName" | "description"
>): Promise<string> {
	const nameParts = personName.trim().split(/\s+/).filter(Boolean);
	const name =
		nameParts.length >= 2
			? `${nameParts[0]}${nameParts[nameParts.length - 1]}`
			: (nameParts[0] ?? "Unknown");
	const cleanName = sanitizeFilenamePart(name) || "Unknown";
	const identifier = await generateIdentifier(description);

	return `${formatReceiptDate(billingDate)}_${cleanName}_${identifier}.pdf`;
}

function createPdfStream(dictionary: string, data: Buffer): Buffer {
	return Buffer.concat([
		Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`),
		data,
		Buffer.from("\nendstream"),
	]);
}

function createPdf(objects: Buffer[]): Buffer {
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
		`<< /Size ${objects.length + 1} /Root 1 0 R >>`,
		"startxref",
		String(xrefOffset),
		"%%EOF",
	].join("\n");
	chunks.push(Buffer.from(xrefLines));

	return Buffer.concat(chunks);
}

function convertImageToPdf(imageBuffer: Buffer, mimeType: string): Buffer {
	const image = imageDataForPdf(imageBuffer, mimeType);
	const maxWidth = A4_WIDTH - PAGE_MARGIN * 2;
	const maxHeight = A4_HEIGHT - PAGE_MARGIN * 2;
	const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
	const width = image.width * scale;
	const height = image.height * scale;
	const x = (A4_WIDTH - width) / 2;
	const y = (A4_HEIGHT - height) / 2;
	const content = Buffer.from(
		`q\n${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(
			2,
		)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`,
	);

	return createPdf([
		Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
		Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
		Buffer.from(
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
		),
		createPdfStream(
			`/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${image.filter}`,
			image.data,
		),
		createPdfStream("", content),
	]);
}

export async function processReceiptFile(
	input: ProcessReceiptFileInput,
): Promise<ProcessReceiptFileOutput> {
	const rawBase64 = stripDataUrlPrefix(input.fileBase64);
	const generatedFilename = await generateReceiptFilename(input);
	const originalFilename = input.filename;

	if (input.mimeType === "application/pdf") {
		return {
			pdfBase64: rawBase64,
			generatedFilename,
			originalFilename,
		};
	}

	const pdf = convertImageToPdf(
		Buffer.from(rawBase64, "base64"),
		input.mimeType,
	);
	return {
		pdfBase64: pdf.toString("base64"),
		generatedFilename,
		originalFilename,
	};
}
