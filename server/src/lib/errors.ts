/**
 * Custom error classes for consistent API error handling.
 * These errors are caught by the global error handler and converted to appropriate HTTP responses.
 */

export class AppError extends Error {
	public readonly statusCode: number;
	public readonly isOperational: boolean;

	constructor(message: string, statusCode: number, isOperational = true) {
		super(message);
		this.statusCode = statusCode;
		this.isOperational = isOperational;
		Object.setPrototypeOf(this, new.target.prototype);
		Error.captureStackTrace(this, this.constructor);
	}
}

export class ValidationError extends AppError {
	public readonly details?: unknown;

	constructor(message: string, details?: unknown) {
		super(message, 400);
		this.details = details;
	}
}

export class NotFoundError extends AppError {
	constructor(message = "Resource not found") {
		super(message, 404);
	}
}

export class ForbiddenError extends AppError {
	constructor(message = "Access denied") {
		super(message, 403);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = "Authentication required") {
		super(message, 401);
	}
}

export class ConflictError extends AppError {
	constructor(message = "Resource already exists") {
		super(message, 409);
	}
}

export class DatabaseError extends AppError {
	constructor(message = "A database error occurred") {
		super(message, 500);
	}
}

export class BadGatewayError extends AppError {
	constructor(message = "An upstream service returned an invalid response") {
		super(message, 502);
	}
}

export class ServiceUnavailableError extends AppError {
	constructor(message = "A required service is not configured") {
		super(message, 503);
	}
}

/**
 * Helper to check if an error is a Supabase "not found" error (PGRST116)
 */
export function isNotFoundError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code: string }).code === "PGRST116"
	);
}
