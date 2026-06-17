import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { enrichContractFormData } from "@member-manager/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { checkAdminRole } from "../lib/auth.js";
import { getAuthEmail } from "../lib/authEmails.js";
import {
	isContractEmailConfigured,
	sendContractClarificationEmail,
	sendContractPartnerEmail,
} from "../lib/contractEmails.js";
import { DatabaseError } from "../lib/errors.js";
import { isOpenSignConfigured, sendOpenSignDocument } from "../lib/openSign.js";
import { createTextPdf } from "../lib/simplePdf.js";
import { getSupabase } from "../lib/supabase.js";
import {
	authenticate,
	requireBoardMember,
	requireContractsAdmin,
} from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

// =========================================================================
// Types & schemas
// =========================================================================

const DATA_TYPES = [
	"TEXT",
	"TEXTAREA",
	"NUMBER",
	"DATE",
	"BOOLEAN",
	"SELECT",
	"FILE",
] as const;

const CONDITION_TYPES = ["ALWAYS", "IF_YES", "IF_NO", "IF_VALUE"] as const;

const SUBMISSION_STATUSES = [
	"draft",
	"submitted",
	"legal_review",
	"in_review",
	"approved",
	"sent_to_partner",
	"partner_comments",
	"partner_signed",
	"board_signed",
	"rejected",
	"inquiry",
	"signed",
	"completed",
] as const;

const REVIEW_STATUSES = [
	"draft",
	"submitted",
	"legal_review",
	"in_review",
	"approved",
	"rejected",
	"inquiry",
	"signed",
	"completed",
] as const;

type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

const TemplateBodySchema = z.object({
	name: z.string().trim().min(1).max(200),
	description: z.string().trim().max(2000).nullable().optional(),
	contract_text: z.string().max(200_000).default(""),
	is_active: z.boolean().optional().default(true),
});

const VariableBodySchema = z.object({
	variable_name: z
		.string()
		.trim()
		.regex(
			/^[a-zA-Z][a-zA-Z0-9_]*$/,
			"Variable name must be alphanumeric/underscore",
		)
		.max(80),
	label: z.string().trim().min(1).max(200),
	data_type: z.enum(DATA_TYPES).default("TEXT"),
	help_text: z.string().trim().max(1000).nullable().optional(),
	options: z.unknown().nullable().optional(),
	is_required: z.boolean().optional().default(false),
	is_multiselect: z.boolean().optional().default(false),
	show_if_variable: z.string().trim().max(80).nullable().optional(),
	show_if_value: z.string().trim().max(200).nullable().optional(),
	sort_order: z.number().int().min(0).max(10_000).optional().default(0),
});

const ConditionalBlockBodySchema = z.object({
	name: z.string().trim().min(1).max(200),
	condition_type: z.enum(CONDITION_TYPES).default("ALWAYS"),
	condition_variable: z.string().trim().max(80).nullable().optional(),
	condition_value: z.string().trim().max(500).nullable().optional(),
	block_text: z.string().max(50_000).default(""),
	sort_order: z.number().int().min(0).max(10_000).optional().default(0),
});

const SubmissionBodySchema = z.object({
	template_id: z.string().uuid(),
	form_data: z.record(z.string(), z.unknown()),
	status: z.enum(["draft", "submitted"]).optional().default("submitted"),
});

const DraftSubmissionPatchSchema = z.object({
	form_data: z.record(z.string(), z.unknown()),
	status: z.enum(["draft", "submitted"]).optional().default("draft"),
});

const PreviewBodySchema = z.object({
	form_data: z.record(z.string(), z.unknown()),
});

const TextPreviewBodySchema = z.object({
	contract_text: z.string().max(250_000),
});

const PdfDownloadQuerySchema = z.object({
	download: z.string().optional(),
});

const SubmissionPatchSchema = z
	.object({
		status: z.enum(REVIEW_STATUSES).optional(),
		admin_edited_text: z.string().max(200_000).nullable().optional(),
		notes: z.string().max(5000).nullable().optional(),
		feedback_message: z.string().max(5000).nullable().optional(),
		generate_signature_token: z.boolean().optional(),
		send_to_partner: z.boolean().optional(),
		send_partner_email: z.boolean().optional(),
		send_opensign: z.boolean().optional(),
		partner_email_subject: z.string().trim().max(300).nullable().optional(),
		partner_email_message: z.string().trim().max(5000).nullable().optional(),
		signature_token_ttl_hours: z.number().int().min(1).max(720).optional(),
	})
	.refine(
		(value) =>
			value.status !== undefined ||
			value.admin_edited_text !== undefined ||
			value.notes !== undefined ||
			value.feedback_message !== undefined ||
			value.generate_signature_token === true ||
			value.send_to_partner === true ||
			value.send_partner_email === true ||
			value.send_opensign === true,
		{ message: "No-op patch" },
	);

const SignBodySchema = z.object({
	signature_data: z.string().min(1).max(2_000_000),
	signer_name: z.string().trim().min(1).max(200),
});

const CommentBodySchema = z.object({
	comment: z.string().trim().min(1).max(5000),
});

const OpenSignWebhookSchema = z
	.object({
		event: z.string().trim().max(100).optional(),
		type: z.string().trim().max(100).optional(),
		objectId: z.string().trim().max(200).optional(),
		file: z.string().trim().max(4000).optional(),
		certificate: z.string().trim().max(4000).optional(),
		certificateUrl: z.string().trim().max(4000).optional(),
	})
	.passthrough();

// =========================================================================
// Contract text renderer (ported & simplified from contract-generator)
// Supports: {{variable}} substitution, [IF {{var}} OP "value" THEN {..}
// ELSE {..}] inline conditionals, and appending DB conditional blocks.
// German keywords are still accepted for templates ported from the old tool.
// =========================================================================

const VARIABLE_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;
// The THEN/ELSE block bodies allow plain text plus {{variable}} interpolations.
// Both alternatives are disjoint on their first character ([^{}] never matches
// "{", the interpolation branch always starts with "{"), and the interpolation
// branch is fully bounded ({{word}}), so the outer "*" has no ambiguous nesting
// and matching stays linear — no polynomial-ReDoS backtracking even on hostile,
// schema-sized input.
const CONDITIONAL_REGEX =
	/\[(?:WENN|IF)\s+\{\{([a-zA-Z0-9_]+)\}\}\s*(=|!=|enthält|contains)\s*"([^"]*)"\s+(?:DANN|THEN)\s+\{((?:[^{}]|\{\{[a-zA-Z0-9_]+\}\})*)\}(?:\s+(?:SONST|ELSE)\s+\{((?:[^{}]|\{\{[a-zA-Z0-9_]+\}\})*)\})?\]/gi;

function stringifyVariable(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (Array.isArray(value)) return value.map(stringifyVariable).join(", ");
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function evaluateCondition(
	rawValue: unknown,
	operator: string,
	expected: string,
): boolean {
	const actual = stringifyVariable(rawValue).trim();
	const target = expected.trim();
	switch (operator.toLowerCase()) {
		case "=":
			return actual === target;
		case "!=":
			return actual !== target;
		case "enthält":
		case "contains":
			return actual.toLowerCase().includes(target.toLowerCase());
		default:
			return false;
	}
}

function applyInlineConditionals(
	text: string,
	formData: Record<string, unknown>,
): string {
	return text.replace(
		CONDITIONAL_REGEX,
		(_full, variable, op, expected, thenText, elseText) => {
			const matched = evaluateCondition(formData[variable], op, expected);
			return matched ? thenText : (elseText ?? "");
		},
	);
}

function substituteVariables(
	text: string,
	formData: Record<string, unknown>,
): string {
	return text.replace(VARIABLE_REGEX, (_full, name) =>
		stringifyVariable(formData[name]),
	);
}

interface ConditionalBlockRow {
	condition_type: (typeof CONDITION_TYPES)[number];
	condition_variable: string | null;
	condition_value: string | null;
	block_text: string;
	sort_order: number;
}

function blockMatches(
	block: ConditionalBlockRow,
	formData: Record<string, unknown>,
): boolean {
	if (block.condition_type === "ALWAYS") return true;
	const variable = block.condition_variable;
	if (!variable) return false;
	const raw = formData[variable];
	const asString = stringifyVariable(raw).trim();
	const normalized = asString.toLowerCase();
	switch (block.condition_type) {
		case "IF_YES":
			return (
				raw === true ||
				normalized === "yes" ||
				normalized === "ja" ||
				normalized === "true"
			);
		case "IF_NO":
			return (
				raw === false ||
				normalized === "no" ||
				normalized === "nein" ||
				normalized === "false" ||
				asString === ""
			);
		case "IF_VALUE":
			return asString === (block.condition_value ?? "").trim();
		default:
			return false;
	}
}

export function renderContractText(
	contractText: string,
	formData: Record<string, unknown>,
	blocks: ConditionalBlockRow[],
): string {
	const matchingBlocks = blocks
		.filter((block) => blockMatches(block, formData))
		.sort((a, b) => a.sort_order - b.sort_order)
		.map((block) => block.block_text)
		.filter((text) => text.trim().length > 0);

	const combined =
		matchingBlocks.length > 0
			? `${contractText}\n\n${matchingBlocks.join("\n\n")}`
			: contractText;

	const afterConditionals = applyInlineConditionals(combined, formData);
	return substituteVariables(afterConditionals, formData);
}

interface RenderedContractDocument {
	text: string;
	html: string;
	pages: string[];
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

const PREVIEW_MAX_CHARS_PER_LINE = 76;
const PREVIEW_MAX_LINES_PER_PAGE = 39;

type PreviewLineKind = "title" | "heading" | "paragraph" | "list" | "blank";

interface PreviewLine {
	kind: PreviewLineKind;
	text: string;
	itemStart?: boolean;
}

function wrapPreviewLine(line: string): string[] {
	const words = line.split(/\s+/).filter(Boolean);
	if (words.length === 0) return [""];
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (next.length > PREVIEW_MAX_CHARS_PER_LINE && current) {
			lines.push(current);
			current = word;
		} else {
			current = next;
		}
	}

	if (current) lines.push(current);
	return lines;
}

function isTitleParagraph(paragraph: string): boolean {
	return /^SPONSORINGVERTRAG$|^KOOPERATIONSVERTRAG$/i.test(paragraph.trim());
}

function isHeadingParagraph(paragraph: string): boolean {
	const trimmed = paragraph.trim();
	return /^§\s*\d+\s+/.test(trimmed) || /^[A-ZÄÖÜ][^\n]{1,70}$/.test(trimmed);
}

function isListParagraph(lines: string[]): boolean {
	return lines.length > 1 && lines.every((line) => /^[-•]/.test(line));
}

function paragraphToPreviewLines(paragraph: string): PreviewLine[] {
	const trimmed = paragraph.trim();
	if (!trimmed) return [];
	if (isTitleParagraph(trimmed)) {
		return wrapPreviewLine(trimmed).map((line) => ({
			kind: "title",
			text: line,
		}));
	}
	if (isHeadingParagraph(trimmed)) {
		return wrapPreviewLine(trimmed).map((line) => ({
			kind: "heading",
			text: line,
		}));
	}

	const lines = paragraph
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	if (isListParagraph(lines)) {
		return lines.flatMap((line) =>
			wrapPreviewLine(line.replace(/^[-•]\s*/, "")).map(
				(wrappedLine, index) => ({
					kind: "list",
					text: wrappedLine,
					itemStart: index === 0,
				}),
			),
		);
	}
	return lines.flatMap((line) =>
		wrapPreviewLine(line).map((wrappedLine) => ({
			kind: "paragraph",
			text: wrappedLine,
		})),
	);
}

function buildPreviewLines(text: string): PreviewLine[] {
	const paragraphs = text
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);

	const previewLines: PreviewLine[] = [];
	for (const paragraph of paragraphs.length > 0 ? paragraphs : [""]) {
		if (previewLines.length > 0) {
			previewLines.push({ kind: "blank", text: "" });
		}
		previewLines.push(...paragraphToPreviewLines(paragraph));
	}
	return previewLines;
}

function renderTextGroup(tag: "h1" | "h2" | "p", lines: PreviewLine[]): string {
	return `<${tag}>${lines.map((line) => escapeHtml(line.text)).join("<br>")}</${tag}>`;
}

function renderListGroup(lines: PreviewLine[]): string {
	const html: string[] = [];
	let items: string[] = [];
	let current: string[] = [];
	const flushItems = () => {
		if (items.length > 0) {
			html.push(`<ul>${items.join("")}</ul>`);
			items = [];
		}
	};

	for (const line of lines) {
		if (!line.itemStart && items.length === 0 && current.length === 0) {
			html.push(
				`<div class="list-continuation">${escapeHtml(line.text)}</div>`,
			);
			continue;
		}
		if (line.itemStart && current.length > 0) {
			items.push(`<li>${current.map(escapeHtml).join("<br>")}</li>`);
			current = [];
		}
		current.push(line.text);
	}
	if (current.length > 0) {
		items.push(`<li>${current.map(escapeHtml).join("<br>")}</li>`);
	}
	flushItems();
	return html.join("");
}

function renderBlankLine(): string {
	return '<div class="blank-line">&nbsp;</div>';
}

function pageLinesToHtml(lines: PreviewLine[]): string {
	const html: string[] = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		if (line.kind === "blank") {
			html.push(renderBlankLine());
			i++;
			continue;
		}
		const group: PreviewLine[] = [];
		while (i < lines.length && lines[i].kind === line.kind) {
			group.push(lines[i]);
			i++;
		}
		if (line.kind === "title") {
			html.push(renderTextGroup("h1", group));
		} else if (line.kind === "heading") {
			html.push(renderTextGroup("h2", group));
		} else if (line.kind === "list") {
			html.push(renderListGroup(group));
		} else {
			html.push(renderTextGroup("p", group));
		}
	}
	return html.join("");
}

function renderDocumentPages(text: string): string[] {
	const lines = buildPreviewLines(text);
	const pages: string[] = [];
	for (let i = 0; i < lines.length; i += PREVIEW_MAX_LINES_PER_PAGE) {
		pages.push(pageLinesToHtml(lines.slice(i, i + PREVIEW_MAX_LINES_PER_PAGE)));
	}
	return pages.length > 0 ? pages : [""];
}

function renderContractDocument(
	contractText: string,
	formData: Record<string, unknown>,
	blocks: ConditionalBlockRow[],
): RenderedContractDocument {
	const text = renderContractText(contractText, formData, blocks);
	const pages = renderDocumentPages(text);
	return {
		text,
		html: pages.map((page) => `<section>${page}</section>`).join(""),
		pages,
	};
}

// =========================================================================
// Helpers
// =========================================================================

function generateSignatureToken(): string {
	return randomBytes(32).toString("hex");
}

function getAppBaseUrl(request: { headers: Record<string, unknown> }): string {
	const configured = process.env.APP_BASE_URL?.trim();
	if (configured) return configured.replace(/\/+$/, "");
	const origin =
		typeof request.headers.origin === "string" ? request.headers.origin : "";
	if (origin) return origin.replace(/\/+$/, "");
	return "http://localhost:5173";
}

function getPartnerEmailFromSubmission(
	submission: Record<string, unknown>,
): string {
	const formData =
		typeof submission.form_data === "object" && submission.form_data !== null
			? (submission.form_data as Record<string, unknown>)
			: {};
	const raw = formData.partner_contact_email;
	return typeof raw === "string" ? raw.trim() : "";
}

function getPartnerCompanyNameFromSubmission(
	submission: Record<string, unknown>,
): string {
	const formData =
		typeof submission.form_data === "object" && submission.form_data !== null
			? (submission.form_data as Record<string, unknown>)
			: {};
	const raw = formData.partner_company_name;
	return typeof raw === "string" ? raw.trim() : "";
}

async function notifySubmitterOfClarification(args: {
	submission: Record<string, unknown>;
	message?: string | null;
	submissionUrl: string;
}): Promise<{ recipient: string | null; error: string | null }> {
	if (!isContractEmailConfigured()) {
		return {
			recipient: null,
			error:
				"Contract email sending is not configured. Set RESEND_API_KEY and CONTRACT_EMAIL_FROM.",
		};
	}
	const submitterUserId =
		typeof args.submission.submitter_user_id === "string"
			? args.submission.submitter_user_id
			: "";
	if (!submitterUserId) {
		return { recipient: null, error: "Submission submitter is missing." };
	}

	const submitterEmail = await getAuthEmail(submitterUserId);
	if (!submitterEmail) {
		return { recipient: null, error: "Submission submitter email not found." };
	}

	await sendContractClarificationEmail({
		to: submitterEmail,
		partnerCompanyName: getPartnerCompanyNameFromSubmission(args.submission),
		message: args.message,
		submissionUrl: args.submissionUrl,
	});
	return { recipient: submitterEmail, error: null };
}

function verifyOpenSignWebhookSignature(
	body: unknown,
	signature: unknown,
): boolean {
	const secret = process.env.OPENSIGN_WEBHOOK_SECRET?.trim();
	if (!secret) return false;
	if (typeof signature !== "string" || !signature.trim()) return false;
	const expected = createHmac("sha256", secret)
		.update(JSON.stringify(body))
		.digest("hex");
	const received = signature.trim();
	const expectedBuffer = Buffer.from(expected, "hex");
	const receivedBuffer = Buffer.from(received, "hex");
	if (expectedBuffer.length !== receivedBuffer.length) return false;
	return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function isOpenSignCompletedEvent(event: string): boolean {
	return ["completed", "document_completed", "complete"].includes(
		event.toLowerCase(),
	);
}

function isOpenSignFailureEvent(event: string): boolean {
	return ["declined", "revoked", "expired", "voided"].includes(
		event.toLowerCase(),
	);
}

function buildFinalPdfText(submission: Record<string, unknown>): string {
	const contractText =
		typeof submission.admin_edited_text === "string" &&
		submission.admin_edited_text.trim()
			? submission.admin_edited_text
			: typeof submission.generated_contract_text === "string"
				? submission.generated_contract_text
				: "";
	const partnerName =
		typeof submission.signer_name === "string" ? submission.signer_name : "";
	const partnerSignedAt =
		typeof submission.signed_at === "string" ? submission.signed_at : "";
	const boardName =
		typeof submission.admin_signer_name === "string"
			? submission.admin_signer_name
			: "";
	const boardSignedAt =
		typeof submission.admin_signed_at === "string"
			? submission.admin_signed_at
			: "";

	return [
		contractText,
		"",
		"---",
		"Signaturen",
		`Partner: ${partnerName || "-"}${partnerSignedAt ? ` (${partnerSignedAt})` : ""}`,
		`TUM.ai / Board: ${boardName || "-"}${boardSignedAt ? ` (${boardSignedAt})` : ""}`,
	].join("\n");
}

async function getPdfTextForSubmission(
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

function sendPdf(
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

function buildSignedDocumentText(
	documentText: string,
	submission: Record<string, unknown>,
): string {
	const partnerName =
		typeof submission.signer_name === "string" ? submission.signer_name : "";
	const partnerSignedAt =
		typeof submission.signed_at === "string" ? submission.signed_at : "";
	const boardName =
		typeof submission.admin_signer_name === "string"
			? submission.admin_signer_name
			: "";
	const boardSignedAt =
		typeof submission.admin_signed_at === "string"
			? submission.admin_signed_at
			: "";

	return [
		documentText,
		"",
		"Signaturen",
		`Partner: ${partnerName || "-"}${partnerSignedAt ? ` (${partnerSignedAt})` : ""}`,
		`TUM.ai / Board: ${boardName || "-"}${boardSignedAt ? ` (${boardSignedAt})` : ""}`,
	].join("\n");
}

function isMissingContractsTable(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const e = error as { code?: unknown; message?: unknown };
	const message = typeof e.message === "string" ? e.message.toLowerCase() : "";
	return (
		e.code === "42P01" ||
		e.code === "PGRST205" ||
		(message.includes("contract_") && message.includes("not exist")) ||
		(message.includes("contract_") && message.includes("not found"))
	);
}

function createContractDatabaseError(error: unknown): DatabaseError {
	if (isMissingContractsTable(error)) {
		return new DatabaseError(
			"Contracts tables are missing locally. Run `pnpm supabase:reset` to apply migrations.",
		);
	}
	return new DatabaseError();
}

async function fetchTemplateWithChildren(templateId: string) {
	const supabase = getSupabase();
	const [tplRes, varsRes, blocksRes] = await Promise.all([
		supabase
			.from("contract_templates")
			.select("*")
			.eq("id", templateId)
			.single(),
		supabase
			.from("contract_template_variables")
			.select("*")
			.eq("template_id", templateId)
			.order("sort_order", { ascending: true }),
		supabase
			.from("contract_conditional_blocks")
			.select("*")
			.eq("template_id", templateId)
			.order("sort_order", { ascending: true }),
	]);

	if (tplRes.error) throw tplRes.error;
	if (varsRes.error) throw varsRes.error;
	if (blocksRes.error) throw blocksRes.error;

	return {
		template: tplRes.data,
		variables: varsRes.data ?? [],
		blocks: (blocksRes.data ?? []) as ConditionalBlockRow[],
	};
}

async function renderTemplateDocument(
	templateId: string,
	formData: Record<string, unknown>,
): Promise<RenderedContractDocument | null> {
	const { template, blocks } = await fetchTemplateWithChildren(templateId);
	if (!template) return null;
	return renderContractDocument(
		(template as { contract_text: string }).contract_text,
		formData,
		blocks,
	);
}

async function createDocumentVersion(args: {
	submissionId: string;
	source: string;
	text: string;
	formData: Record<string, unknown>;
	createdBy?: string | null;
}): Promise<Record<string, unknown>> {
	const supabase = getSupabase();
	const { data: latest, error: latestError } = await supabase
		.from("contract_document_versions")
		.select("version_number")
		.eq("submission_id", args.submissionId)
		.order("version_number", { ascending: false })
		.limit(1);
	if (latestError) throw latestError;

	const latestVersion = Array.isArray(latest)
		? Number(
				(latest[0] as { version_number?: unknown } | undefined)
					?.version_number ?? 0,
			)
		: 0;
	const nextVersion = latestVersion + 1;
	const pages = renderDocumentPages(args.text);
	const { data, error } = await supabase
		.from("contract_document_versions")
		.insert({
			submission_id: args.submissionId,
			version_number: nextVersion,
			source: args.source,
			rendered_text: args.text,
			rendered_html: pages.map((page) => `<section>${page}</section>`).join(""),
			form_data_snapshot: args.formData,
			created_by: args.createdBy ?? null,
		})
		.select("*")
		.single();
	if (error) throw error;
	return data as Record<string, unknown>;
}

async function fetchDocumentVersion(
	versionId: unknown,
): Promise<Record<string, unknown> | null> {
	if (typeof versionId !== "string" || !versionId) return null;
	const { data, error } = await getSupabase()
		.from("contract_document_versions")
		.select("*")
		.eq("id", versionId)
		.maybeSingle();
	if (error) throw error;
	return (data as Record<string, unknown> | null) ?? null;
}

async function fetchSubmissionComments(
	submissionId: string,
): Promise<Array<Record<string, unknown>>> {
	const { data, error } = await getSupabase()
		.from("contract_partner_comments")
		.select(
			"id, submission_id, author_type, author_name, author_email, comment, document_version_id, created_at",
		)
		.eq("submission_id", submissionId)
		.order("created_at", { ascending: true });
	if (error) throw error;
	return (data ?? []) as Array<Record<string, unknown>>;
}

function sanitizePublicComment(
	comment: Record<string, unknown>,
): Record<string, unknown> {
	return {
		author_type:
			comment.author_type === "internal" || comment.author_type === "partner"
				? comment.author_type
				: "partner",
		author_name:
			comment.author_type === "internal"
				? "TUM.ai"
				: typeof comment.author_name === "string" && comment.author_name.trim()
					? comment.author_name
					: "Partner",
		comment: typeof comment.comment === "string" ? comment.comment : "",
		created_at:
			typeof comment.created_at === "string" && comment.created_at
				? comment.created_at
				: new Date(0).toISOString(),
	};
}

function legacyPartnerCommentForPublicHistory(
	submission: Record<string, unknown>,
): Record<string, unknown> | null {
	const comment =
		typeof submission.partner_comment === "string"
			? submission.partner_comment.trim()
			: "";
	if (!comment) return null;
	return sanitizePublicComment({
		author_type: "partner",
		author_name: getPartnerCompanyNameFromSubmission(submission) || "Partner",
		comment,
		created_at:
			typeof submission.partner_commented_at === "string"
				? submission.partner_commented_at
				: typeof submission.updated_at === "string"
					? submission.updated_at
					: typeof submission.submitted_at === "string"
						? submission.submitted_at
						: new Date(0).toISOString(),
	});
}

function buildPublicCommentHistory(
	submission: Record<string, unknown>,
	comments: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
	const publicComments = comments.map(sanitizePublicComment);
	const legacyComment = legacyPartnerCommentForPublicHistory(submission);
	if (
		legacyComment &&
		!publicComments.some(
			(comment) =>
				comment.author_type === "partner" &&
				comment.comment === legacyComment.comment,
		)
	) {
		publicComments.unshift(legacyComment);
	}
	return publicComments;
}

async function createSubmissionComment(args: {
	submissionId: string;
	authorType: "partner" | "internal";
	authorName?: string | null;
	authorEmail?: string | null;
	comment: string;
	documentVersionId?: string | null;
	createdBy?: string | null;
}): Promise<Record<string, unknown>> {
	const { data, error } = await getSupabase()
		.from("contract_partner_comments")
		.insert({
			submission_id: args.submissionId,
			author_type: args.authorType,
			author_name: args.authorName ?? null,
			author_email: args.authorEmail ?? null,
			comment: args.comment,
			document_version_id: args.documentVersionId ?? null,
			created_by: args.createdBy ?? null,
		})
		.select("*")
		.single();
	if (error) throw error;
	return data as Record<string, unknown>;
}

function textFromSubmission(submission: Record<string, unknown>): string {
	if (
		typeof submission.admin_edited_text === "string" &&
		submission.admin_edited_text.trim()
	) {
		return submission.admin_edited_text;
	}
	return typeof submission.generated_contract_text === "string"
		? submission.generated_contract_text
		: "";
}

async function canEditDraftSubmission(
	userId: string,
	submission: Record<string, unknown>,
): Promise<boolean> {
	if (submission.submitter_user_id === userId) return true;
	return checkAdminRole(userId);
}

// =========================================================================
// Route plugin
// =========================================================================

export async function contractRoutes(server: FastifyInstance) {
	// ---------------------------------------------------------------------
	// Templates: contract tools are limited to departments with contracts.admin.
	// ---------------------------------------------------------------------

	server.get(
		"/contracts/templates",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, _reply) => {
			const { data, error } = await getSupabase()
				.from("contract_templates")
				.select("*")
				.order("name", { ascending: true });

			if (error) {
				request.log.error({ err: error }, "Failed to list contract templates");
				throw createContractDatabaseError(error);
			}

			return data ?? [];
		},
	);

	server.get<{ Params: { id: string } }>(
		"/contracts/templates/:id",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			try {
				const result = await fetchTemplateWithChildren(request.params.id);
				return result;
			} catch (error) {
				const code = (error as { code?: string } | null)?.code;
				if (code === "PGRST116") {
					return reply.status(404).send({ error: "Template not found" });
				}
				request.log.error({ err: error }, "Failed to fetch template");
				throw createContractDatabaseError(error);
			}
		},
	);

	server.post<{ Params: { id: string } }>(
		"/contracts/templates/:id/preview",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const body = PreviewBodySchema.parse(request.body);
			const formData = enrichContractFormData(body.form_data);
			try {
				const { template, blocks } = await fetchTemplateWithChildren(
					request.params.id,
				);
				if (!template) {
					return reply.status(404).send({ error: "Template not found" });
				}
				return renderContractDocument(
					(template as { contract_text: string }).contract_text,
					formData,
					blocks,
				);
			} catch (error) {
				const code = (error as { code?: string } | null)?.code;
				if (code === "PGRST116") {
					return reply.status(404).send({ error: "Template not found" });
				}
				request.log.error({ err: error }, "Failed to render contract preview");
				throw createContractDatabaseError(error);
			}
		},
	);

	server.post(
		"/contracts/templates",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, _reply) => {
			const body = TemplateBodySchema.parse(request.body);
			const { data, error } = await getSupabase()
				.from("contract_templates")
				.insert(body)
				.select("*")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to create template");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.patch<{ Params: { id: string } }>(
		"/contracts/templates/:id",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const body = TemplateBodySchema.partial().parse(request.body);
			const { data, error } = await getSupabase()
				.from("contract_templates")
				.update({ ...body, updated_at: new Date().toISOString() })
				.eq("id", request.params.id)
				.select("*")
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Template not found" });
				}
				request.log.error({ err: error }, "Failed to update template");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.delete<{ Params: { id: string } }>(
		"/contracts/templates/:id",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const { count, error } = await getSupabase()
				.from("contract_templates")
				.delete({ count: "exact" })
				.eq("id", request.params.id);
			if (error) {
				if ((error as { code?: string }).code === "23503") {
					return reply
						.status(409)
						.send({ error: "Cannot delete a template that has submissions." });
				}
				request.log.error({ err: error }, "Failed to delete template");
				throw createContractDatabaseError(error);
			}
			if (!count || count === 0) {
				return reply.status(404).send({ error: "Template not found" });
			}
			return reply.status(204).send();
		},
	);

	// ---------------------------------------------------------------------
	// Variables (nested under template) — contracts admins only.
	// ---------------------------------------------------------------------

	server.post<{ Params: { id: string } }>(
		"/contracts/templates/:id/variables",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, _reply) => {
			const body = VariableBodySchema.parse(request.body);
			const { data, error } = await getSupabase()
				.from("contract_template_variables")
				.insert({ ...body, template_id: request.params.id })
				.select("*")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to create variable");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.patch<{ Params: { id: string; variableId: string } }>(
		"/contracts/templates/:id/variables/:variableId",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const body = VariableBodySchema.partial().parse(request.body);
			const { data, error } = await getSupabase()
				.from("contract_template_variables")
				.update({ ...body, updated_at: new Date().toISOString() })
				.eq("id", request.params.variableId)
				.eq("template_id", request.params.id)
				.select("*")
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Variable not found" });
				}
				request.log.error({ err: error }, "Failed to update variable");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.delete<{ Params: { id: string; variableId: string } }>(
		"/contracts/templates/:id/variables/:variableId",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const { error } = await getSupabase()
				.from("contract_template_variables")
				.delete()
				.eq("id", request.params.variableId)
				.eq("template_id", request.params.id);
			if (error) {
				request.log.error({ err: error }, "Failed to delete variable");
				throw createContractDatabaseError(error);
			}
			return reply.status(204).send();
		},
	);

	// ---------------------------------------------------------------------
	// Conditional blocks (nested under template) — contracts admins only.
	// ---------------------------------------------------------------------

	server.post<{ Params: { id: string } }>(
		"/contracts/templates/:id/blocks",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, _reply) => {
			const body = ConditionalBlockBodySchema.parse(request.body);
			const { data, error } = await getSupabase()
				.from("contract_conditional_blocks")
				.insert({ ...body, template_id: request.params.id })
				.select("*")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to create conditional block");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.patch<{ Params: { id: string; blockId: string } }>(
		"/contracts/templates/:id/blocks/:blockId",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const body = ConditionalBlockBodySchema.partial().parse(request.body);
			const { data, error } = await getSupabase()
				.from("contract_conditional_blocks")
				.update({ ...body, updated_at: new Date().toISOString() })
				.eq("id", request.params.blockId)
				.eq("template_id", request.params.id)
				.select("*")
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Block not found" });
				}
				request.log.error({ err: error }, "Failed to update block");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.delete<{ Params: { id: string; blockId: string } }>(
		"/contracts/templates/:id/blocks/:blockId",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const { error } = await getSupabase()
				.from("contract_conditional_blocks")
				.delete()
				.eq("id", request.params.blockId)
				.eq("template_id", request.params.id);
			if (error) {
				request.log.error({ err: error }, "Failed to delete block");
				throw createContractDatabaseError(error);
			}
			return reply.status(204).send();
		},
	);

	// ---------------------------------------------------------------------
	// Submissions: internal contract workflow is contracts.admin only.
	// ---------------------------------------------------------------------

	server.get(
		"/contracts/submissions",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, _reply) => {
			const user = (request as AuthenticatedRequest).user;
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, template_id, submitter_user_id, status, submitted_at, signed_at, admin_signed_at, final_pdf_token, final_pdf_sent_at, partner_email_sent_at, partner_email_recipient, partner_email_error, clarification_email_sent_at, clarification_email_recipient, clarification_email_error, signature_provider, opensign_document_id, opensign_status, opensign_sent_at, opensign_completed_at, opensign_file_url, opensign_certificate_url, opensign_error, created_at, updated_at, signature_token, signature_token_expires_at",
				)
				.order("created_at", { ascending: false });
			if (error) {
				request.log.error(
					{ err: error, userId: user.id },
					"Failed to list submissions",
				);
				throw createContractDatabaseError(error);
			}
			return data ?? [];
		},
	);

	server.get<{ Params: { id: string } }>(
		"/contracts/submissions/:id",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select("*")
				.eq("id", request.params.id)
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Submission not found" });
				}
				request.log.error({ err: error }, "Failed to fetch submission");
				throw createContractDatabaseError(error);
			}
			return data;
		},
	);

	server.post<{ Params: { id: string } }>(
		"/contracts/submissions/:id/preview",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, _reply) => {
			const body = TextPreviewBodySchema.parse(request.body);
			const pages = renderDocumentPages(body.contract_text);
			return {
				text: body.contract_text,
				html: pages.map((page) => `<section>${page}</section>`).join(""),
				pages,
			};
		},
	);

	server.get<{ Params: { id: string } }>(
		"/contracts/submissions/:id/comments",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, _reply) => {
			try {
				return await fetchSubmissionComments(request.params.id);
			} catch (error) {
				request.log.error({ err: error }, "Failed to fetch contract comments");
				throw createContractDatabaseError(error);
			}
		},
	);

	server.get<{ Params: { id: string } }>(
		"/contracts/submissions/:id/pdf",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select("*")
				.eq("id", request.params.id)
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Submission not found" });
				}
				request.log.error({ err: error }, "Failed to fetch submission PDF");
				throw createContractDatabaseError(error);
			}

			const text = await getPdfTextForSubmission(
				data as Record<string, unknown>,
			);
			return sendPdf(
				reply,
				createTextPdf(text),
				`contract-${request.params.id}.pdf`,
				"attachment",
			);
		},
	);

	server.post<{ Params: { id: string } }>(
		"/contracts/submissions/:id/comments",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = CommentBodySchema.parse(request.body);
			const { data: submission, error: fetchError } = await getSupabase()
				.from("contract_submissions")
				.select("id, active_document_version_id")
				.eq("id", request.params.id)
				.maybeSingle();
			if (fetchError) {
				request.log.error({ err: fetchError }, "Failed to load submission");
				throw createContractDatabaseError(fetchError);
			}
			if (!submission) {
				return reply.status(404).send({ error: "Submission not found" });
			}

			try {
				return await createSubmissionComment({
					submissionId: request.params.id,
					authorType: "internal",
					authorName: user.email ?? null,
					authorEmail: user.email ?? null,
					comment: body.comment,
					documentVersionId:
						typeof submission.active_document_version_id === "string"
							? submission.active_document_version_id
							: null,
					createdBy: user.id,
				});
			} catch (error) {
				request.log.error({ err: error }, "Failed to create internal comment");
				throw createContractDatabaseError(error);
			}
		},
	);

	server.post(
		"/contracts/submissions",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = SubmissionBodySchema.parse(request.body);
			const formData = enrichContractFormData(body.form_data);

			let rendered: RenderedContractDocument;
			try {
				const { template, blocks } = await fetchTemplateWithChildren(
					body.template_id,
				);
				if (!template) {
					return reply.status(404).send({ error: "Template not found" });
				}
				rendered = renderContractDocument(
					(template as { contract_text: string }).contract_text,
					formData,
					blocks,
				);
			} catch (error) {
				request.log.error({ err: error }, "Failed to render contract text");
				throw createContractDatabaseError(error);
			}

			const now = new Date().toISOString();
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.insert({
					template_id: body.template_id,
					submitter_user_id: user.id,
					form_data: formData,
					generated_contract_text: rendered.text,
					status: body.status === "draft" ? "draft" : "legal_review",
					submitted_at: now,
				})
				.select("*")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to create submission");
				throw createContractDatabaseError(error);
			}

			try {
				const version = await createDocumentVersion({
					submissionId: String(data.id),
					source: body.status === "draft" ? "draft" : "generated",
					text: rendered.text,
					formData,
					createdBy: user.id,
				});
				const { data: updated, error: updateError } = await getSupabase()
					.from("contract_submissions")
					.update({
						active_document_version_id: version.id,
						updated_at: new Date().toISOString(),
					})
					.eq("id", data.id)
					.select("*")
					.single();
				if (updateError) throw updateError;
				return updated;
			} catch (error) {
				request.log.error(
					{ err: error },
					"Failed to create initial contract document version",
				);
				throw createContractDatabaseError(error);
			}
		},
	);

	server.patch<{ Params: { id: string } }>(
		"/contracts/submissions/:id/draft",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = DraftSubmissionPatchSchema.parse(request.body);
			const { data: current, error: currentError } = await getSupabase()
				.from("contract_submissions")
				.select("*")
				.eq("id", request.params.id)
				.single();

			if (currentError || !current) {
				return reply.status(404).send({ error: "Submission not found" });
			}
			if (current.status !== "draft") {
				return reply
					.status(409)
					.send({ error: "Only draft submissions can be edited here" });
			}
			if (!(await canEditDraftSubmission(user.id, current))) {
				return reply
					.status(403)
					.send({ error: "Only the draft creator can edit this draft" });
			}

			const formData = enrichContractFormData(body.form_data);
			let rendered: RenderedContractDocument | null = null;
			try {
				rendered = await renderTemplateDocument(
					String(current.template_id),
					formData,
				);
				if (!rendered) {
					return reply.status(404).send({ error: "Template not found" });
				}
			} catch (error) {
				request.log.error({ err: error }, "Failed to render draft contract");
				throw createContractDatabaseError(error);
			}

			const nowIso = new Date().toISOString();
			const nextStatus = body.status === "submitted" ? "legal_review" : "draft";
			const version = await createDocumentVersion({
				submissionId: request.params.id,
				source: nextStatus === "draft" ? "draft" : "generated",
				text: rendered.text,
				formData,
				createdBy: user.id,
			});
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update({
					form_data: formData,
					generated_contract_text: rendered.text,
					admin_edited_text: null,
					status: nextStatus,
					active_document_version_id: version.id,
					submitted_at:
						nextStatus === "legal_review" ? nowIso : current.submitted_at,
					updated_at: nowIso,
				})
				.eq("id", request.params.id)
				.eq("status", "draft")
				.select("*")
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply
						.status(409)
						.send({ error: "Draft was already submitted or changed" });
				}
				request.log.error({ err: error }, "Failed to update draft submission");
				throw createContractDatabaseError(error);
			}

			return data;
		},
	);

	server.patch<{ Params: { id: string } }>(
		"/contracts/submissions/:id",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = SubmissionPatchSchema.parse(request.body);
			const shouldSendToPartner =
				body.send_to_partner === true ||
				body.send_partner_email === true ||
				body.send_opensign === true;
			const usesExternalDelivery =
				body.send_partner_email === true || body.send_opensign === true;
			const needsCurrent =
				body.admin_edited_text !== undefined ||
				body.status === "inquiry" ||
				body.generate_signature_token === true ||
				shouldSendToPartner;
			let current: Record<string, unknown> | null = null;
			let sentTextForExternalDelivery: string | null = null;
			let sentToPartnerUpdate: Record<string, unknown> | null = null;

			if (needsCurrent) {
				const { data, error } = await getSupabase()
					.from("contract_submissions")
					.select("*")
					.eq("id", request.params.id)
					.single();
				if (error || !data) {
					return reply.status(404).send({ error: "Submission not found" });
				}
				current = data as Record<string, unknown>;
			}

			const update: Record<string, unknown> = {
				updated_at: new Date().toISOString(),
				reviewed_by: user.id,
				reviewed_at: new Date().toISOString(),
			};
			if (body.status !== undefined)
				update.status = body.status satisfies SubmissionStatus;
			if (body.admin_edited_text !== undefined)
				update.admin_edited_text = body.admin_edited_text;
			if (body.notes !== undefined) update.notes = body.notes;
			if (body.feedback_message !== undefined)
				update.feedback_message = body.feedback_message;
			if (body.generate_signature_token === true || shouldSendToPartner) {
				if (
					![
						"legal_review",
						"in_review",
						"approved",
						"partner_comments",
					].includes(String(current?.status))
				) {
					return reply.status(400).send({
						error: "Submission is not ready to send to the partner",
					});
				}
				if (body.send_partner_email === true) {
					const partnerEmail = getPartnerEmailFromSubmission(current ?? {});
					if (!partnerEmail) {
						return reply.status(400).send({
							error:
								"Partner contact email is required before sending an email",
						});
					}
					if (!isContractEmailConfigured()) {
						return reply.status(503).send({
							error:
								"Contract email sending is not configured. Set RESEND_API_KEY and CONTRACT_EMAIL_FROM.",
						});
					}
				}
				if (body.send_opensign === true) {
					const partnerEmail = getPartnerEmailFromSubmission(current ?? {});
					if (!partnerEmail) {
						return reply.status(400).send({
							error:
								"Partner contact email is required before sending with OpenSign",
						});
					}
					if (!isOpenSignConfigured()) {
						return reply.status(503).send({
							error:
								"OpenSign sending is not configured. Set OPENSIGN_API_TOKEN.",
						});
					}
				}
				const ttlHours = body.signature_token_ttl_hours ?? 24 * 30;
				update.signature_token = generateSignatureToken();
				update.signature_token_expires_at = new Date(
					Date.now() + ttlHours * 60 * 60 * 1000,
				).toISOString();
				sentToPartnerUpdate = {
					status: "sent_to_partner",
					sent_to_partner_at: new Date().toISOString(),
				};
				if (!usesExternalDelivery) {
					Object.assign(update, sentToPartnerUpdate);
				}
				if (body.send_partner_email === true) {
					update.partner_email_error = null;
				}
				if (body.send_opensign === true) {
					update.signature_provider = "opensign";
					update.opensign_error = null;
				}
			}

			if (
				current &&
				(body.admin_edited_text !== undefined || shouldSendToPartner)
			) {
				const versionText =
					body.admin_edited_text !== undefined &&
					body.admin_edited_text !== null
						? body.admin_edited_text
						: textFromSubmission({ ...current, ...update });
				if (shouldSendToPartner) {
					sentTextForExternalDelivery = versionText;
				}
				const version = await createDocumentVersion({
					submissionId: request.params.id,
					source: shouldSendToPartner ? "sent_to_partner" : "legal_review",
					text: versionText,
					formData:
						typeof current.form_data === "object" && current.form_data !== null
							? (current.form_data as Record<string, unknown>)
							: {},
					createdBy: user.id,
				});
				update.active_document_version_id = version.id;
				if (shouldSendToPartner) {
					update.sent_document_version_id = version.id;
				}
			}

			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update(update)
				.eq("id", request.params.id)
				.select("*")
				.single();
			if (error) {
				if ((error as { code?: string }).code === "PGRST116") {
					return reply.status(404).send({ error: "Submission not found" });
				}
				request.log.error({ err: error }, "Failed to update submission");
				throw createContractDatabaseError(error);
			}
			if (body.send_partner_email === true) {
				const submission = data as Record<string, unknown>;
				const recipient = getPartnerEmailFromSubmission(submission);
				const signingToken =
					typeof submission.signature_token === "string"
						? submission.signature_token
						: "";
				try {
					await sendContractPartnerEmail({
						to: recipient,
						partnerCompanyName:
							getPartnerCompanyNameFromSubmission(submission) || "Partner",
						signingUrl: `${getAppBaseUrl(request)}/contracts/sign/${signingToken}`,
						subject: body.partner_email_subject,
						customMessage: body.partner_email_message,
					});
					const { data: emailed, error: emailUpdateError } = await getSupabase()
						.from("contract_submissions")
						.update({
							...(sentToPartnerUpdate ?? {}),
							partner_email_sent_at: new Date().toISOString(),
							partner_email_recipient: recipient,
							partner_email_error: null,
							updated_at: new Date().toISOString(),
						})
						.eq("id", request.params.id)
						.select("*")
						.single();
					if (emailUpdateError) throw emailUpdateError;
					return emailed;
				} catch (emailError) {
					const message =
						emailError instanceof Error
							? emailError.message
							: "Failed to send partner email";
					await getSupabase()
						.from("contract_submissions")
						.update({
							partner_email_recipient: recipient,
							partner_email_error: message,
							updated_at: new Date().toISOString(),
						})
						.eq("id", request.params.id);
					request.log.error(
						{ err: emailError },
						"Failed to send partner contract email",
					);
					return reply.status(502).send({ error: message });
				}
			}
			if (body.send_opensign === true) {
				const submission = data as Record<string, unknown>;
				const recipient = getPartnerEmailFromSubmission(submission);
				const partnerCompany =
					getPartnerCompanyNameFromSubmission(submission) || "Partner";
				const documentText =
					sentTextForExternalDelivery ?? textFromSubmission(submission);
				try {
					const openSignDocument = await sendOpenSignDocument({
						name: `TUM.ai Contract - ${partnerCompany}`,
						pdf: createTextPdf(documentText),
						signer: {
							name: partnerCompany,
							email: recipient,
						},
						note: "Please review and sign this TUM.ai contract in OpenSign.",
						redirectUrl: `${getAppBaseUrl(request)}/contracts`,
					});
					const { data: openSigned, error: openSignUpdateError } =
						await getSupabase()
							.from("contract_submissions")
							.update({
								...(sentToPartnerUpdate ?? {}),
								opensign_document_id: openSignDocument.documentId,
								opensign_status: openSignDocument.status ?? "sent",
								opensign_sent_at: new Date().toISOString(),
								opensign_file_url: openSignDocument.fileUrl,
								opensign_error: null,
								updated_at: new Date().toISOString(),
							})
							.eq("id", request.params.id)
							.select("*")
							.single();
					if (openSignUpdateError) throw openSignUpdateError;
					return openSigned;
				} catch (openSignError) {
					const message =
						openSignError instanceof Error
							? openSignError.message
							: "Failed to send contract with OpenSign";
					await getSupabase()
						.from("contract_submissions")
						.update({
							opensign_error: message,
							updated_at: new Date().toISOString(),
						})
						.eq("id", request.params.id);
					request.log.error(
						{ err: openSignError },
						"Failed to send OpenSign contract",
					);
					return reply.status(502).send({ error: message });
				}
			}
			if (body.status === "inquiry") {
				let clarificationEmailUpdate: Record<string, unknown>;
				try {
					const result = await notifySubmitterOfClarification({
						submission: data as Record<string, unknown>,
						message: body.feedback_message ?? body.notes ?? null,
						submissionUrl: `${getAppBaseUrl(request)}/contracts/submissions/${request.params.id}`,
					});
					clarificationEmailUpdate = {
						clarification_email_recipient: result.recipient,
						clarification_email_sent_at: result.error
							? null
							: new Date().toISOString(),
						clarification_email_error: result.error,
					};
				} catch (notificationError) {
					const message =
						notificationError instanceof Error
							? notificationError.message
							: "Failed to send clarification notification";
					request.log.error(
						{ err: notificationError, submissionId: request.params.id },
						"Failed to notify contract submitter about clarification request",
					);
					clarificationEmailUpdate = {
						clarification_email_recipient: null,
						clarification_email_sent_at: null,
						clarification_email_error: message,
					};
				}
				const { data: notified, error: notificationUpdateError } =
					await getSupabase()
						.from("contract_submissions")
						.update({
							...clarificationEmailUpdate,
							updated_at: new Date().toISOString(),
						})
						.eq("id", request.params.id)
						.select("*")
						.single();
				if (notificationUpdateError) {
					request.log.error(
						{ err: notificationUpdateError, submissionId: request.params.id },
						"Failed to store contract clarification notification status",
					);
					throw createContractDatabaseError(notificationUpdateError);
				}
				return notified;
			}
			return data;
		},
	);

	server.post(
		"/webhooks/opensign",
		{ config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
		async (request, reply) => {
			if (
				!verifyOpenSignWebhookSignature(
					request.body,
					request.headers["x-webhook-signature"],
				)
			) {
				return reply.status(401).send({ error: "Invalid webhook signature" });
			}

			const body = OpenSignWebhookSchema.parse(request.body);
			if (!body.objectId) {
				return reply
					.status(400)
					.send({ error: "Missing OpenSign document id" });
			}

			const event = body.event ?? "unknown";
			const nowIso = new Date().toISOString();
			const { data: current, error: currentError } = await getSupabase()
				.from("contract_submissions")
				.select("id, status")
				.eq("opensign_document_id", body.objectId)
				.maybeSingle();
			if (currentError) {
				request.log.error(
					{ err: currentError },
					"Failed to fetch OpenSign webhook submission",
				);
				throw createContractDatabaseError(currentError);
			}
			if (!current) {
				request.log.warn(
					{ openSignDocumentId: body.objectId, event },
					"OpenSign webhook did not match a contract submission",
				);
				return { ok: true };
			}

			const update: Record<string, unknown> = {
				opensign_status: event,
				opensign_webhook_last_event: event,
				opensign_webhook_received_at: nowIso,
				updated_at: nowIso,
			};
			if (body.file) update.opensign_file_url = body.file;
			const certificateUrl = body.certificateUrl ?? body.certificate;
			if (certificateUrl) update.opensign_certificate_url = certificateUrl;

			const canApplyOpenSignStatus = current.status === "sent_to_partner";
			if (canApplyOpenSignStatus && isOpenSignCompletedEvent(event)) {
				update.status = "partner_signed";
				update.signed_at = nowIso;
				update.signer_name = "OpenSign";
				update.opensign_completed_at = nowIso;
				update.opensign_error = null;
			} else if (canApplyOpenSignStatus && isOpenSignFailureEvent(event)) {
				update.status = "partner_comments";
				update.opensign_error = `OpenSign document ${event}`;
			}

			const { error } = await getSupabase()
				.from("contract_submissions")
				.update(update)
				.eq("id", current.id)
				.select("id, status, opensign_status")
				.maybeSingle();
			if (error) {
				request.log.error({ err: error }, "Failed to process OpenSign webhook");
				throw createContractDatabaseError(error);
			}

			return { ok: true };
		},
	);

	// ---------------------------------------------------------------------
	// Public signing endpoints (no auth). Verified by signature_token only.
	// ---------------------------------------------------------------------

	server.get<{ Params: { token: string } }>(
		"/contracts/sign/:token",
		async (request, reply) => {
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, status, admin_edited_text, generated_contract_text, sent_document_version_id, signature_token_expires_at, signed_at, partner_comment, partner_commented_at, form_data, submitted_at, updated_at",
				)
				.eq("signature_token", request.params.token)
				.maybeSingle();

			if (error) {
				request.log.error({ err: error }, "Failed to fetch signing payload");
				throw createContractDatabaseError(error);
			}
			if (!data) {
				return reply.status(404).send({ error: "Invalid signing link" });
			}
			if (
				data.signature_token_expires_at &&
				new Date(data.signature_token_expires_at).getTime() < Date.now()
			) {
				return reply.status(410).send({ error: "Signing link expired" });
			}
			if (data.signed_at) {
				return reply.status(409).send({ error: "Contract already signed" });
			}

			const sentVersion = await fetchDocumentVersion(
				(data as Record<string, unknown>).sent_document_version_id,
			);
			const contractText =
				typeof sentVersion?.rendered_text === "string"
					? sentVersion.rendered_text
					: textFromSubmission(data as Record<string, unknown>);
			const pages = renderDocumentPages(contractText);
			const comments = await fetchSubmissionComments(String(data.id));
			const publicComments = buildPublicCommentHistory(
				data as Record<string, unknown>,
				comments,
			);

			return {
				contract_text: contractText,
				html:
					typeof sentVersion?.rendered_html === "string"
						? sentVersion.rendered_html
						: pages.map((page) => `<section>${page}</section>`).join(""),
				pages,
				status: data.status,
				comments: publicComments,
			};
		},
	);

	server.post<{ Params: { token: string } }>(
		"/contracts/sign/:token/comment",
		async (request, reply) => {
			const body = CommentBodySchema.parse(request.body);

			const { data: submission, error: fetchError } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, status, signature_token_expires_at, signed_at, sent_document_version_id, form_data",
				)
				.eq("signature_token", request.params.token)
				.maybeSingle();

			if (fetchError) {
				request.log.error(
					{ err: fetchError },
					"Failed to load submission for comment",
				);
				throw createContractDatabaseError(fetchError);
			}
			if (!submission) {
				return reply.status(404).send({ error: "Invalid signing link" });
			}
			if (
				submission.signature_token_expires_at &&
				new Date(submission.signature_token_expires_at).getTime() < Date.now()
			) {
				return reply.status(410).send({ error: "Signing link expired" });
			}
			if (submission.signed_at || submission.status !== "sent_to_partner") {
				return reply
					.status(409)
					.send({ error: "Contract is not awaiting partner comments" });
			}

			const nowIso = new Date().toISOString();
			try {
				await createSubmissionComment({
					submissionId: String(submission.id),
					authorType: "partner",
					authorName:
						getPartnerCompanyNameFromSubmission(
							submission as Record<string, unknown>,
						) || "Partner",
					authorEmail: getPartnerEmailFromSubmission(
						submission as Record<string, unknown>,
					),
					comment: body.comment,
					documentVersionId:
						typeof submission.sent_document_version_id === "string"
							? submission.sent_document_version_id
							: null,
				});
			} catch (error) {
				request.log.error({ err: error }, "Failed to create partner comment");
				throw createContractDatabaseError(error);
			}
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update({
					partner_comment: body.comment,
					partner_commented_at: nowIso,
					status: "partner_comments",
					signature_token: null,
					signature_token_expires_at: null,
					updated_at: nowIso,
				})
				.eq("id", submission.id)
				.select("id, status, partner_comment, partner_commented_at")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to record partner comment");
				throw createContractDatabaseError(error);
			}

			return data;
		},
	);

	// State machine for signing: approved → (generate token) → sent_to_partner → (partner signs) → partner_signed
	server.post<{ Params: { token: string } }>(
		"/contracts/sign/:token",
		async (request, reply) => {
			const body = SignBodySchema.parse(request.body);

			const { data: submission, error: fetchError } = await getSupabase()
				.from("contract_submissions")
				.select("id, status, signature_token_expires_at, signed_at")
				.eq("signature_token", request.params.token)
				.maybeSingle();

			if (fetchError) {
				request.log.error(
					{ err: fetchError },
					"Failed to load submission for sign",
				);
				throw createContractDatabaseError(fetchError);
			}
			if (!submission) {
				return reply.status(404).send({ error: "Invalid signing link" });
			}
			if (
				submission.signature_token_expires_at &&
				new Date(submission.signature_token_expires_at).getTime() < Date.now()
			) {
				return reply.status(410).send({ error: "Signing link expired" });
			}
			if (submission.status !== "sent_to_partner") {
				return reply
					.status(409)
					.send({ error: "Contract is not in a signable state" });
			}

			const nowIso = new Date().toISOString();
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update({
					signature_data: body.signature_data,
					signer_name: body.signer_name,
					signed_at: nowIso,
					status: "partner_signed",
					signature_token: null,
					signature_token_expires_at: null,
					updated_at: nowIso,
				})
				.eq("id", submission.id)
				.select("id, status, signed_at")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to record signature");
				throw createContractDatabaseError(error);
			}

			return data;
		},
	);

	server.post<{ Params: { id: string } }>(
		"/contracts/submissions/:id/board-signature",
		{ preHandler: [authenticate, requireContractsAdmin, requireBoardMember] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = SignBodySchema.parse(request.body);

			const { data: current, error: currentError } = await getSupabase()
				.from("contract_submissions")
				.select("id, status, signed_at")
				.eq("id", request.params.id)
				.single();
			if (currentError || !current) {
				return reply.status(404).send({ error: "Submission not found" });
			}
			if (current.status !== "partner_signed" || !current.signed_at) {
				return reply.status(409).send({
					error: "Contract must be signed by the partner before board signing",
				});
			}

			const nowIso = new Date().toISOString();
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update({
					admin_signature_data: body.signature_data,
					admin_signer_name: body.signer_name,
					admin_signed_at: nowIso,
					reviewed_by: user.id,
					reviewed_at: nowIso,
					status: "board_signed",
					updated_at: nowIso,
				})
				.eq("id", request.params.id)
				.select("*")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to record board signature");
				throw createContractDatabaseError(error);
			}

			return data;
		},
	);

	server.post<{ Params: { id: string } }>(
		"/contracts/submissions/:id/finalize",
		{ preHandler: [authenticate, requireContractsAdmin] },
		async (request, reply) => {
			const { data: current, error: currentError } = await getSupabase()
				.from("contract_submissions")
				.select("*")
				.eq("id", request.params.id)
				.single();
			if (currentError || !current) {
				return reply.status(404).send({ error: "Submission not found" });
			}
			if (current.status !== "board_signed" && current.status !== "completed") {
				return reply.status(409).send({
					error: "Contract must be board-signed before finalization",
				});
			}

			const nowIso = new Date().toISOString();
			const currentRecord = current as Record<string, unknown>;
			const activeVersion = await fetchDocumentVersion(
				currentRecord.active_document_version_id ??
					currentRecord.sent_document_version_id,
			);
			const baseText =
				typeof activeVersion?.rendered_text === "string"
					? activeVersion.rendered_text
					: textFromSubmission(currentRecord);
			const finalText = buildSignedDocumentText(baseText, currentRecord);
			const finalVersion = await createDocumentVersion({
				submissionId: request.params.id,
				source: "final",
				text: finalText,
				formData:
					typeof currentRecord.form_data === "object" &&
					currentRecord.form_data !== null
						? (currentRecord.form_data as Record<string, unknown>)
						: {},
			});
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.update({
					final_pdf_token: current.final_pdf_token ?? generateSignatureToken(),
					final_document_version_id: finalVersion.id,
					active_document_version_id: finalVersion.id,
					final_pdf_sent_at: nowIso,
					completed_at: nowIso,
					status: "completed",
					updated_at: nowIso,
				})
				.eq("id", request.params.id)
				.select("*")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to finalize contract");
				throw createContractDatabaseError(error);
			}

			return data;
		},
	);

	server.get<{ Params: { token: string }; Querystring: { download?: string } }>(
		"/contracts/final/:token/pdf",
		async (request, reply) => {
			const query = PdfDownloadQuerySchema.parse(request.query);
			const { data, error } = await getSupabase()
				.from("contract_submissions")
				.select(
					"id, status, final_document_version_id, admin_edited_text, generated_contract_text, signer_name, signed_at, admin_signer_name, admin_signed_at",
				)
				.eq("final_pdf_token", request.params.token)
				.maybeSingle();

			if (error) {
				request.log.error({ err: error }, "Failed to fetch final PDF");
				throw createContractDatabaseError(error);
			}
			if (data?.status !== "completed") {
				return reply.status(404).send({ error: "Final PDF not found" });
			}

			const finalVersion = await fetchDocumentVersion(
				(data as Record<string, unknown>).final_document_version_id,
			);
			const finalText =
				typeof finalVersion?.rendered_text === "string"
					? finalVersion.rendered_text
					: buildFinalPdfText(data);
			const pdf = createTextPdf(finalText);
			return sendPdf(
				reply,
				pdf,
				`contract-${data.id}.pdf`,
				query.download === "1" ? "attachment" : "inline",
			);
		},
	);
}

// Re-export for tests
export const __testing = {
	renderContractText,
	stringifyVariable,
	evaluateCondition,
	blockMatches,
};
