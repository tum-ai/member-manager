import assert from "node:assert";
import { describe, test } from "node:test";
import { BadGatewayError } from "../../src/lib/errors.js";
import type { fetchWithTimeout } from "../../src/lib/fetchWithTimeout.js";
import {
	type ExtractReceiptFieldsInput,
	extractReceiptFields,
	normalizeExtractedReceipt,
	RECEIPT_EXTRACTION_FAILED_MESSAGE,
	RECEIPT_MODEL,
} from "../../src/lib/receiptExtraction.js";

const NOW = new Date("2026-11-27T12:00:00Z");
const VALID_IBAN = "DE89370400440532013000";

interface LoggedLine {
	level: "info" | "warn";
	details: Record<string, unknown>;
	message: string;
}

function createLog(): {
	lines: LoggedLine[];
	log: ExtractReceiptFieldsInput["log"];
} {
	const lines: LoggedLine[] = [];
	return {
		lines,
		log: {
			info: (details, message) =>
				lines.push({ level: "info", details, message }),
			warn: (details, message) =>
				lines.push({ level: "warn", details, message }),
		},
	};
}

function modelResponse(content: unknown, status = 200): Response {
	return new Response(
		JSON.stringify({
			choices: [
				{
					message: {
						content:
							typeof content === "string" ? content : JSON.stringify(content),
					},
				},
			],
		}),
		{ status, headers: { "content-type": "application/json" } },
	);
}

function stubFetch(
	respond: (body: Record<string, unknown>) => Response | Promise<Response>,
): typeof fetchWithTimeout {
	return async (_input, init) =>
		respond(JSON.parse(String(init?.body)) as Record<string, unknown>);
}

async function extract(
	fetchImpl: typeof fetchWithTimeout,
	overrides: Partial<ExtractReceiptFieldsInput> = {},
) {
	const { lines, log } = createLog();
	const result = await extractReceiptFields({
		base64: "JVBERi0xLjQ=",
		mimeType: "application/pdf",
		filename: "invoice.pdf",
		apiKey: "test-key",
		log,
		fetchImpl,
		now: NOW,
		...overrides,
	});
	return { result, lines };
}

describe("normalizeExtractedReceipt", () => {
	test("keeps plausible values and normalizes their format", () => {
		assert.deepStrictEqual(
			normalizeExtractedReceipt(
				{
					amount: "42,505",
					currency: "eur",
					date: "2026-11-20",
					description: "  Workshop snacks ",
					payment_iban: "IBAN: DE89 3704 0044 0532 0130 00",
					payment_bic: "BIC cobadeffxxx",
				},
				NOW,
			),
			{
				amount: 42.51,
				currency: "EUR",
				date: "2026-11-20",
				description: "Workshop snacks",
				payment_iban: VALID_IBAN,
				payment_bic: "COBADEFFXXX",
			},
		);
	});

	test("rounds float noise in the amount to cents", () => {
		assert.strictEqual(
			normalizeExtractedReceipt({ amount: 12.499999 }, NOW).amount,
			12.5,
		);
	});

	test("drops non-positive and non-numeric amounts", () => {
		for (const amount of [0, -5, "abc", null, Number.NaN]) {
			assert.strictEqual(
				normalizeExtractedReceipt({ amount }, NOW).amount,
				null,
				JSON.stringify(amount),
			);
		}
	});

	test("maps euro spellings to EUR", () => {
		for (const currency of ["€", "Euro", "eur"]) {
			const parsed = normalizeExtractedReceipt({ amount: 10, currency }, NOW);
			assert.strictEqual(parsed.currency, "EUR", currency);
			assert.strictEqual(parsed.amount, 10, currency);
		}
	});

	test("keeps the amount when no currency is printed", () => {
		const parsed = normalizeExtractedReceipt(
			{ amount: 10, currency: null },
			NOW,
		);
		assert.strictEqual(parsed.currency, null);
		assert.strictEqual(parsed.amount, 10);
	});

	test("drops the amount next to a currency it cannot name", () => {
		// A null currency would let the client prefill "US$ 30" as 30 EUR.
		for (const currency of ["US$", "$", "EU"]) {
			const parsed = normalizeExtractedReceipt({ amount: 30, currency }, NOW);
			assert.strictEqual(parsed.currency, null, currency);
			assert.strictEqual(parsed.amount, null, currency);
		}
	});

	test("drops dates in the future or older than two years", () => {
		assert.strictEqual(
			normalizeExtractedReceipt({ date: "2026-11-28" }, NOW).date,
			"2026-11-28",
			"tomorrow is allowed for time zones",
		);
		for (const date of [
			"2026-12-01",
			"2024-11-01",
			"2026-02-30",
			"20.11.2026",
		]) {
			assert.strictEqual(
				normalizeExtractedReceipt({ date }, NOW).date,
				null,
				date,
			);
		}
	});

	test("drops an IBAN that fails the checksum and a malformed BIC", () => {
		const parsed = normalizeExtractedReceipt(
			{ payment_iban: "DE89 3704 0044 0532 0130 01", payment_bic: "COBADE" },
			NOW,
		);
		assert.strictEqual(parsed.payment_iban, null);
		assert.strictEqual(parsed.payment_bic, null);
	});

	test("treats missing fields as null", () => {
		assert.deepStrictEqual(normalizeExtractedReceipt({}, NOW), {
			amount: null,
			currency: null,
			date: null,
			description: null,
			payment_iban: null,
			payment_bic: null,
		});
	});
});

describe("extractReceiptFields", () => {
	test("requests strict structured output from the receipt model", async () => {
		let requestBody: Record<string, unknown> = {};
		await extract(
			stubFetch((body) => {
				requestBody = body;
				return modelResponse({});
			}),
		);

		assert.strictEqual(requestBody.model, RECEIPT_MODEL);
		const format = requestBody.response_format as {
			type: string;
			json_schema: { strict: boolean; schema: { required: string[] } };
		};
		assert.strictEqual(format.type, "json_schema");
		assert.strictEqual(format.json_schema.strict, true);
		assert.deepStrictEqual(format.json_schema.schema.required, [
			"amount",
			"currency",
			"date",
			"description",
			"payment_iban",
			"payment_bic",
		]);
	});

	test("sends a PDF as a file part and an image as an image part", async () => {
		const parts: Array<Record<string, unknown>> = [];
		const fetchImpl = stubFetch((body) => {
			const messages = body.messages as Array<{
				content: Array<Record<string, unknown>>;
			}>;
			parts.push(messages[0].content[1]);
			return modelResponse({});
		});

		await extract(fetchImpl);
		await extract(fetchImpl, { mimeType: "image/png", filename: "r.png" });

		assert.deepStrictEqual(parts[0], {
			type: "file",
			file: {
				filename: "invoice.pdf",
				file_data: "data:application/pdf;base64,JVBERi0xLjQ=",
			},
		});
		assert.deepStrictEqual(parts[1], {
			type: "image_url",
			image_url: { url: "data:image/png;base64,JVBERi0xLjQ=" },
		});
	});

	test("returns validated fields and logs which ones are missing, never their values", async () => {
		const { result, lines } = await extract(
			stubFetch(() =>
				modelResponse({
					amount: 119,
					currency: "EUR",
					date: "2026-11-14",
					description: "Catering",
					payment_iban: VALID_IBAN,
					payment_bic: null,
				}),
			),
		);

		assert.strictEqual(result.amount, 119);
		assert.strictEqual(result.payment_iban, VALID_IBAN);
		const info = lines.find((line) => line.level === "info");
		assert.ok(info, "expected a summary log line");
		assert.deepStrictEqual(info.details.missingFields, ["payment_bic"]);
		assert.strictEqual(info.details.model, RECEIPT_MODEL);
		const logged = JSON.stringify(lines);
		assert.ok(!logged.includes(VALID_IBAN), "IBAN must not be logged");
		assert.ok(!logged.includes("119"), "amount must not be logged");
		assert.ok(!logged.includes("Catering"), "description must not be logged");
	});

	test("throws BadGatewayError when the request fails or times out", async () => {
		await assert.rejects(
			extract(async () => {
				throw new DOMException("The operation was aborted.", "AbortError");
			}),
			(error) =>
				error instanceof BadGatewayError &&
				error.message === RECEIPT_EXTRACTION_FAILED_MESSAGE,
		);
	});

	test("throws BadGatewayError on a provider error status", async () => {
		const { lines, log } = createLog();
		await assert.rejects(
			extractReceiptFields({
				base64: "JVBERi0xLjQ=",
				mimeType: "application/pdf",
				filename: "invoice.pdf",
				apiKey: "test-key",
				log,
				now: NOW,
				fetchImpl: async () =>
					new Response('{"error":{"message":"bad param"}}', { status: 400 }),
			}),
			BadGatewayError,
		);
		assert.strictEqual(lines[0]?.details.status, 400);
	});

	test("throws BadGatewayError on empty or non-object model output", async () => {
		for (const content of ["", "not json", "[1,2]", "null"]) {
			await assert.rejects(
				extract(stubFetch(() => modelResponse(content))),
				BadGatewayError,
				JSON.stringify(content),
			);
		}
	});
});
