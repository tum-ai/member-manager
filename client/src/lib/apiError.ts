/** A failed API call. Still an `Error` with the server's message. */
export class ApiError extends Error {
	readonly status: number;
	/** The parsed JSON error body, when the response had one. */
	readonly body: Record<string, unknown> | undefined;

	constructor(message: string, status: number, body?: Record<string, unknown>) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.body = body;
	}
}

export function isApiError(error: unknown): error is ApiError {
	return error instanceof ApiError;
}
