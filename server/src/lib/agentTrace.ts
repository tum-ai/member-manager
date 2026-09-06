import {
	type SanitizedAgentTrace,
	sanitizedAgentTraceSchema,
} from "@member-manager/shared";
import {
	SENSITIVE_MEMBER_FIELDS,
	SENSITIVE_REIMBURSEMENT_FIELDS,
	SENSITIVE_SEPA_FIELDS,
} from "./sensitiveData.js";

/** Hard limits for the JSON value persisted in `beacon_agent_log.trace`. */
export const AGENT_TRACE_LIMITS = {
	maxDepth: 8,
	maxItems: 50,
	maxObjectKeys: 50,
	maxStringLength: 4_000,
	maxSerializedBytes: 64 * 1_024,
} as const;

const REDACTED = "[redacted]";
const TRUNCATED = "[truncated]";

const normalizeKey = (key: string): string =>
	key.toLowerCase().replace(/[^a-z0-9]/g, "");

const SENSITIVE_KEYS = new Set(
	[
		...SENSITIVE_MEMBER_FIELDS,
		...SENSITIVE_SEPA_FIELDS,
		...SENSITIVE_REIMBURSEMENT_FIELDS,
		"address",
		"address_line_1",
		"address_line_2",
		"birth_date",
		"date_of_birth",
		"dob",
		"mobile",
		"mobile_phone",
		"phone_number",
		"telephone",
	].map(normalizeKey),
);

const UNSAFE_OUTPUT_KEYS = new Set(
	[
		"error",
		"cause",
		"stack",
		"result",
		"output",
		"raw_output",
		"response_body",
		"tool_output",
		"tool_result",
	].map(normalizeKey),
);

const isSensitiveKey = (key: string): boolean => {
	const normalized = normalizeKey(key);
	return (
		SENSITIVE_KEYS.has(normalized) ||
		normalized.includes("iban") ||
		normalized.includes("bankaccount") ||
		normalized.endsWith("bic") ||
		normalized.includes("dateofbirth") ||
		normalized.endsWith("dob") ||
		normalized.includes("phone") ||
		normalized.includes("telephone") ||
		normalized.includes("postaladdress") ||
		normalized.includes("streetaddress")
	);
};

const truncateString = (value: string): string =>
	value.length <= AGENT_TRACE_LIMITS.maxStringLength
		? value
		: `${value.slice(0, AGENT_TRACE_LIMITS.maxStringLength)}${TRUNCATED}`;

// Redact high-confidence secrets that may have been interpolated into prose
// rather than retained under a sensitive field name.
const redactInlineSecrets = (value: string): string =>
	truncateString(value)
		.replace(/\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]){11,30}\b/giu, REDACTED)
		.replace(/\+\d(?:[\s().-]*\d){6,14}\b/g, REDACTED);

function sanitizeValue(
	value: unknown,
	depth: number,
	seen: WeakSet<object>,
): unknown {
	if (value === null || typeof value === "boolean") return value;
	if (typeof value === "string") return redactInlineSecrets(value);
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "bigint") return value.toString();
	if (typeof value !== "object") return undefined;
	if (depth >= AGENT_TRACE_LIMITS.maxDepth) return TRUNCATED;
	if (seen.has(value)) return "[circular]";
	seen.add(value);

	if (value instanceof Date) return value.toISOString();
	if (value instanceof Error) return REDACTED;
	if (Array.isArray(value)) {
		return value
			.slice(0, AGENT_TRACE_LIMITS.maxItems)
			.map((item) => sanitizeValue(item, depth + 1, seen) ?? null);
	}

	const sanitized: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value).slice(
		0,
		AGENT_TRACE_LIMITS.maxObjectKeys,
	)) {
		const normalized = normalizeKey(key);
		if (isSensitiveKey(key) || UNSAFE_OUTPUT_KEYS.has(normalized)) continue;
		const safeChild = sanitizeValue(child, depth + 1, seen);
		if (safeChild !== undefined) sanitized[key] = safeChild;
	}
	return sanitized;
}

/**
 * Produce a JSON-safe, bounded trace for persistence.
 *
 * Tool output and sensitive member fields are omitted recursively. Oversized
 * sanitized traces are replaced with a small marker rather than risking a
 * partial JSON document or an unbounded admin-log row.
 */
export function sanitizeAgentTrace(trace: unknown): SanitizedAgentTrace {
	const sanitized = sanitizeValue(trace, 0, new WeakSet<object>());
	const value = sanitized ?? null;
	if (
		Buffer.byteLength(JSON.stringify(value), "utf8") <=
		AGENT_TRACE_LIMITS.maxSerializedBytes
	) {
		return sanitizedAgentTraceSchema.parse(value);
	}
	return sanitizedAgentTraceSchema.parse({
		truncated: true,
		reason: "agent trace exceeded persistence limit",
	});
}
