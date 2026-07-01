import { deflateSync, inflateSync } from "node:zlib";

// Shared raster-image decoding for the hand-rolled PDF writers. Extracted from
// receiptProcessing so both the receipt→PDF path and the contract signature
// embedding (simplePdf) decode PNG/JPEG the same way, with no extra dependency.

export interface ImageDataForPdf {
	width: number;
	height: number;
	data: Buffer;
	filter: "DCTDecode" | "FlateDecode";
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

export function decodePngForPdf(buffer: Buffer): ImageDataForPdf {
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
			const gray = pixels[source];
			const alpha = colorType === 4 ? pixels[source + 1] / 255 : 1;
			const value = Math.round(gray * alpha + 255 * (1 - alpha));
			rgb[target++] = value;
			rgb[target++] = value;
			rgb[target++] = value;
		} else {
			const alpha = colorType === 6 ? pixels[source + 3] / 255 : 1;
			rgb[target++] = Math.round(pixels[source] * alpha + 255 * (1 - alpha));
			rgb[target++] = Math.round(
				pixels[source + 1] * alpha + 255 * (1 - alpha),
			);
			rgb[target++] = Math.round(
				pixels[source + 2] * alpha + 255 * (1 - alpha),
			);
		}
	}

	return {
		width,
		height,
		data: deflateSync(rgb),
		filter: "FlateDecode",
	};
}

export function imageDataForPdf(
	buffer: Buffer,
	mimeType: string,
): ImageDataForPdf {
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
