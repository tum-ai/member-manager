import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";
import { AppError, ValidationError } from "../lib/errors.js";

/**
 * Formats Zod validation errors into user-friendly messages.
 * Special handling for specific field errors (e.g., IBAN).
 */
function formatZodError(error: ZodError): { message: string; details?: unknown } {
  // Check for IBAN-specific error
  const ibanError = error.issues.find((issue) => issue.path.includes("iban"));
  if (ibanError) {
    return { message: "Invalid IBAN. Please check your IBAN and try again." };
  }

  // Check for email-specific error
  const emailError = error.issues.find((issue) => issue.path.includes("email"));
  if (emailError) {
    return { message: "Invalid email address." };
  }

  // Default: return generic validation error with details
  return {
    message: "Validation Error",
    details: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}

/**
 * Global error handler plugin for Fastify.
 * Catches all errors and returns consistent JSON responses.
 */
async function errorHandlerPlugin(server: FastifyInstance) {
  server.setErrorHandler(
    (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
      // Handle Zod validation errors
      if (error instanceof ZodError) {
        const formatted = formatZodError(error);
        const response: { error: string; details?: unknown } = {
          error: formatted.message,
        };
        if (formatted.details) {
          response.details = formatted.details;
        }
        return reply.status(400).send(response);
      }

      // Handle custom application errors
      if (error instanceof AppError) {
        const response: { error: string; details?: unknown } = {
          error: error.message,
        };

        if (error instanceof ValidationError && error.details) {
          response.details = error.details;
        }

        return reply.status(error.statusCode).send(response);
      }

      // Handle Fastify errors (e.g., 404 from route not found)
      if ("statusCode" in error && typeof error.statusCode === "number") {
        return reply.status(error.statusCode).send({
          error: error.message || "An error occurred",
        });
      }

      // Log unexpected errors
      server.log.error(error);

      // Return generic 500 for unexpected errors (don't leak internal details)
      return reply.status(500).send({
        error: "Internal Server Error",
      });
    }
  );
}

export default fp(errorHandlerPlugin, {
  name: "error-handler",
});
