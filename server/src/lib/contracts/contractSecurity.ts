import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function generateSignatureToken(): string {
	return randomBytes(32).toString("hex");
}

function trimTrailingSlashes(value: string): string {
	let end = value.length;
	while (end > 0 && value.charCodeAt(end - 1) === 47) {
		end -= 1;
	}
	return value.slice(0, end);
}

export function getAppBaseUrl(request: {
	headers: Record<string, unknown>;
}): string {
	const configured = process.env.APP_BASE_URL?.trim();
	if (configured) return trimTrailingSlashes(configured);
	const origin =
		typeof request.headers.origin === "string" ? request.headers.origin : "";
	if (origin) return trimTrailingSlashes(origin);
	return "http://localhost:5173";
}

export function verifyOpenSignWebhookSignature(
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

export function isOpenSignCompletedEvent(event: string): boolean {
	return ["completed", "document_completed", "complete"].includes(
		event.toLowerCase(),
	);
}

export function isOpenSignFailureEvent(event: string): boolean {
	return ["declined", "revoked", "expired", "voided"].includes(
		event.toLowerCase(),
	);
}
