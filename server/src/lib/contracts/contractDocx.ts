import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import {
	CONTRACT_DOCX_MIME_TYPE,
	MAX_CONTRACT_DOCX_BYTES,
} from "@member-manager/shared";
import { createReport, listCommands } from "docx-templates";
import JSZip from "jszip";
import { ValidationError } from "../errors.js";

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const MAX_DOCX_ENTRIES = 1_000;
const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_EXPANSION_RATIO = 100;
const COMMAND_DELIMITER: [string, string] = ["{{", "}}"];
const VARIABLE_NAME = /^[a-zA-Z][a-zA-Z0-9_]{0,79}$/;
const DETERMINISTIC_ZIP_DATE = new Date("2000-01-01T00:00:00.000Z");

export const PARTNER_SIGNATURE_ANCHOR = "partner_signature_anchor";
export const BOARD_SIGNATURE_ANCHOR = "board_signature_anchor";

export type ContractSignatureAnchorRole = "partner" | "board";

export interface ContractDocxManifest {
	variables: string[];
	signatureAnchors: ["partner", "board"];
	entryCount: number;
	uncompressedBytes: number;
}

export interface FilledContractDocxManifest {
	signatureAnchors: ["partner", "board"];
	entryCount: number;
	uncompressedBytes: number;
}

function validationError(code: string, message: string): ValidationError {
	return new ValidationError(message, { code });
}

function toArrayBuffer(value: Buffer): ArrayBuffer {
	return Uint8Array.from(value).buffer;
}

function crc32(value: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of value) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
	const typeBytes = Buffer.from(type, "ascii");
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const checksum = Buffer.alloc(4);
	checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
	return Buffer.concat([length, typeBytes, data, checksum]);
}

function createSentinelPng(
	width: number,
	height: number,
	color: readonly [number, number, number],
): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 6;
	const scanlines: Buffer[] = [];
	for (let y = 0; y < height; y++) {
		const row = Buffer.alloc(1 + width * 4);
		for (let x = 0; x < width; x++) {
			const offset = 1 + x * 4;
			row[offset] = color[0];
			row[offset + 1] = color[1];
			row[offset + 2] = color[2];
			row[offset + 3] = (x + y) % 7 === 0 ? 8 : 6;
		}
		scanlines.push(row);
	}
	return Buffer.concat([
		Buffer.from("89504e470d0a1a0a", "hex"),
		pngChunk("IHDR", header),
		pngChunk("IDAT", deflateSync(Buffer.concat(scanlines), { level: 9 })),
		pngChunk("IEND", Buffer.alloc(0)),
	]);
}

export const CONTRACT_SIGNATURE_SENTINELS = {
	partner: {
		widthPixels: 61,
		heightPixels: 19,
		color: [17, 203, 91] as const,
		png: createSentinelPng(61, 19, [17, 203, 91]),
	},
	board: {
		widthPixels: 67,
		heightPixels: 23,
		color: [229, 37, 153] as const,
		png: createSentinelPng(67, 23, [229, 37, 153]),
	},
} as const;

function assertBasicDocx(buffer: Buffer): void {
	if (buffer.length === 0) throw validationError("DOCX_EMPTY", "DOCX is empty");
	if (buffer.length > MAX_CONTRACT_DOCX_BYTES) {
		throw validationError("DOCX_TOO_LARGE", "DOCX exceeds the size limit");
	}
	if (!buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) {
		throw validationError("DOCX_INVALID_MAGIC", "File is not a DOCX package");
	}
}

function isUnsafeEntryName(name: string): boolean {
	return (
		name.startsWith("/") ||
		name.includes("\\") ||
		name.split("/").some((part) => part === ".." || part === ".")
	);
}

function xmlAttribute(tag: string, name: string): string | null {
	const match = tag.match(
		new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"),
	);
	return match?.[1] ?? null;
}

function assertSafeRelationships(xml: string): void {
	for (const match of xml.matchAll(/<Relationship\b[^>]*>/gi)) {
		const tag = match[0];
		if (!/\bTargetMode\s*=\s*["']External["']/i.test(tag)) continue;
		const type = xmlAttribute(tag, "Type");
		const target = xmlAttribute(tag, "Target");
		if (
			type?.toLowerCase().endsWith("/hyperlink") !== true ||
			target === null ||
			!/^(?:https?:|mailto:)/i.test(target)
		) {
			throw validationError(
				"DOCX_EXTERNAL_RELATIONSHIP_FORBIDDEN",
				"DOCX contains an unsafe external relationship",
			);
		}
	}
}

async function loadAndValidatePackage(buffer: Buffer): Promise<{
	zip: JSZip;
	uncompressedBytes: number;
}> {
	assertBasicDocx(buffer);
	let zip: JSZip;
	try {
		zip = await JSZip.loadAsync(buffer, {
			checkCRC32: true,
			createFolders: false,
		});
	} catch {
		throw validationError("DOCX_INVALID_ZIP", "DOCX package is corrupt");
	}
	const entries = Object.values(zip.files);
	if (entries.length > MAX_DOCX_ENTRIES) {
		throw validationError(
			"DOCX_TOO_MANY_ENTRIES",
			"DOCX contains too many files",
		);
	}
	if (!zip.file("[Content_Types].xml") || !zip.file("word/document.xml")) {
		throw validationError(
			"DOCX_REQUIRED_PART_MISSING",
			"DOCX is missing required Word document parts",
		);
	}
	let uncompressedBytes = 0;
	for (const entry of entries) {
		if (isUnsafeEntryName(entry.name)) {
			throw validationError("DOCX_UNSAFE_PATH", "DOCX contains an unsafe path");
		}
		const normalized = entry.name.toLowerCase();
		if (
			normalized.endsWith("vbaproject.bin") ||
			normalized.startsWith("word/embeddings/") ||
			normalized.includes("/activex/") ||
			normalized.includes("altchunk")
		) {
			throw validationError(
				"DOCX_ACTIVE_CONTENT_FORBIDDEN",
				"DOCX contains active or embedded content",
			);
		}
		if (entry.dir) continue;
		const value = await entry.async("uint8array");
		uncompressedBytes += value.byteLength;
		if (uncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
			throw validationError(
				"DOCX_UNCOMPRESSED_TOO_LARGE",
				"DOCX expands beyond the safe limit",
			);
		}
	}
	if (
		buffer.length > 0 &&
		uncompressedBytes / buffer.length > MAX_EXPANSION_RATIO
	) {
		throw validationError(
			"DOCX_EXPANSION_RATIO_TOO_HIGH",
			"DOCX compression ratio exceeds the safe limit",
		);
	}
	for (const entry of entries) {
		if (entry.dir || !entry.name.toLowerCase().endsWith(".rels")) continue;
		const xml = await entry.async("string");
		assertSafeRelationships(xml);
	}
	for (const entry of entries) {
		if (
			entry.dir ||
			!entry.name.toLowerCase().startsWith("word/") ||
			!entry.name.toLowerCase().endsWith(".xml")
		) {
			continue;
		}
		const xml = await entry.async("string");
		if (
			/<w:altChunk\b|DDEAUTO|DDE\s|INCLUDEPICTURE\b|INCLUDETEXT\b|LINK\b|MACROBUTTON\b/i.test(
				xml,
			)
		) {
			throw validationError(
				"DOCX_ACTIVE_CONTENT_FORBIDDEN",
				"DOCX contains active document content",
			);
		}
	}
	return { zip, uncompressedBytes };
}

function decodeXmlText(value: string): string {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&");
}

async function assertBalancedTemplateDelimiters(zip: JSZip): Promise<void> {
	for (const entry of Object.values(zip.files)) {
		if (
			entry.dir ||
			!/^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i.test(
				entry.name,
			)
		) {
			continue;
		}
		const xml = await entry.async("string");
		const text = [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi)]
			.map((match) => decodeXmlText(match[1] ?? ""))
			.join("");
		let depth = 0;
		for (let index = 0; index < text.length; index++) {
			if (text.startsWith("{{", index)) {
				if (depth !== 0) {
					throw validationError(
						"DOCX_TEMPLATE_DELIMITER_INVALID",
						"DOCX contains nested or unmatched template delimiters",
					);
				}
				depth = 1;
				index++;
			} else if (text.startsWith("}}", index)) {
				if (depth !== 1) {
					throw validationError(
						"DOCX_TEMPLATE_DELIMITER_INVALID",
						"DOCX contains nested or unmatched template delimiters",
					);
				}
				depth = 0;
				index++;
			}
		}
		if (depth !== 0) {
			throw validationError(
				"DOCX_TEMPLATE_DELIMITER_INVALID",
				"DOCX contains an unmatched template delimiter",
			);
		}
	}
}

function normalizeCommandCode(value: string): string {
	return value
		.trim()
		.replace(/^=\s*/, "")
		.replace(/^INS\s+/i, "")
		.trim();
}

export async function inspectContractDocx(
	buffer: Buffer,
	allowedVariableNames?: ReadonlySet<string>,
	requiredVariableNames: ReadonlySet<string> = new Set(),
): Promise<ContractDocxManifest> {
	const { zip, uncompressedBytes } = await loadAndValidatePackage(buffer);
	await assertBalancedTemplateDelimiters(zip);
	if (
		allowedVariableNames &&
		[...requiredVariableNames].some((name) => !allowedVariableNames.has(name))
	) {
		throw validationError(
			"DOCX_REQUIRED_VARIABLE_UNKNOWN",
			"Required DOCX variables must be part of the allowed variable set",
		);
	}
	let commands: Awaited<ReturnType<typeof listCommands>>;
	try {
		commands = await listCommands(toArrayBuffer(buffer), COMMAND_DELIMITER);
	} catch {
		throw validationError(
			"DOCX_TEMPLATE_COMMAND_INVALID",
			"DOCX template commands could not be parsed",
		);
	}
	const variables = new Set<string>();
	const anchorCounts = { partner: 0, board: 0 };
	for (const command of commands) {
		const code = normalizeCommandCode(command.code);
		if (command.type === "INS" && VARIABLE_NAME.test(code)) {
			if (allowedVariableNames && !allowedVariableNames.has(code)) {
				throw validationError(
					"DOCX_UNKNOWN_VARIABLE",
					`DOCX references unknown variable ${code}`,
				);
			}
			variables.add(code);
			continue;
		}
		if (command.type === "IMAGE" && code === PARTNER_SIGNATURE_ANCHOR) {
			anchorCounts.partner++;
			continue;
		}
		if (command.type === "IMAGE" && code === BOARD_SIGNATURE_ANCHOR) {
			anchorCounts.board++;
			continue;
		}
		throw validationError(
			"DOCX_TEMPLATE_COMMAND_FORBIDDEN",
			"DOCX contains a command outside the contract allowlist",
		);
	}
	if (anchorCounts.partner !== 1 || anchorCounts.board !== 1) {
		throw validationError(
			"DOCX_SIGNATURE_ANCHORS_INVALID",
			"DOCX must contain exactly one partner and one board signature anchor",
		);
	}
	const missingRequired = [...requiredVariableNames].filter(
		(name) => !variables.has(name),
	);
	if (missingRequired.length > 0) {
		throw validationError(
			"DOCX_REQUIRED_VARIABLE_MISSING",
			`DOCX does not use required variables: ${missingRequired.sort().join(", ")}`,
		);
	}
	return {
		variables: [...variables].sort(),
		signatureAnchors: ["partner", "board"],
		entryCount: Object.keys(zip.files).length,
		uncompressedBytes,
	};
}

export async function inspectFilledContractDocx(
	buffer: Buffer,
): Promise<FilledContractDocxManifest> {
	const { zip, uncompressedBytes } = await loadAndValidatePackage(buffer);
	await assertBalancedTemplateDelimiters(zip);
	let remainingCommands: Awaited<ReturnType<typeof listCommands>>;
	try {
		remainingCommands = await listCommands(
			toArrayBuffer(buffer),
			COMMAND_DELIMITER,
		);
	} catch {
		throw validationError(
			"DOCX_TEMPLATE_COMMAND_INVALID",
			"Filled DOCX contains an invalid template command",
		);
	}
	if (remainingCommands.length > 0) {
		throw validationError(
			"DOCX_TEMPLATE_COMMAND_REMAINS",
			"Filled DOCX must not contain template commands",
		);
	}
	const relationshipXml = (
		await Promise.all(
			Object.values(zip.files)
				.filter((entry) => !entry.dir && entry.name.endsWith(".rels"))
				.map((entry) => entry.async("string")),
		)
	).join("\n");
	for (const role of ["partner", "board"] as const) {
		const sentinel = CONTRACT_SIGNATURE_SENTINELS[role].png;
		const matches: string[] = [];
		for (const entry of Object.values(zip.files)) {
			if (entry.dir || !entry.name.startsWith("word/media/")) continue;
			const bytes = Buffer.from(await entry.async("uint8array"));
			if (bytes.equals(sentinel)) matches.push(entry.name);
		}
		if (matches.length !== 1) {
			throw validationError(
				"DOCX_SIGNATURE_SENTINELS_INVALID",
				"Filled DOCX must contain exactly one image for each signature anchor",
			);
		}
		const filename = matches[0]?.split("/").at(-1);
		const relationshipUses = filename
			? [
					...relationshipXml.matchAll(/\bTarget\s*=\s*["']([^"']+)["']/gi),
				].filter((match) => match[1]?.split("/").at(-1) === filename).length
			: 0;
		if (relationshipUses !== 1) {
			throw validationError(
				"DOCX_SIGNATURE_SENTINEL_PLACEMENT_INVALID",
				"Each signature anchor image must be placed exactly once",
			);
		}
	}
	return {
		signatureAnchors: ["partner", "board"],
		entryCount: Object.keys(zip.files).length,
		uncompressedBytes,
	};
}

function stringifyDocxValue(value: unknown, variable: string): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (Array.isArray(value)) {
		return value.map((entry) => stringifyDocxValue(entry, variable)).join(", ");
	}
	throw validationError(
		"DOCX_VARIABLE_VALUE_INVALID",
		`Variable ${variable} cannot be inserted into a DOCX template`,
	);
}

function sentinelImage(role: ContractSignatureAnchorRole) {
	const sentinel = CONTRACT_SIGNATURE_SENTINELS[role];
	return {
		width: 4.2,
		height: 1.5,
		data: sentinel.png.toString("base64"),
		extension: ".png" as const,
		alt: `tumai-${role}-signature-anchor`,
	};
}

async function normalizeDocxZip(value: Uint8Array): Promise<Buffer> {
	const source = await JSZip.loadAsync(value);
	const normalized = new JSZip();
	for (const entry of Object.values(source.files).sort((left, right) =>
		left.name.localeCompare(right.name),
	)) {
		if (entry.dir) continue;
		normalized.file(entry.name, await entry.async("uint8array"), {
			binary: true,
			createFolders: false,
			date: DETERMINISTIC_ZIP_DATE,
		});
	}
	return normalized.generateAsync({
		type: "nodebuffer",
		compression: "DEFLATE",
		compressionOptions: { level: 6 },
	});
}

export async function fillContractDocx(args: {
	template: Buffer;
	formData: Record<string, unknown>;
	allowedVariableNames?: ReadonlySet<string>;
	requiredVariableNames?: ReadonlySet<string>;
}): Promise<{ docx: Buffer; manifest: ContractDocxManifest }> {
	const manifest = await inspectContractDocx(
		args.template,
		args.allowedVariableNames,
		args.requiredVariableNames,
	);
	const data: Record<string, string> = {};
	for (const variable of manifest.variables) {
		data[variable] = stringifyDocxValue(args.formData[variable], variable);
	}
	let report: Uint8Array;
	try {
		report = await createReport({
			template: args.template,
			data,
			cmdDelimiter: COMMAND_DELIMITER,
			literalXmlDelimiter: `__disabled_literal_xml_${randomUUID()}__`,
			additionalJsContext: {
				[PARTNER_SIGNATURE_ANCHOR]: sentinelImage("partner"),
				[BOARD_SIGNATURE_ANCHOR]: sentinelImage("board"),
			},
			noSandbox: false,
			failFast: true,
			rejectNullish: true,
			maximumWalkingDepth: 10_000,
			processLineBreaks: true,
			processLineBreaksAsNewText: true,
		});
	} catch {
		throw validationError(
			"DOCX_TEMPLATE_RENDER_FAILED",
			"DOCX template could not be filled",
		);
	}
	return { docx: await normalizeDocxZip(report), manifest };
}

export function assertContractDocxMimeType(value: string): void {
	if (value !== CONTRACT_DOCX_MIME_TYPE) {
		throw validationError(
			"DOCX_MIME_TYPE_INVALID",
			"Upload must be a DOCX file",
		);
	}
}
