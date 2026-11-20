export interface JsonErrorDetails {
	message: string;
	/** The parsed JSON error body, when the response had one. */
	body?: Record<string, unknown>;
}

/**
 * Reads the error out of a failed response: the human message plus the parsed
 * JSON body (so callers can react to fields like `code` or `current`).
 */
export async function readJsonErrorDetails(
	response: Response,
	fallbackMessage = response.statusText || "Request failed",
): Promise<JsonErrorDetails> {
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		return { message: fallbackMessage };
	}

	try {
		const body = (await response.json()) as Record<string, unknown> | null;
		if (body && typeof body === "object") {
			if (typeof body.error === "string") return { message: body.error, body };
			if (typeof body.message === "string") {
				return { message: body.message, body };
			}
			return { message: fallbackMessage, body };
		}
	} catch {
		// Fall through to the original HTTP status when the server sends
		// malformed or empty JSON despite the application/json content type.
	}

	return { message: fallbackMessage };
}

export async function readJsonErrorMessage(
	response: Response,
	fallbackMessage = response.statusText || "Request failed",
): Promise<string> {
	return (await readJsonErrorDetails(response, fallbackMessage)).message;
}
