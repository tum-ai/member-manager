import {
	cleanIbanInput,
	isValidIban,
	normalizeBic,
	type ParsedReimbursementReceipt,
} from "@member-manager/shared";
import { BadGatewayError } from "./errors.js";
import { fetchWithTimeout } from "./fetchWithTimeout.js";

const OPENAI_CHAT_COMPLETIONS_URL =
	"https://api.openai.com/v1/chat/completions";

/**
 * Model for every receipt call (field extraction and the filename word in
 * `receiptProcessing.ts`). `gpt-4o-mini` shuts down on 2027-01-14 per OpenAI's
 * deprecations page, which names `gpt-6-luna` as its replacement.
 */
export const RECEIPT_MODEL = "gpt-6-luna";

// Vision/document extraction on a receipt or multi-page invoice routinely takes
// longer than the default external-fetch timeout; a short timeout here reliably
// aborts the request before OpenAI responds.
export const RECEIPT_PARSE_TIMEOUT_MS = 45_000;

/**
 * Reasons the member sees in the extraction-failed toast. The client wraps
 * them in "automatic extraction failed: <reason> Fill the fields manually.",
 * so they state only the reason (#416 showed the instruction twice).
 */
export const RECEIPT_EXTRACTION_FAILED_MESSAGE =
	"The extraction service is unavailable.";
const RECEIPT_EXTRACTION_EMPTY_MESSAGE = "Receipt extraction returned no data.";
const RECEIPT_EXTRACTION_UNREADABLE_MESSAGE =
	"Receipt extraction returned unreadable data.";

export const RECEIPT_PARSE_PROMPT = `Analyze this receipt or invoice and extract:
- amount: the gross total actually charged (including VAT, tips and fees), as a number without currency symbols. Not a subtotal or net amount.
- currency: ISO 4217 code of that total, e.g. "EUR", "USD", "CHF".
- date: the receipt or invoice issue date in YYYY-MM-DD format. Not a due date, delivery date or service period.
- description: concise merchant/vendor and purchase description
- payment_iban: IBAN of the account this invoice should be paid to, i.e. the payee (vendor or issuer). Ignore the customer's or buyer's own IBAN, such as one printed for a SEPA direct debit. Return only the IBAN itself, without an "IBAN" label.
- payment_bic: BIC/SWIFT of that payee account

If a field cannot be determined, use null. Never guess a value that is not printed on the document.`;

const RECEIPT_FIELD_NAMES = [
	"amount",
	"currency",
	"date",
	"description",
	"payment_iban",
	"payment_bic",
] as const;

function nullable(type: "number" | "string") {
	return { type: [type, "null"] };
}

/**
 * Structured-output schema: OpenAI's strict mode requires every property to be
 * listed in `required`, so "not found" is expressed as null, never omission.
 */
const RECEIPT_FIELDS_RESPONSE_FORMAT = {
	type: "json_schema",
	json_schema: {
		name: "receipt_fields",
		strict: true,
		schema: {
			type: "object",
			additionalProperties: false,
			required: RECEIPT_FIELD_NAMES,
			properties: {
				amount: nullable("number"),
				currency: nullable("string"),
				date: nullable("string"),
				description: nullable("string"),
				payment_iban: nullable("string"),
				payment_bic: nullable("string"),
			},
		},
	},
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
// A receipt dated later than tomorrow is a misread (tomorrow allows for time
// zones). Older than two years is past any realistic reimbursement deadline,
// so such a date is far more likely a misread year than a real receipt.
const MAX_FUTURE_DATE_MS = DAY_MS;
const MAX_RECEIPT_AGE_MS = 2 * 366 * DAY_MS;

interface ReceiptExtractionLogger {
	info: (details: Record<string, unknown>, message: string) => void;
	warn: (details: Record<string, unknown>, message: string) => void;
}

export interface ExtractReceiptFieldsInput {
	/** Raw base64 file content, without a `data:` URL prefix. */
	base64: string;
	mimeType: string;
	filename: string;
	apiKey: string;
	log: ReceiptExtractionLogger;
	fetchImpl?: typeof fetchWithTimeout;
	now?: Date;
}

function normalizeMaybeString(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function normalizeMaybeAmount(value: unknown): number | null {
	const parsed =
		typeof value === "number"
			? value
			: typeof value === "string"
				? Number.parseFloat(value.replace(",", "."))
				: Number.NaN;
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return null;
	}
	// Cents are the smallest unit the form accepts; float noise from the model
	// ("12.499999") must not reach it.
	return Math.round(parsed * 100) / 100;
}

// Spellings of the euro the model may return despite the ISO instruction.
const EURO_SPELLINGS = new Set(["€", "EURO", "EUROS"]);

type ParsedCurrency =
	| { kind: "none" }
	| { kind: "code"; code: string }
	| { kind: "unrecognized" };

/**
 * Separates "no currency printed" from "a currency we cannot name": the form
 * only takes EUR, so an amount next to an unrecognized currency (say "US$")
 * must not be prefilled as if it were euros.
 */
function parseCurrency(value: unknown): ParsedCurrency {
	const raw = normalizeMaybeString(value)?.toUpperCase();
	if (!raw) {
		return { kind: "none" };
	}
	if (EURO_SPELLINGS.has(raw)) {
		return { kind: "code", code: "EUR" };
	}
	return /^[A-Z]{3}$/u.test(raw)
		? { kind: "code", code: raw }
		: { kind: "unrecognized" };
}

function normalizeMaybeDate(value: unknown, now: Date): string | null {
	const raw = normalizeMaybeString(value);
	if (!raw || !/^\d{4}-\d{2}-\d{2}$/u.test(raw)) {
		return null;
	}

	const date = new Date(`${raw}T00:00:00Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
		return null;
	}

	const offset = date.getTime() - now.getTime();
	if (offset > MAX_FUTURE_DATE_MS || offset < -MAX_RECEIPT_AGE_MS) {
		return null;
	}
	return raw;
}

/**
 * Reduces the model's `payment_iban` to a checksum-valid electronic IBAN, or
 * null. The model regularly adds an "IBAN:" label, dashes, or lowercase, and
 * can misread a digit; passing such a value through would prefill the form
 * with an IBAN that only fails later, at submit.
 */
function normalizeParsedIban(value: unknown): string | null {
	const raw = normalizeMaybeString(value);
	if (!raw) {
		return null;
	}

	const iban = cleanIbanInput(raw);
	return isValidIban(iban) ? iban : null;
}

function normalizeParsedBic(value: unknown): string | null {
	const raw = normalizeMaybeString(value);
	return raw ? normalizeBic(raw) : null;
}

/**
 * The model only suggests values; this is the deterministic check every field
 * passes before it can prefill the form. Anything implausible becomes null so
 * the member types it instead of submitting a misread.
 */
export function normalizeExtractedReceipt(
	raw: Record<string, unknown>,
	now: Date,
): ParsedReimbursementReceipt {
	const currency = parseCurrency(raw.currency);
	return {
		amount:
			currency.kind === "unrecognized"
				? null
				: normalizeMaybeAmount(raw.amount),
		currency: currency.kind === "code" ? currency.code : null,
		currency_unrecognized: currency.kind === "unrecognized",
		date: normalizeMaybeDate(raw.date, now),
		description: normalizeMaybeString(raw.description),
		payment_iban: normalizeParsedIban(raw.payment_iban),
		payment_bic: normalizeParsedBic(raw.payment_bic),
	};
}

function buildDocumentPart(
	base64: string,
	mimeType: string,
	filename: string,
): Record<string, unknown> {
	const dataUrl = `data:${mimeType};base64,${base64}`;
	if (mimeType === "application/pdf") {
		return { type: "file", file: { filename, file_data: dataUrl } };
	}
	return { type: "image_url", image_url: { url: dataUrl } };
}

function parseModelJson(content: string): Record<string, unknown> | null {
	try {
		const parsed: unknown = JSON.parse(content);
		return typeof parsed === "object" &&
			parsed !== null &&
			!Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

/**
 * Asks the model for the reimbursement fields on a receipt and returns them
 * validated. Throws `BadGatewayError` when the provider fails or answers with
 * something unusable; the client shows its message in the "fill the fields
 * manually" toast.
 *
 * Logs one line per call with which fields came back empty, but never a field
 * value: amounts, IBANs and BICs on a receipt are member payment data.
 */
export async function extractReceiptFields({
	base64,
	mimeType,
	filename,
	apiKey,
	log,
	fetchImpl = fetchWithTimeout,
	now = new Date(),
}: ExtractReceiptFieldsInput): Promise<ParsedReimbursementReceipt> {
	const startedAt = Date.now();
	let response: Response;
	try {
		response = await fetchImpl(
			OPENAI_CHAT_COMPLETIONS_URL,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: RECEIPT_MODEL,
					// Reading printed fields needs no chain of thought; reasoning
					// tokens would only add latency and cost.
					reasoning_effort: "none",
					max_completion_tokens: 500,
					messages: [
						{
							role: "user",
							content: [
								{ type: "text", text: RECEIPT_PARSE_PROMPT },
								buildDocumentPart(base64, mimeType, filename),
							],
						},
					],
					response_format: RECEIPT_FIELDS_RESPONSE_FORMAT,
				}),
			},
			RECEIPT_PARSE_TIMEOUT_MS,
		);
	} catch (error) {
		log.warn({ err: error }, "OpenAI receipt extraction request failed");
		throw new BadGatewayError(RECEIPT_EXTRACTION_FAILED_MESSAGE);
	}

	if (!response.ok) {
		// The error body describes the request, not the receipt, so it is safe
		// to log and is the only clue when OpenAI rejects a parameter.
		const errorText = await response.text();
		log.warn(
			{ status: response.status, errorText },
			"OpenAI receipt extraction failed",
		);
		throw new BadGatewayError(RECEIPT_EXTRACTION_FAILED_MESSAGE);
	}

	const result = (await response.json()) as {
		choices?: Array<{ message?: { content?: string | null } }>;
	};
	const content = result.choices?.[0]?.message?.content;
	if (!content) {
		throw new BadGatewayError(RECEIPT_EXTRACTION_EMPTY_MESSAGE);
	}

	const raw = parseModelJson(content);
	if (!raw) {
		log.warn({}, "OpenAI receipt extraction returned non-object JSON");
		throw new BadGatewayError(RECEIPT_EXTRACTION_UNREADABLE_MESSAGE);
	}

	const parsed = normalizeExtractedReceipt(raw, now);
	log.info(
		{
			model: RECEIPT_MODEL,
			mimeType,
			latencyMs: Date.now() - startedAt,
			currency: parsed.currency,
			currencyUnrecognized: parsed.currency_unrecognized,
			missingFields: RECEIPT_FIELD_NAMES.filter(
				(field) => parsed[field] === null,
			),
		},
		"Receipt extraction finished",
	);
	return parsed;
}
