import { randomUUID } from "node:crypto";
import { Sandbox } from "@vercel/sandbox";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
	BadGatewayError,
	ServiceUnavailableError,
	ValidationError,
} from "../errors.js";

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const SANDBOX_TIMEOUT_MS = 90_000;

function isImmutableSandboxImage(value: string): boolean {
	const digestIndex = value.lastIndexOf("@sha256:");
	if (
		digestIndex <= 0 ||
		!/^@sha256:[a-f0-9]{64}$/i.test(value.slice(digestIndex))
	) {
		return false;
	}
	const imageName = value.slice(value.lastIndexOf("/") + 1, digestIndex);
	return imageName.length > 0 && !imageName.includes(":");
}

interface SandboxCommandResult {
	exitCode: number;
}

export interface ContractConverterSandbox {
	writeFiles(
		files: Array<{ path: string; content: Uint8Array }>,
	): Promise<unknown>;
	runCommand(
		command: string,
		args?: string[],
		options?: { timeoutMs?: number },
	): Promise<SandboxCommandResult>;
	readFileToBuffer(file: { path: string }): Promise<Buffer | null>;
	stop(): Promise<unknown>;
}

export type ContractConverterSandboxFactory =
	() => Promise<ContractConverterSandbox>;

function assertPdf(value: Buffer): void {
	if (
		value.length === 0 ||
		!value.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)
	) {
		throw new BadGatewayError("LibreOffice did not produce a valid PDF");
	}
	if (value.length > MAX_PDF_BYTES) {
		throw new BadGatewayError("Converted PDF exceeds the safe size limit");
	}
}

async function fakePdf(): Promise<Buffer> {
	const pdf = await PDFDocument.create();
	const fixedDate = new Date("2026-01-01T00:00:00.000Z");
	pdf.setCreationDate(fixedDate);
	pdf.setModificationDate(fixedDate);
	pdf.setCreator("member-manager-test");
	pdf.setProducer("member-manager-test");
	pdf.setTitle("Contract converter fake output");
	const page = pdf.addPage([595, 842]);
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const { CONTRACT_SIGNATURE_SENTINELS } = await import("./contractDocx.js");
	const partner = await pdf.embedPng(CONTRACT_SIGNATURE_SENTINELS.partner.png);
	const board = await pdf.embedPng(CONTRACT_SIGNATURE_SENTINELS.board.png);
	page.drawText("Contract DOCX converter fake output", {
		x: 72,
		y: 770,
		size: 12,
		font,
	});
	page.drawImage(partner, { x: 72, y: 590, width: 168, height: 60 });
	page.drawImage(board, { x: 355, y: 590, width: 168, height: 60 });
	return Buffer.from(await pdf.save());
}

async function createVercelSandbox(): Promise<ContractConverterSandbox> {
	const snapshotId =
		process.env.CONTRACT_LIBREOFFICE_SANDBOX_SNAPSHOT_ID?.trim();
	const image = process.env.CONTRACT_LIBREOFFICE_SANDBOX_IMAGE?.trim();
	if (!snapshotId && !image) {
		throw new ServiceUnavailableError(
			"Contract LibreOffice Sandbox image is not configured",
		);
	}
	if (image && !isImmutableSandboxImage(image)) {
		throw new ServiceUnavailableError(
			"Contract LibreOffice Sandbox image must use an immutable digest without a tag",
		);
	}
	const common = {
		timeout: SANDBOX_TIMEOUT_MS,
		persistent: false,
		networkPolicy: "deny-all" as const,
		resources: { vcpus: 2 },
		tags: { workload: "contract-render" },
	};
	return snapshotId
		? Sandbox.create({
				...common,
				source: { type: "snapshot", snapshotId },
			})
		: Sandbox.create({ ...common, image });
}

export function getContractConverterVersion(): string {
	if (process.env.CONTRACT_DOCX_CONVERTER_MODE?.trim() === "fake") {
		if (process.env.NODE_ENV === "production") {
			throw new ServiceUnavailableError(
				"Fake contract conversion is forbidden in production",
			);
		}
		return "fake-anchored-v1";
	}
	const snapshotId =
		process.env.CONTRACT_LIBREOFFICE_SANDBOX_SNAPSHOT_ID?.trim();
	if (snapshotId) return `vercel-snapshot:${snapshotId}`;
	const image = process.env.CONTRACT_LIBREOFFICE_SANDBOX_IMAGE?.trim();
	if (image) {
		if (isImmutableSandboxImage(image)) return image;
		throw new ServiceUnavailableError(
			"Contract LibreOffice Sandbox image must use an immutable digest without a tag",
		);
	}
	throw new ServiceUnavailableError(
		"Contract LibreOffice Sandbox image is not configured",
	);
}

export async function convertContractDocxToPdf(
	docx: Buffer,
	options: { sandboxFactory?: ContractConverterSandboxFactory } = {},
): Promise<Buffer> {
	if (docx.length === 0) throw new ValidationError("DOCX is empty");
	const mode = process.env.CONTRACT_DOCX_CONVERTER_MODE?.trim();
	if (mode === "fake") {
		if (process.env.NODE_ENV === "production") {
			throw new ServiceUnavailableError(
				"Fake contract conversion is forbidden in production",
			);
		}
		return fakePdf();
	}
	if (mode && mode !== "sandbox") {
		throw new ServiceUnavailableError("Unsupported contract converter mode");
	}

	const sandbox = await (options.sandboxFactory ?? createVercelSandbox)();
	const workId = randomUUID();
	const inputPath = `/tmp/contract-${workId}.docx`;
	const outputPath = `/tmp/contract-${workId}.pdf`;
	try {
		await sandbox.writeFiles([{ path: inputPath, content: docx }]);
		const command = await sandbox.runCommand(
			"libreoffice",
			[
				"--headless",
				"--nologo",
				"--nodefault",
				"--nofirststartwizard",
				"--norestore",
				"--convert-to",
				"pdf",
				"--outdir",
				"/tmp",
				inputPath,
			],
			{ timeoutMs: SANDBOX_TIMEOUT_MS - 10_000 },
		);
		if (command.exitCode !== 0) {
			throw new BadGatewayError("LibreOffice conversion failed");
		}
		const output = await sandbox.readFileToBuffer({ path: outputPath });
		if (!output) throw new BadGatewayError("LibreOffice PDF output is missing");
		assertPdf(output);
		return output;
	} finally {
		try {
			await sandbox.stop();
		} catch {
			// The render result or original failure is authoritative. Sandboxes are
			// non-persistent and also expire at their hard timeout.
		}
	}
}
