export interface OpenSignSigner {
	name: string;
	email: string;
}

export interface OpenSignDocumentRequest {
	name: string;
	pdf: Buffer;
	signer: OpenSignSigner;
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
				widgets: parseWidgetsOverride() ?? defaultWidgets(),
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
