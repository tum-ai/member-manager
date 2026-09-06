import { z } from "zod";

/** Marker returned when a sanitized trace exceeds the persistence size cap. */
export const AGENT_TRACE_TRUNCATED_REASON =
	"agent trace exceeded persistence limit" as const;

export const agentTraceTruncatedMarkerSchema = z
	.object({
		truncated: z.literal(true),
		reason: z.literal(AGENT_TRACE_TRUNCATED_REASON),
	})
	.strict();

/** JSON-safe value emitted by the server trace sanitizer. */
export type SanitizedAgentTraceValue =
	| null
	| boolean
	| number
	| string
	| SanitizedAgentTraceValue[]
	| { [key: string]: SanitizedAgentTraceValue };

const sanitizedAgentTraceValueSchema: z.ZodType<SanitizedAgentTraceValue> =
	z.lazy(() =>
		z.union([
			z.null(),
			z.boolean(),
			z.number().finite(),
			z.string(),
			z.array(sanitizedAgentTraceValueSchema),
			z.record(z.string(), sanitizedAgentTraceValueSchema),
		]),
	);

/** Persisted Beacon trace, including the sanitizer's bounded marker variant. */
export const sanitizedAgentTraceSchema = z.union([
	agentTraceTruncatedMarkerSchema,
	sanitizedAgentTraceValueSchema,
]);

export type SanitizedAgentTrace = z.infer<typeof sanitizedAgentTraceSchema>;
