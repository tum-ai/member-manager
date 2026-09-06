const MAX_AUDIT_QUERY_LENGTH = 1_000;
const REDACTED = "[redacted]";
const TRUNCATED = "[truncated]";

// Audit logs support operational debugging, not recovery of submitted personal
// data. Keep useful non-sensitive query context while removing common secrets
// before it reaches Supabase or an admin trace.
const redactSensitiveValues = (value: string): string =>
	value
		.replace(/\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]){11,30}\b/giu, REDACTED)
		.replace(/\+\d(?:[\s().-]*\d){6,14}\b/g, REDACTED)
		.replace(/\b(?:\d[\s().-]?){10,15}\b/g, REDACTED)
		.replace(/\b\d{4}-\d{2}-\d{2}\b/g, REDACTED)
		.replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, REDACTED)
		.replace(
			/\b\d{1,5}\s+[\p{L}]+(?:[\s-]+[\p{L}]+){0,4}\s+(?:street|st\.?|straße|str\.?|road|rd\.?|avenue|ave\.?|platz|weg)\b/giu,
			REDACTED,
		)
		.replace(/\b[\p{L}.-]{2,40}\s+\d{1,5}\b/giu, REDACTED)
		.replace(/\b\d{5}\b/g, REDACTED);

/** Return a bounded, redacted query safe for Beacon audit persistence. */
export function sanitizeAuditQuery(value: string): string {
	const redacted = redactSensitiveValues(value.trim());
	if (redacted.length <= MAX_AUDIT_QUERY_LENGTH) return redacted;
	return `${redacted.slice(0, MAX_AUDIT_QUERY_LENGTH)}${TRUNCATED}`;
}

/** Sanitize string-valued fields nested in the persisted search DSL. */
export function sanitizeAuditDsl(
	dsl: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(dsl).map(([key, value]) => [
			key,
			Array.isArray(value)
				? value.map((item) =>
						typeof item === "string" ? sanitizeAuditQuery(item) : item,
					)
				: typeof value === "string"
					? sanitizeAuditQuery(value)
					: value,
		]),
	);
}
