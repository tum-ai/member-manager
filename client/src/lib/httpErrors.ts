export async function readJsonErrorMessage(
	response: Response,
	fallbackMessage = response.statusText || "Request failed",
): Promise<string> {
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		return fallbackMessage;
	}

	try {
		const errorData = (await response.json()) as {
			error?: unknown;
			message?: unknown;
		};
		if (typeof errorData.error === "string") return errorData.error;
		if (typeof errorData.message === "string") return errorData.message;
	} catch {
		// Fall through to the original HTTP status when the server sends
		// malformed or empty JSON despite the application/json content type.
	}

	return fallbackMessage;
}
