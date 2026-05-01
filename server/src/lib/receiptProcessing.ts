import { deflateSync, inflateSync } from "node:zlib";

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

interface ImageDataForPdf {
	width: number;
	height: number;
	data: Buffer;
	filter: "DCTDecode" | "FlateDecode";
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
		const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
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

function readJpegDimensions(buffer: Buffer): { width: number; height: number } {
	let offset = 2;
	while (offset + 9 < buffer.length) {
		if (buffer[offset] !== 0xff) {
			offset++;
			continue;
		}

		const marker = buffer[offset + 1];
		offset += 2;

		if (
			marker === 0xd8 ||
			marker === 0xd9 ||
			(marker >= 0xd0 && marker <= 0xd7)
		) {
			continue;
		}

		if (offset + 2 > buffer.length) break;
		const length = buffer.readUInt16BE(offset);
		if (length < 2 || offset + length > buffer.length) break;

		if (
			(marker >= 0xc0 && marker <= 0xc3) ||
			(marker >= 0xc5 && marker <= 0xc7) ||
			(marker >= 0xc9 && marker <= 0xcb) ||
			(marker >= 0xcd && marker <= 0xcf)
		) {
			return {
				height: buffer.readUInt16BE(offset + 3),
				width: buffer.readUInt16BE(offset + 5),
			};
		}

		offset += length;
	}

	return { width: 1, height: 1 };
}

function paethPredictor(
	left: number,
	above: number,
	upperLeft: number,
): number {
	const estimate = left + above - upperLeft;
	const leftDistance = Math.abs(estimate - left);
	const aboveDistance = Math.abs(estimate - above);
	const upperLeftDistance = Math.abs(estimate - upperLeft);

	if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
		return left;
	}
	return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function unfilterPngRows(
	inflated: Buffer,
	width: number,
	height: number,
	bytesPerPixel: number,
): Buffer {
	const rowLength = width * bytesPerPixel;
	const output = Buffer.alloc(rowLength * height);
	let inputOffset = 0;

	for (let row = 0; row < height; row++) {
		const filter = inflated[inputOffset++];
		const rowOffset = row * rowLength;

		for (let column = 0; column < rowLength; column++) {
			const raw = inflated[inputOffset++];
			const left =
				column >= bytesPerPixel
					? output[rowOffset + column - bytesPerPixel]
					: 0;
			const above = row > 0 ? output[rowOffset + column - rowLength] : 0;
			const upperLeft =
				row > 0 && column >= bytesPerPixel
					? output[rowOffset + column - rowLength - bytesPerPixel]
					: 0;

			output[rowOffset + column] =
				filter === 0
					? raw
					: filter === 1
						? (raw + left) & 0xff
						: filter === 2
							? (raw + above) & 0xff
							: filter === 3
								? (raw + Math.floor((left + above) / 2)) & 0xff
								: filter === 4
									? (raw + paethPredictor(left, above, upperLeft)) & 0xff
									: raw;
		}
	}

	return output;
}

function decodePngForPdf(buffer: Buffer): ImageDataForPdf {
	const signature = "89504e470d0a1a0a";
	if (buffer.subarray(0, 8).toString("hex") !== signature) {
		throw new Error("Invalid PNG file");
	}

	let offset = 8;
	let width = 0;
	let height = 0;
	let bitDepth = 0;
	let colorType = 0;
	const idatChunks: Buffer[] = [];

	while (offset + 8 <= buffer.length) {
		const length = buffer.readUInt32BE(offset);
		const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
		const dataStart = offset + 8;
		const dataEnd = dataStart + length;
		if (dataEnd > buffer.length) break;

		if (type === "IHDR") {
			width = buffer.readUInt32BE(dataStart);
			height = buffer.readUInt32BE(dataStart + 4);
			bitDepth = buffer[dataStart + 8];
			colorType = buffer[dataStart + 9];
		} else if (type === "IDAT") {
			idatChunks.push(buffer.subarray(dataStart, dataEnd));
		} else if (type === "IEND") {
			break;
		}

		offset = dataEnd + 4;
	}

	const bytesPerPixelByColorType: Record<number, number> = {
		0: 1,
		2: 3,
		4: 2,
		6: 4,
	};
	const bytesPerPixel = bytesPerPixelByColorType[colorType];
	if (!width || !height || bitDepth !== 8 || !bytesPerPixel) {
		throw new Error("Unsupported PNG format");
	}

	const inflated = inflateSync(Buffer.concat(idatChunks));
	const pixels = unfilterPngRows(inflated, width, height, bytesPerPixel);
	const rgb = Buffer.alloc(width * height * 3);

	for (
		let source = 0, target = 0;
		source < pixels.length;
		source += bytesPerPixel
	) {
		if (colorType === 0 || colorType === 4) {
			rgb[target++] = pixels[source];
			rgb[target++] = pixels[source];
			rgb[target++] = pixels[source];
		} else {
			rgb[target++] = pixels[source];
			rgb[target++] = pixels[source + 1];
			rgb[target++] = pixels[source + 2];
		}
	}

	return {
		width,
		height,
		data: deflateSync(rgb),
		filter: "FlateDecode",
	};
}

function imageDataForPdf(buffer: Buffer, mimeType: string): ImageDataForPdf {
	if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
		const dimensions = readJpegDimensions(buffer);
		return {
			...dimensions,
			data: buffer,
			filter: "DCTDecode",
		};
	}

	return decodePngForPdf(buffer);
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
