// Convert a tool's zod params into the JSON Schema OpenAI's function-calling API
// expects. zod v4 emits draft-2020-12 with `type:object` / `properties` /
// `required` / `additionalProperties:false` — exactly what we need; we only
// strip the `$schema` key (OpenAI rejects unknown top-level keys in parameters).

import { type ZodType, z } from "zod";

export function toToolJsonSchema(schema: ZodType): Record<string, unknown> {
	const js = z.toJSONSchema(schema) as Record<string, unknown>;
	delete js.$schema;
	return js;
}
