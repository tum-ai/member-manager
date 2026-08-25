export interface OpenSignSigner {
	name: string;
	email: string;
}

export interface OpenSignDocumentRequest {
	name: string;
	pdf: Buffer;
	signer: OpenSignSigner;
	widgets?: unknown[];
	note?: string | null;
	description?: string | null;
	redirectUrl?: string | null;
}

export interface OpenSignDocumentResponse {
	documentId: string;
	status: string | null;
	fileUrl: string | null;
	raw: unknown;
}

function getOpenSignBaseUrl(): string {
	return (
		process.env.OPENSIGN_BASE_URL?.trim() ??
		"https://eu-app.opensignlabs.com/api/v1.2"
	).replace(/\/+$/, "");
}

function getOpenSignApiToken(): string {
	return process.env.OPENSIGN_API_TOKEN?.trim() ?? "";
}

const MAX_OPENSIGN_PDF_BYTES = 30 * 1024 * 1024;
const DEFAULT_OPENSIGN_FILE_HOSTS = ["legadratw3d.ams3.digitaloceanspaces.com"];

function getAllowedOpenSignFileHosts(): Set<string> {
	const hosts = new Set(DEFAULT_OPENSIGN_FILE_HOSTS);
	try {
		hosts.add(new URL(getOpenSignBaseUrl()).hostname.toLowerCase());
	} catch {
		// The normal API request reports an invalid base URL separately.
	}
	for (const host of process.env.OPENSIGN_FILE_HOSTS?.split(",") ?? []) {
		const normalized = host.trim().toLowerCase();
		if (normalized) hosts.add(normalized);
	}
	return hosts;
}

function assertAllowedOpenSignFileUrl(value: string): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error("OpenSign returned an invalid PDF URL");
	}
	if (
		(process.env.NODE_ENV === "production" && url.protocol !== "https:") ||
		!getAllowedOpenSignFileHosts().has(url.hostname.toLowerCase()) ||
		url.username ||
		url.password
	) {
		throw new Error("OpenSign returned an untrusted PDF URL");
	}
	return url;
}

async function readLimitedResponse(
	response: Response,
	maximumBytes: number,
): Promise<Buffer> {
	const declaredLength = Number(response.headers.get("content-length"));
	if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
		throw new Error("OpenSign PDF exceeds the safe size limit");
	}
	if (!response.body) throw new Error("OpenSign PDF response is empty");

	const chunks: Buffer[] = [];
	let size = 0;
	const reader = response.body.getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > maximumBytes) {
			await reader.cancel();
			throw new Error("OpenSign PDF exceeds the safe size limit");
		}
		chunks.push(Buffer.from(value));
	}
	return Buffer.concat(chunks);
}

export function isOpenSignConfigured(): boolean {
	return Boolean(getOpenSignApiToken());
}

function parseWidgetsOverride(): unknown[] | null {
	const raw = process.env.OPENSIGN_WIDGETS_JSON?.trim();
	if (!raw) return null;
	const parsed = JSON.parse(raw);
	if (!Array.isArray(parsed)) {
		throw new Error("OPENSIGN_WIDGETS_JSON must be a JSON array");
	}
	return parsed;
}

function defaultWidgets(): unknown[] {
	return [
		{
			type: "signature",
			page: 1,
			x: 360,
			y: 720,
			w: 150,
			h: 45,
			options: {
				hint: "Provide signature",
			},
		},
		{
			type: "date",
			page: 1,
			x: 360,
			y: 775,
			w: 110,
			h: 24,
			options: {
				name: "signing_date",
				readonly: true,
				signing_date: true,
				color: "black",
				fontsize: 12,
			},
		},
	];
}

function extractString(value: unknown, keys: string[]): string | null {
	if (typeof value !== "object" || value === null) return null;
	const record = value as Record<string, unknown>;
	for (const key of keys) {
		const current = record[key];
		if (typeof current === "string" && current.trim()) return current.trim();
	}
	return null;
}

function extractDocumentId(value: unknown): string {
	const direct = extractString(value, ["objectId", "id", "documentId"]);
	if (direct) return direct;
	if (typeof value === "object" && value !== null) {
		const record = value as Record<string, unknown>;
		for (const nested of ["data", "result", "document"]) {
			const nestedId = extractDocumentIdOrNull(record[nested]);
			if (nestedId) return nestedId;
		}
	}
	throw new Error("OpenSign response did not include a document id");
}

function extractDocumentIdOrNull(value: unknown): string | null {
	try {
		return extractDocumentId(value);
	} catch {
		return null;
	}
}

export async function sendOpenSignDocument(
	request: OpenSignDocumentRequest,
): Promise<OpenSignDocumentResponse> {
	const apiToken = getOpenSignApiToken();
	if (!apiToken) {
		throw new Error("OpenSign is not configured");
	}

	const payload = {
		name: request.name,
		file: `data:application/pdf;base64,${request.pdf.toString("base64")}`,
		note:
			request.note?.trim() ||
			"Please review and sign this contract in OpenSign.",
		description: request.description ?? "",
		redirect_url: request.redirectUrl ?? undefined,
		signers: [
			{
				name: request.signer.name,
				email: request.signer.email,
				widgets: request.widgets ?? parseWidgetsOverride() ?? defaultWidgets(),
			},
		],
		send_email: true,
		time_to_complete_days: 30,
	};

	const response = await fetch(`${getOpenSignBaseUrl()}/createdocument`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-token": apiToken,
		},
		body: JSON.stringify(payload),
	});

	const raw = await response.json().catch(() => null);
	if (!response.ok) {
		const message =
			extractString(raw, ["message", "error"]) ??
			`OpenSign request failed with ${response.status}`;
		throw new Error(message);
	}

	return {
		documentId: extractDocumentId(raw),
		status: extractString(raw, ["status", "event"]),
		fileUrl: extractString(raw, ["file", "fileUrl", "url"]),
		raw,
	};
}

export async function revokeOpenSignDocument(
	documentId: string,
): Promise<void> {
	const apiToken = getOpenSignApiToken();
	if (!apiToken) throw new Error("OpenSign is not configured");
	const response = await fetch(
		`${getOpenSignBaseUrl()}/document/${encodeURIComponent(documentId)}`,
		{
			method: "DELETE",
			headers: { "x-api-token": apiToken },
		},
	);
	if (response.ok || response.status === 404) return;
	const raw = await response.json().catch(() => null);
	throw new Error(
		extractString(raw, ["message", "error"]) ??
			`OpenSign revoke failed with ${response.status}`,
	);
}

export async function downloadOpenSignPdf(fileUrl: string): Promise<Buffer> {
	const url = assertAllowedOpenSignFileUrl(fileUrl);
	const response = await fetch(url, {
		method: "GET",
		signal: AbortSignal.timeout(20_000),
		redirect: "error",
	});
	if (!response.ok) {
		throw new Error(`OpenSign PDF download failed with ${response.status}`);
	}
	const pdf = await readLimitedResponse(response, MAX_OPENSIGN_PDF_BYTES);
	if (pdf.length < 5 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
		throw new Error("OpenSign returned an invalid PDF");
	}
	return pdf;
}
