import type { ContractPdfAnchor } from "@member-manager/shared";
import { PDFDocument, rgb } from "pdf-lib";
import { ValidationError } from "../errors.js";
import {
	CONTRACT_SIGNATURE_SENTINELS,
	type ContractSignatureAnchorRole,
} from "./contractDocx.js";

const PNG_MAGIC = Buffer.from("89504e470d0a1a0a", "hex");
const MAX_SIGNATURE_BYTES = 1_500_000;
const MAX_SIGNATURE_DIMENSION = 4_096;
const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;

type Matrix = [number, number, number, number, number, number];

export type ContractPdfSignatureAnchor = ContractPdfAnchor;

export interface ContractPdfSignatureAnchors {
	partner: ContractPdfSignatureAnchor;
	board: ContractPdfSignatureAnchor;
}

export async function getContractPdfPageCount(pdf: Buffer): Promise<number> {
	const document = await PDFDocument.load(pdf, {
		ignoreEncryption: false,
		updateMetadata: false,
	});
	return document.getPageCount();
}

interface PdfJsImage {
	width: number;
	height: number;
	data?: ArrayLike<number>;
}

function multiply(left: Matrix, right: Matrix): Matrix {
	return [
		left[0] * right[0] + left[2] * right[1],
		left[1] * right[0] + left[3] * right[1],
		left[0] * right[2] + left[2] * right[3],
		left[1] * right[2] + left[3] * right[3],
		left[0] * right[4] + left[2] * right[5] + left[4],
		left[1] * right[4] + left[3] * right[5] + left[5],
	];
}

function asMatrix(value: unknown): Matrix | null {
	if (
		!Array.isArray(value) ||
		value.length !== 6 ||
		value.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))
	) {
		return null;
	}
	return value as Matrix;
}

function asPdfJsImage(value: unknown): PdfJsImage | null {
	if (typeof value !== "object" || value === null) return null;
	const candidate = value as {
		width?: unknown;
		height?: unknown;
		data?: unknown;
	};
	if (
		typeof candidate.width !== "number" ||
		typeof candidate.height !== "number"
	) {
		return null;
	}
	return {
		width: candidate.width,
		height: candidate.height,
		data:
			candidate.data && typeof candidate.data === "object"
				? (candidate.data as ArrayLike<number>)
				: undefined,
	};
}

function pixelMatches(
	image: PdfJsImage,
	color: readonly [number, number, number],
): boolean {
	if (!image.data || image.width <= 0 || image.height <= 0) return true;
	const pixelCount = image.width * image.height;
	const channels = image.data.length / pixelCount;
	if (channels !== 3 && channels !== 4) return true;
	const samplePixels = [0, Math.floor(pixelCount / 2), pixelCount - 1];
	return samplePixels.every((pixel) => {
		const offset = pixel * channels;
		const alpha = channels === 4 ? Number(image.data?.[offset + 3]) : 255;
		return color.every((expected, channel) => {
			const actual = Number(image.data?.[offset + channel]);
			const unpremultiplied = alpha > 0 ? (actual * 255) / alpha : actual;
			return (
				Math.abs(actual - expected) <= 3 ||
				(alpha < 32 && Math.abs(unpremultiplied - expected) <= 35)
			);
		});
	});
}

function identifyAnchorImage(
	image: PdfJsImage,
): ContractSignatureAnchorRole | null {
	for (const role of ["partner", "board"] as const) {
		const sentinel = CONTRACT_SIGNATURE_SENTINELS[role];
		if (
			image.width === sentinel.widthPixels &&
			image.height === sentinel.heightPixels &&
			pixelMatches(image, sentinel.color)
		) {
			return role;
		}
	}
	return null;
}

function boxFromMatrix(
	matrix: Matrix,
	page: number,
): ContractPdfSignatureAnchor {
	const points = [
		[matrix[4], matrix[5]],
		[matrix[0] + matrix[4], matrix[1] + matrix[5]],
		[matrix[2] + matrix[4], matrix[3] + matrix[5]],
		[matrix[0] + matrix[2] + matrix[4], matrix[1] + matrix[3] + matrix[5]],
	];
	const xs = points.map(([x]) => x ?? 0);
	const ys = points.map(([, y]) => y ?? 0);
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return {
		page,
		x,
		y,
		width: Math.max(...xs) - x,
		height: Math.max(...ys) - y,
	};
}

function resolveOperatorImage(
	page: unknown,
	value: unknown,
): PdfJsImage | null {
	const inline = asPdfJsImage(value);
	if (inline) return inline;
	if (typeof value !== "string" || typeof page !== "object" || page === null) {
		return null;
	}
	const objects = (page as { objs?: unknown }).objs;
	if (typeof objects !== "object" || objects === null) return null;
	const get = (objects as { get?: unknown }).get;
	if (typeof get !== "function") return null;
	try {
		return asPdfJsImage(get.call(objects, value));
	} catch {
		return null;
	}
}

export async function findContractPdfSignatureAnchors(
	pdf: Buffer,
): Promise<ContractPdfSignatureAnchors> {
	const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
	const loadingTask = getDocument({
		data: Uint8Array.from(pdf),
		useSystemFonts: false,
	});
	const document = await loadingTask.promise;
	const found: Record<
		ContractSignatureAnchorRole,
		ContractPdfSignatureAnchor[]
	> = {
		partner: [],
		board: [],
	};
	try {
		for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
			const page = await document.getPage(pageNumber);
			const operators = await page.getOperatorList();
			let matrix: Matrix = [1, 0, 0, 1, 0, 0];
			const stack: Matrix[] = [];
			for (let index = 0; index < operators.fnArray.length; index++) {
				const operation = operators.fnArray[index];
				const args = operators.argsArray[index] ?? [];
				if (operation === OPS.save) {
					stack.push([...matrix]);
				} else if (operation === OPS.restore) {
					matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0];
				} else if (operation === OPS.transform) {
					const next = asMatrix(args);
					if (next) matrix = multiply(matrix, next);
				} else if (
					operation === OPS.paintImageXObject ||
					operation === OPS.paintInlineImageXObject
				) {
					const image =
						resolveOperatorImage(page, args[0]) ??
						(typeof args[1] === "number" && typeof args[2] === "number"
							? { width: args[1], height: args[2] }
							: null);
					if (!image) continue;
					const role = identifyAnchorImage(image);
					if (role) found[role].push(boxFromMatrix(matrix, pageNumber));
				}
			}
		}
	} finally {
		await loadingTask.destroy();
	}
	for (const role of ["partner", "board"] as const) {
		if (found[role].length !== 1) {
			throw new ValidationError(
				`PDF must contain exactly one ${role} signature anchor`,
				{
					code: "PDF_SIGNATURE_ANCHOR_COUNT_INVALID",
					role,
					count: found[role].length,
				},
			);
		}
	}
	const partner = found.partner[0];
	const board = found.board[0];
	if (!partner || !board) {
		throw new ValidationError("PDF signature anchors are missing");
	}
	return { partner, board };
}

export function assertValidContractSignaturePng(signature: Buffer): void {
	if (
		signature.length < 24 ||
		!signature.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)
	) {
		throw new ValidationError("Signature must be a PNG image");
	}
	if (signature.length > MAX_SIGNATURE_BYTES) {
		throw new ValidationError("Signature image exceeds the size limit");
	}
	const width = signature.readUInt32BE(16);
	const height = signature.readUInt32BE(20);
	if (
		width === 0 ||
		height === 0 ||
		width > MAX_SIGNATURE_DIMENSION ||
		height > MAX_SIGNATURE_DIMENSION
	) {
		throw new ValidationError("Signature image dimensions are invalid");
	}
}

export function decodeContractSignatureDataUrl(value: string): Buffer {
	const match = PNG_DATA_URL.exec(value);
	if (!match?.[1]) {
		throw new ValidationError("Signature must be a PNG data URL");
	}
	const signature = Buffer.from(match[1], "base64");
	assertValidContractSignaturePng(signature);
	return signature;
}

export async function stampContractPdfSignature(args: {
	pdf: Buffer;
	signaturePng: Buffer;
	role: ContractSignatureAnchorRole;
	trustedAnchor?: ContractPdfSignatureAnchor;
}): Promise<{ pdf: Buffer; anchor: ContractPdfSignatureAnchor }> {
	assertValidContractSignaturePng(args.signaturePng);
	const anchor =
		args.trustedAnchor ??
		(await findContractPdfSignatureAnchors(args.pdf))[args.role];
	if (
		!Number.isInteger(anchor.page) ||
		anchor.page < 1 ||
		![anchor.x, anchor.y, anchor.width, anchor.height].every((value) =>
			Number.isFinite(value),
		) ||
		anchor.width <= 0 ||
		anchor.height <= 0
	) {
		throw new ValidationError("Trusted signature anchor is invalid");
	}
	const document = await PDFDocument.load(args.pdf, {
		ignoreEncryption: false,
		updateMetadata: false,
	});
	if (anchor.page > document.getPageCount()) {
		throw new ValidationError("Signature anchor page is missing");
	}
	const page = document.getPage(anchor.page - 1);
	const pageSize = page.getSize();
	if (
		anchor.x < 0 ||
		anchor.y < 0 ||
		anchor.x + anchor.width > pageSize.width ||
		anchor.y + anchor.height > pageSize.height
	) {
		throw new ValidationError(
			"Trusted signature anchor is outside the PDF page",
		);
	}
	const image = await document.embedPng(args.signaturePng);
	const scale = Math.min(
		anchor.width / image.width,
		anchor.height / image.height,
	);
	const width = image.width * scale;
	const height = image.height * scale;
	page.drawRectangle({
		x: anchor.x,
		y: anchor.y,
		width: anchor.width,
		height: anchor.height,
		color: rgb(1, 1, 1),
	});
	page.drawImage(image, {
		x: anchor.x + (anchor.width - width) / 2,
		y: anchor.y + (anchor.height - height) / 2,
		width,
		height,
	});
	return {
		pdf: Buffer.from(await document.save()),
		anchor,
	};
}
