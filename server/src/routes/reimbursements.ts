import type { FastifyInstance } from "fastify";
import { electronicFormatIBAN, isValidIBAN } from "ibantools";
import { z } from "zod";
import { DatabaseError } from "../lib/errors.js";
import {
	decryptRecordSafely,
	encryptRecord,
	SENSITIVE_REIMBURSEMENT_FIELDS,
} from "../lib/sensitiveData.js";
import { notifyFinanceOfReimbursementRequest } from "../lib/slackNotifier.js";
import { getSupabase } from "../lib/supabase.js";
import {
	authenticate,
	requireReimbursementReviewer,
} from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const ALLOWED_RECEIPT_MIME_TYPES = new Set([
	"application/pdf",
	"image/jpeg",
	"image/jpg",
	"image/png",
]);

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const OPENAI_CHAT_COMPLETIONS_URL =
	"https://api.openai.com/v1/chat/completions";

const RECEIPT_PARSE_PROMPT = `Analyze this receipt or invoice and return only valid JSON.
Extract:
- amount: total amount in EUR as a number, without currency symbols
- date: receipt or invoice date in YYYY-MM-DD format
- description: concise merchant/vendor and purchase description
- payment_iban: IBAN shown on the document, if any
- payment_bic: BIC/SWIFT shown on the document, if any

If a field cannot be determined, use null.`;

function buildFinanceReviewUrl(): string | undefined {
	const baseUrl = process.env.APP_BASE_URL?.trim();
	if (!baseUrl) {
		return undefined;
	}

	return `${baseUrl.replace(/\/$/, "")}/tools/reimbursement/review`;
}

function isValidDate(dateString: string): boolean {
	const regex = /^\d{4}-\d{2}-\d{2}$/;
	if (!regex.test(dateString)) {
		return false;
	}

	const date = new Date(dateString);
	if (Number.isNaN(date.getTime())) {
		return false;
	}

	return date.toISOString().slice(0, 10) === dateString;
}

function countWords(value: string): number {
	return value.trim().split(/\s+/).filter(Boolean).length;
}

function validateOptionalIban(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}

	const normalized = electronicFormatIBAN(value);
	if (!normalized || !isValidIBAN(normalized)) {
		throw new z.ZodError([
			{
				code: z.ZodIssueCode.custom,
				message: "Invalid IBAN",
				path: ["payment_iban"],
			},
		]);
	}

	return normalized;
}

function estimateBase64Bytes(value: string): number {
	return (value.length * 3) / 4;
}

function stripDataUrlPrefix(value: string): string {
	const marker = "base64,";
	const markerIndex = value.indexOf(marker);
	return markerIndex >= 0 ? value.slice(markerIndex + marker.length) : value;
}

function buildDataUrl(base64: string, mimeType: string): string {
	return `data:${mimeType};base64,${stripDataUrlPrefix(base64)}`;
}

function isPdfMimeType(mimeType: string): boolean {
	return mimeType === "application/pdf";
}

function normalizeMaybeString(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function normalizeMaybeDate(value: unknown): string | null {
	const raw = normalizeMaybeString(value);
	if (!raw) {
		return null;
	}

	return isValidDate(raw) ? raw : null;
}

function normalizeMaybeAmount(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return value;
	}
	if (typeof value !== "string") {
		return null;
	}

	const parsed = Number.parseFloat(value.replace(",", "."));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractJsonObject(rawContent: string): Record<string, unknown> {
	let text = rawContent.trim();
	if (text.startsWith("```json")) {
		text = text.slice(7);
	} else if (text.startsWith("```")) {
		text = text.slice(3);
	}
	if (text.endsWith("```")) {
		text = text.slice(0, -3);
	}

	return JSON.parse(text.trim()) as Record<string, unknown>;
}

function isMissingReimbursementsTable(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const maybeError = error as { code?: unknown; message?: unknown };
	const message =
		typeof maybeError.message === "string"
			? maybeError.message.toLowerCase()
			: "";

	return (
		maybeError.code === "42P01" ||
		maybeError.code === "PGRST205" ||
		(message.includes("reimbursements") && message.includes("not exist")) ||
		(message.includes("reimbursements") && message.includes("not found"))
	);
}

function createReimbursementDatabaseError(error: unknown): DatabaseError {
	if (isMissingReimbursementsTable(error)) {
		return new DatabaseError(
			"Reimbursements table is missing locally. Run `pnpm supabase:reset` to apply migrations.",
		);
	}

	return new DatabaseError();
}

const CreateReimbursementSchema = z
	.object({
		amount: z.number().positive("Amount must be positive"),
		date: z.string().refine(isValidDate, "Invalid date"),
		description: z
			.string()
			.trim()
			.min(1)
			.max(1000)
			.refine(
				(value) => countWords(value) >= 5,
				"Description must be at least five words",
			),
		department: z.string().trim().min(1).max(120),
		submission_type: z
			.enum(["reimbursement", "invoice"])
			.default("reimbursement"),
		payment_iban: z.string().optional().nullable(),
		payment_bic: z.string().trim().min(1).max(34).optional().nullable(),
		receipt_filename: z.string().trim().min(1).max(255).optional().nullable(),
		receipt_mime_type: z.string().trim().min(1).max(120).optional().nullable(),
		receipt_base64: z.string().trim().optional().nullable(),
	})
	.superRefine((body, context) => {
		if (
			!body.receipt_base64 ||
			!body.receipt_filename ||
			!body.receipt_mime_type
		) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Receipt is required",
				path: ["receipt_base64"],
			});
		}

		if (body.submission_type === "reimbursement") {
			if (!body.payment_iban) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					message: "IBAN is required for reimbursement requests",
					path: ["payment_iban"],
				});
			}
			if (!body.payment_bic) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					message: "BIC is required for reimbursement requests",
					path: ["payment_bic"],
				});
			}
		}

		if (body.receipt_base64) {
			if (!body.receipt_filename || !body.receipt_mime_type) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Receipt filename and MIME type are required with a file",
					path: ["receipt_filename"],
				});
			}
			if (
				body.receipt_mime_type &&
				!ALLOWED_RECEIPT_MIME_TYPES.has(body.receipt_mime_type)
			) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Unsupported receipt type. Upload a PDF, JPG, or PNG.",
					path: ["receipt_mime_type"],
				});
			}
			if (estimateBase64Bytes(body.receipt_base64) > MAX_RECEIPT_BYTES) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Receipt file is too large",
					path: ["receipt_base64"],
				});
			}
		}
	});

const ParseReimbursementReceiptSchema = z.object({
	receipt_filename: z.string().trim().min(1).max(255),
	receipt_mime_type: z.string().trim().min(1).max(120),
	receipt_base64: z.string().trim().min(1),
});

const ReviewReimbursementSchema = z
	.object({
		action: z.enum(["approve", "reject", "mark_paid"]),
		rejection_reason: z.string().trim().max(500).optional(),
	})
	.superRefine((body, context) => {
		if (body.action === "reject" && !body.rejection_reason) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Rejection reason is required",
				path: ["rejection_reason"],
			});
		}
	});

type ReimbursementRow = Record<string, unknown>;

function withoutReceiptPayload(row: ReimbursementRow): ReimbursementRow {
	const { receipt_base64: _receiptBase64, ...rest } = row;
	return rest;
}

export async function reimbursementRoutes(server: FastifyInstance) {
	server.get(
		"/reimbursements",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const user = (request as AuthenticatedRequest).user;

			const { data, error } = await getSupabase()
				.from("reimbursements")
				.select("*")
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			if (error) {
				request.log.error({ err: error }, "Failed to list reimbursements");
				throw createReimbursementDatabaseError(error);
			}

			return (data ?? []).map((row) =>
				withoutReceiptPayload(
					decryptRecordSafely(
						row as ReimbursementRow,
						SENSITIVE_REIMBURSEMENT_FIELDS,
						({ field, error }) => {
							request.log.warn(
								{ err: error, userId: user.id, field },
								"Failed to decrypt reimbursement field; returning blank value",
							);
						},
					),
				),
			);
		},
	);

	server.post(
		"/reimbursements/parse-receipt",
		{ preHandler: authenticate },
		async (request, reply) => {
			const body = ParseReimbursementReceiptSchema.parse(request.body);
			const apiKey = process.env.OPENAI_API_KEY?.trim();

			if (!apiKey) {
				return reply.status(503).send({
					error:
						"Receipt extraction is not configured. Add OPENAI_API_KEY to enable automatic parsing.",
				});
			}

			if (!ALLOWED_RECEIPT_MIME_TYPES.has(body.receipt_mime_type)) {
				return reply.status(400).send({
					error: "Unsupported receipt type. Upload a PDF, JPG, or PNG.",
				});
			}

			if (
				estimateBase64Bytes(stripDataUrlPrefix(body.receipt_base64)) >
				MAX_RECEIPT_BYTES
			) {
				return reply.status(400).send({ error: "Receipt file is too large" });
			}

			const dataUrl = buildDataUrl(body.receipt_base64, body.receipt_mime_type);
			const documentContent = isPdfMimeType(body.receipt_mime_type)
				? {
						type: "file",
						file: {
							filename: body.receipt_filename,
							file_data: dataUrl,
						},
					}
				: {
						type: "image_url",
						image_url: { url: dataUrl },
					};

			const openaiResponse = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: "gpt-4o-mini",
					messages: [
						{
							role: "user",
							content: [
								{ type: "text", text: RECEIPT_PARSE_PROMPT },
								documentContent,
							],
						},
					],
					response_format: { type: "json_object" },
					temperature: 0.1,
					max_tokens: 500,
				}),
			});

			if (!openaiResponse.ok) {
				const errorText = await openaiResponse.text();
				request.log.warn(
					{ status: openaiResponse.status, errorText },
					"OpenAI receipt extraction failed",
				);
				return reply.status(502).send({
					error: "Receipt extraction failed. Fill the fields manually.",
				});
			}

			const openaiResult = (await openaiResponse.json()) as {
				choices?: Array<{ message?: { content?: string } }>;
			};
			const content = openaiResult.choices?.[0]?.message?.content;
			if (!content) {
				return reply
					.status(502)
					.send({ error: "Receipt extraction returned no data." });
			}

			try {
				const parsed = extractJsonObject(content);
				return {
					amount: normalizeMaybeAmount(parsed.amount),
					date: normalizeMaybeDate(parsed.date),
					description: normalizeMaybeString(parsed.description),
					payment_iban: normalizeMaybeString(parsed.payment_iban)?.replace(
						/\s/g,
						"",
					),
					payment_bic: normalizeMaybeString(parsed.payment_bic)?.toUpperCase(),
				};
			} catch (error) {
				request.log.warn({ err: error }, "Failed to parse OpenAI receipt JSON");
				return reply
					.status(502)
					.send({ error: "Receipt extraction returned unreadable data." });
			}
		},
	);

	server.get(
		"/reimbursements/review",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, _reply) => {
			const { data, error } = await getSupabase()
				.from("reimbursements")
				.select("*")
				.order("created_at", { ascending: false });

			if (error) {
				request.log.error({ err: error }, "Failed to list reimbursements");
				throw createReimbursementDatabaseError(error);
			}

			return (data ?? []).map((row) =>
				withoutReceiptPayload(
					decryptRecordSafely(
						row as ReimbursementRow,
						SENSITIVE_REIMBURSEMENT_FIELDS,
						({ field, error }) => {
							request.log.warn(
								{ err: error, field },
								"Failed to decrypt reimbursement field; returning blank value",
							);
						},
					),
				),
			);
		},
	);

	server.patch<{ Params: { requestId: string } }>(
		"/reimbursements/review/:requestId",
		{ preHandler: [authenticate, requireReimbursementReviewer] },
		async (request, reply) => {
			const { requestId } = request.params;
			const body = ReviewReimbursementSchema.parse(request.body);

			const { data: existing, error: fetchError } = await getSupabase()
				.from("reimbursements")
				.select("*")
				.eq("id", requestId)
				.single();

			if (fetchError) {
				if ((fetchError as { code?: string }).code === "PGRST116") {
					return reply
						.status(404)
						.send({ error: "Reimbursement request not found" });
				}
				request.log.error({ err: fetchError }, "Failed to fetch reimbursement");
				throw createReimbursementDatabaseError(fetchError);
			}

			const existingRequest = existing as ReimbursementRow;
			if (
				body.action === "mark_paid" &&
				existingRequest.approval_status !== "approved"
			) {
				return reply
					.status(409)
					.send({ error: "Only approved requests can be marked paid" });
			}

			const now = new Date().toISOString();
			const update =
				body.action === "approve"
					? {
							approval_status: "approved",
							rejection_reason: null,
							updated_at: now,
						}
					: body.action === "reject"
						? {
								approval_status: "not_approved",
								status: "rejected",
								rejection_reason: body.rejection_reason,
								updated_at: now,
							}
						: {
								status: "paid",
								payment_status: "paid",
								updated_at: now,
							};

			const { data, error } = await getSupabase()
				.from("reimbursements")
				.update(update)
				.eq("id", requestId)
				.select()
				.single();

			if (error) {
				request.log.error({ err: error }, "Failed to review reimbursement");
				throw createReimbursementDatabaseError(error);
			}

			return withoutReceiptPayload(data as ReimbursementRow);
		},
	);

	server.post(
		"/reimbursements",
		{ preHandler: authenticate },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const body = CreateReimbursementSchema.parse(request.body);
			const paymentIban = validateOptionalIban(body.payment_iban);

			const reimbursement = encryptRecord(
				{
					user_id: user.id,
					amount: body.amount,
					date: body.date,
					description: body.description.trim(),
					department: body.department.trim(),
					submission_type: body.submission_type,
					payment_iban: paymentIban,
					payment_bic: body.payment_bic?.trim() || null,
					receipt_filename: body.receipt_filename?.trim() || null,
					receipt_mime_type: body.receipt_mime_type?.trim() || null,
					receipt_base64: body.receipt_base64 || null,
					status: "requested",
					approval_status: "pending",
					payment_status: "to_be_paid",
					rejection_reason: null,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
				SENSITIVE_REIMBURSEMENT_FIELDS,
			);

			const { data, error } = await getSupabase()
				.from("reimbursements")
				.insert(reimbursement)
				.select()
				.single();

			if (error) {
				request.log.error({ err: error }, "Failed to create reimbursement");
				throw createReimbursementDatabaseError(error);
			}

			try {
				await notifyFinanceOfReimbursementRequest({
					requestId: String((data as { id?: string }).id ?? ""),
					requesterUserId: user.id,
					requesterEmail: user.email ?? "",
					submissionType: body.submission_type,
					department: body.department.trim(),
					amount: body.amount,
					reviewUrl: buildFinanceReviewUrl(),
				});
			} catch (notificationError) {
				request.log.warn(
					{ err: notificationError, userId: user.id },
					"Failed to notify finance about reimbursement request",
				);
			}

			return reply
				.status(201)
				.send(withoutReceiptPayload(data as ReimbursementRow));
		},
	);
}
