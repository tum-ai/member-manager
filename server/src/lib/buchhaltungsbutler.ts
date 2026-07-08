import {
	sanitizeReceiptFilename,
	stripDataUrlPrefix,
} from "./receiptProcessing.js";

export const DEFAULT_BB_API_BASE_URL =
	"https://webapp.buchhaltungsbutler.de/api/v1";

export interface BuchhaltungsButlerCredentials {
	apiClient: string;
	apiSecret: string;
	apiKey: string;
	baseUrl: string;
}

interface BuchhaltungsButlerResponse {
	success?: boolean;
	message?: string;
	error_code?: number;
	[key: string]: unknown;
}

export interface UploadBuchhaltungsButlerReceiptInput {
	fileBase64: string;
	fileName: string;
	date: string;
	amount: number;
	type?:
		| "invoice inbound"
		| "invoice outbound"
		| "credit inbound"
		| "credit outbound";
	currency?: "EUR";
}

export interface UploadBuchhaltungsButlerReceiptResult {
	idByCustomer: string;
	filename: string | null;
}

export interface AddBuchhaltungsButlerCommentInput {
	receiptIdByCustomer: string;
	commentText: string;
}

export interface BuchhaltungsButlerSyncStatus {
	sync_enabled: boolean;
	configured: boolean;
	available: boolean;
	unavailable_reason: "disabled" | "missing_credentials" | null;
}

export class BuchhaltungsButlerConfigError extends Error {
	constructor(message = "BuchhaltungsButler sync is not configured") {
		super(message);
		this.name = "BuchhaltungsButlerConfigError";
	}
}

export class BuchhaltungsButlerApiError extends Error {
	readonly statusCode: number;
	readonly errorCode?: number;

	constructor({
		message,
		statusCode,
		errorCode,
	}: {
		message: string;
		statusCode: number;
		errorCode?: number;
	}) {
		super(message);
		this.name = "BuchhaltungsButlerApiError";
		this.statusCode = statusCode;
		this.errorCode = errorCode;
	}
}

export function isBuchhaltungsButlerSyncEnabled(): boolean {
	return process.env.BUCHHALTUNGSBUTLER_SYNC_ENABLED === "true";
}

export function getBuchhaltungsButlerSyncStatus(): BuchhaltungsButlerSyncStatus {
	const syncEnabled = isBuchhaltungsButlerSyncEnabled();
	const configured = Boolean(
		process.env.BUCHHALTUNGSBUTLER_API_CLIENT?.trim() &&
			process.env.BUCHHALTUNGSBUTLER_API_SECRET?.trim() &&
			process.env.BUCHHALTUNGSBUTLER_API_KEY?.trim(),
	);

	return {
		sync_enabled: syncEnabled,
		configured,
		available: syncEnabled && configured,
		unavailable_reason: !syncEnabled
			? "disabled"
			: configured
				? null
				: "missing_credentials",
	};
}

export function getBuchhaltungsButlerCredentials({
	requireSyncEnabled = true,
}: {
	requireSyncEnabled?: boolean;
} = {}): BuchhaltungsButlerCredentials {
	if (requireSyncEnabled && !isBuchhaltungsButlerSyncEnabled()) {
		throw new BuchhaltungsButlerConfigError(
			"BuchhaltungsButler sync is disabled",
		);
	}

	const apiClient = process.env.BUCHHALTUNGSBUTLER_API_CLIENT?.trim();
	const apiSecret = process.env.BUCHHALTUNGSBUTLER_API_SECRET?.trim();
	const apiKey = process.env.BUCHHALTUNGSBUTLER_API_KEY?.trim();

	if (!apiClient || !apiSecret || !apiKey) {
		throw new BuchhaltungsButlerConfigError();
	}

	return {
		apiClient,
		apiSecret,
		apiKey,
		baseUrl:
			process.env.BUCHHALTUNGSBUTLER_API_BASE_URL?.trim() ||
			DEFAULT_BB_API_BASE_URL,
	};
}

export function buildBuchhaltungsButlerAuthHeader(
	credentials: BuchhaltungsButlerCredentials,
): string {
	return `Basic ${Buffer.from(
		`${credentials.apiClient}:${credentials.apiSecret}`,
	).toString("base64")}`;
}

export function normalizeBuchhaltungsButlerEndpoint(
	baseUrl: string,
	path: string,
): string {
	return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function normalizeFileName(value: string): string {
	return sanitizeReceiptFilename(value) || "receipt.pdf";
}

function formatCurrencyAmount(value: number): string {
	return (Math.round(value * 100) / 100).toFixed(2);
}

function getResponseMessage(payload: BuchhaltungsButlerResponse): string {
	return String(
		payload.message || payload.error || "BuchhaltungsButler request failed",
	);
}

async function requestBuchhaltungsButler<T extends BuchhaltungsButlerResponse>(
	path: string,
	fields: Record<string, string>,
): Promise<T> {
	const credentials = getBuchhaltungsButlerCredentials();
	const response = await fetch(
		normalizeBuchhaltungsButlerEndpoint(credentials.baseUrl, path),
		{
			method: "POST",
			headers: {
				Authorization: buildBuchhaltungsButlerAuthHeader(credentials),
				"content-type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				api_key: credentials.apiKey,
				...fields,
			}),
		},
	);

	let payload: BuchhaltungsButlerResponse;
	try {
		payload = (await response.json()) as BuchhaltungsButlerResponse;
	} catch {
		payload = {
			success: false,
			message: `BuchhaltungsButler returned ${response.status}`,
		};
	}

	if (!response.ok || payload.success === false) {
		throw new BuchhaltungsButlerApiError({
			message: getResponseMessage(payload),
			statusCode: response.status,
			errorCode:
				typeof payload.error_code === "number" ? payload.error_code : undefined,
		});
	}

	return payload as T;
}

export async function uploadBuchhaltungsButlerReceipt(
	input: UploadBuchhaltungsButlerReceiptInput,
): Promise<UploadBuchhaltungsButlerReceiptResult> {
	const payload = await requestBuchhaltungsButler<{
		success: true;
		id_by_customer?: string | number;
		filename?: string | null;
	}>("/receipts/upload", {
		file: stripDataUrlPrefix(input.fileBase64),
		file_name: normalizeFileName(input.fileName),
		type: input.type ?? "invoice inbound",
		date: input.date,
		amount: formatCurrencyAmount(input.amount),
		currency: input.currency ?? "EUR",
	});

	const idByCustomer = String(payload.id_by_customer ?? "").trim();
	if (!idByCustomer) {
		throw new BuchhaltungsButlerApiError({
			message: "BuchhaltungsButler did not return receipt id_by_customer",
			statusCode: 502,
		});
	}

	return {
		idByCustomer,
		filename:
			typeof payload.filename === "string" && payload.filename.trim()
				? payload.filename.trim()
				: null,
	};
}

export async function addBuchhaltungsButlerReceiptComment(
	input: AddBuchhaltungsButlerCommentInput,
): Promise<void> {
	await requestBuchhaltungsButler("/comments/add", {
		receipt_id_by_customer: input.receiptIdByCustomer,
		comment_text: input.commentText.slice(0, 210),
	});
}
