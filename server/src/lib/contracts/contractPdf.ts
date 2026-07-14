import type { FastifyReply } from "fastify";
import { stripDataUrlPrefix } from "../receiptProcessing.js";
import type { PdfSignatureImage } from "../simplePdf.js";
import { buildFinalPdfText, textFromSubmission } from "./contractRecords.js";
import { fetchDocumentVersion } from "./contractRepository.js";

export async function getPdfTextForSubmission(
	submission: Record<string, unknown>,
): Promise<string> {
	const versionId =
		submission.status === "completed"
			? submission.final_document_version_id
			: (submission.active_document_version_id ??
				submission.sent_document_version_id);
	const version = await fetchDocumentVersion(versionId);
	if (typeof version?.rendered_text === "string") return version.rendered_text;
	if (submission.status === "completed") return buildFinalPdfText(submission);
	return textFromSubmission(submission);
}

export function buildSignatureImages(
	submission: Record<string, unknown>,
): PdfSignatureImage[] {
	const images: PdfSignatureImage[] = [];
	const toPng = (value: unknown): Buffer | null => {
		if (typeof value !== "string" || !value.trim()) return null;
		try {
			return Buffer.from(stripDataUrlPrefix(value), "base64");
		} catch {
			return null;
		}
	};
	const formatDate = (value: unknown): string | undefined =>
		typeof value === "string" && value.trim()
			? new Date(value).toLocaleString()
			: undefined;

	const partnerPng = toPng(submission.signature_data);
	if (partnerPng) {
		const name =
			typeof submission.signer_name === "string" ? submission.signer_name : "";
		images.push({
			role: "partner",
			label: `Partner: ${name || "-"}`,
			sublabel: formatDate(submission.signed_at),
			png: partnerPng,
		});
	}
	const boardPng = toPng(submission.admin_signature_data);
	if (boardPng) {
		const name =
			typeof submission.admin_signer_name === "string"
				? submission.admin_signer_name
				: "";
		images.push({
			role: "board",
			label: `TUM.ai / Board: ${name || "-"}`,
			sublabel: formatDate(submission.admin_signed_at),
			png: boardPng,
		});
	}
	return images;
}

export function sendPdf(
	reply: FastifyReply,
	pdf: Buffer,
	filename: string,
	disposition: "attachment" | "inline",
) {
	return reply
		.header("Content-Type", "application/pdf")
		.header("Content-Disposition", `${disposition}; filename="${filename}"`)
		.send(pdf);
}
