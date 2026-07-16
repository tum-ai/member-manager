import { z } from "zod";
import {
	BadGatewayError,
	ConflictError,
	NotFoundError,
	ServiceUnavailableError,
	ValidationError,
} from "./errors.js";

interface PartnerPortalConfig {
	origin: string;
	token: string;
}

interface PartnerPortalRequestOptions {
	method?: "GET" | "POST" | "PATCH" | "DELETE";
	body?: unknown;
	actorId?: string;
}

const partnerPortalErrorSchema = z.object({
	error: z.union([
		z.string(),
		z.object({
			code: z.string(),
			message: z.string(),
		}),
	]),
});

export function getPartnerPortalConfig(): PartnerPortalConfig | null {
	const urlValue =
		process.env.PARTNER_PORTAL_API_URL?.trim() ||
		process.env.PARTNER_PORTAL_JOBS_API_URL?.trim();
	const token =
		process.env.PARTNER_PORTAL_API_TOKEN?.trim() ||
		process.env.PARTNER_PORTAL_JOBS_API_TOKEN?.trim();
	if (!urlValue || !token) return null;

	let url: URL;
	try {
		url = new URL(urlValue);
	} catch {
		return null;
	}
	if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
		return null;
	}
	return { origin: url.origin, token };
}

function upstreamMessage(payload: unknown): string | null {
	const parsed = partnerPortalErrorSchema.safeParse(payload);
	if (!parsed.success || typeof parsed.data.error === "string") return null;
	return parsed.data.error.message;
}

function throwPartnerPortalError(status: number, payload: unknown): never {
	const message = upstreamMessage(payload);
	if (status === 400) {
		throw new ValidationError(message ?? "Partner data is invalid");
	}
	if (status === 404) {
		throw new NotFoundError(message ?? "Partner not found");
	}
	if (status === 409) {
		throw new ConflictError(
			message ?? "Partner update conflicts with current data",
		);
	}
	throw new BadGatewayError("Partner Portal request failed");
}

export async function requestPartnerPortal<T>(
	path: string,
	schema: z.ZodType<T>,
	options: PartnerPortalRequestOptions = {},
): Promise<T> {
	const config = getPartnerPortalConfig();
	if (!config) {
		throw new ServiceUnavailableError("Partner Portal is not configured");
	}

	let response: Response;
	try {
		response = await fetch(new URL(path, config.origin), {
			method: options.method ?? "GET",
			headers: {
				Authorization: `Bearer ${config.token}`,
				...(options.body === undefined
					? {}
					: { "Content-Type": "application/json" }),
				...(options.actorId
					? { "X-Member-Manager-User-Id": options.actorId }
					: {}),
			},
			body:
				options.body === undefined ? undefined : JSON.stringify(options.body),
			signal: AbortSignal.timeout(10_000),
		});
	} catch {
		throw new BadGatewayError("Partner Portal is unavailable");
	}

	const payload = await response.json().catch(() => null);
	if (!response.ok) {
		throwPartnerPortalError(response.status, payload);
	}

	const parsed = z.object({ data: schema }).safeParse(payload);
	if (!parsed.success) {
		throw new BadGatewayError("Partner Portal returned invalid data");
	}
	return parsed.data.data;
}
