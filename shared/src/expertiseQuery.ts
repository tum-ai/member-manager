import { z } from "zod";

/** Request contract for the visual member graph's natural-language query. */
export const expertiseQueryRequestSchema = z.object({
	question: z.string().trim().min(3).max(500),
});

export type ExpertiseQueryRequest = z.infer<typeof expertiseQueryRequestSchema>;

export const expertiseMatchSchema = z.object({
	userId: z.string().uuid(),
	score: z.number().min(0).max(1),
	reason: z.string(),
});

export type ExpertiseMatch = z.infer<typeof expertiseMatchSchema>;

export const expertiseQueryResponseSchema = z.object({
	answer: z.string(),
	matches: z.array(expertiseMatchSchema),
	source: z.enum(["llm", "fallback"]),
});

export type ExpertiseQueryResponse = z.infer<
	typeof expertiseQueryResponseSchema
>;
