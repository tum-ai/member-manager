// Beacon NL search (legacy single-shot) + @mention typeahead. The conversational
// assistant lives at POST /api/expertise/assistant (routes/assistant.ts); this
// POST /api/expertise/search remains for back-compat and as the no-key/JSON
// fallback. Both share the ranked pipeline in lib/agent/fallback.ts.
// GET /api/expertise/people backs the composer's @-mention typeahead.

import {
	personSuggestionSchema,
	searchRequestSchema,
	searchResponseSchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nameOf, runMemberSearchAnswer } from "../lib/agent/fallback.js";
import { sanitizeAuditDsl, sanitizeAuditQuery } from "../lib/auditQuery.js";
import { visibleBeaconMemberIds } from "../lib/beacon.js";
import { DatabaseError, ValidationError } from "../lib/errors.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const PeopleQuerySchema = z.object({
	q: z.string().trim().max(100).optional(),
});
const PeopleResponseSchema = z.object({
	people: z.array(personSuggestionSchema),
});

function parseRequest<T>(
	schema: z.ZodType<T>,
	input: unknown,
	message: string,
): T {
	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		throw new ValidationError(message, parsed.error.flatten());
	}
	return parsed.data;
}

function parseResponse<T>(schema: z.ZodType<T>, input: unknown): T {
	const parsed = schema.safeParse(input);
	if (!parsed.success) throw new DatabaseError();
	return parsed.data;
}

interface MemberRow {
	user_id: string;
	given_name: string | null;
	surname: string | null;
}

export async function searchRoutes(server: FastifyInstance) {
	// ---- @mention typeahead ----------------------------------------------
	server.get<{ Querystring: { q?: string } }>(
		"/expertise/people",
		{ preHandler: authenticate },
		async (request) => {
			const { q: rawQuery } = parseRequest(
				PeopleQuerySchema,
				request.query,
				"Invalid people search query",
			);
			const q = (rawQuery ?? "").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
			if (q.length < 2) {
				return parseResponse(PeopleResponseSchema, { people: [] });
			}
			const { data, error } = await getSupabase()
				.from("members")
				.select("user_id, given_name, surname")
				.or(`given_name.ilike.%${q}%,surname.ilike.%${q}%`)
				.limit(8);
			if (error) {
				request.log.error({ err: error }, "people typeahead failed");
				throw new DatabaseError();
			}
			const rows = (data ?? []) as MemberRow[];
			const visible = await visibleBeaconMemberIds(
				rows.map((row) => row.user_id),
			);
			return parseResponse(PeopleResponseSchema, {
				people: rows
					.filter((row) => visible.has(row.user_id))
					.map((row) => {
						return {
							user_id: row.user_id,
							name: nameOf(row),
							avatar_url: null,
						};
					}),
			});
		},
	);

	// ---- NL search (legacy single-shot) ----------------------------------
	server.post(
		"/expertise/search",
		{ preHandler: authenticate },
		async (request) => {
			const { text, mentions } = parseRequest(
				searchRequestSchema,
				request.body,
				"Invalid Beacon search payload",
			);
			const user = (request as AuthenticatedRequest).user;

			let result: Awaited<ReturnType<typeof runMemberSearchAnswer>>;
			try {
				result = await runMemberSearchAnswer({ text, mentions });
			} catch (error) {
				request.log.error({ err: error }, "Beacon search failed");
				throw new DatabaseError();
			}
			const { answer, people, dsl } = parseResponse(
				searchResponseSchema,
				result,
			);
			const auditDsl = sanitizeAuditDsl(dsl);

			// GDPR audit (best-effort).
			try {
				await getSupabase()
					.from("beacon_search_log")
					.insert({
						user_id: user.id,
						query: sanitizeAuditQuery(text),
						dsl: auditDsl,
						result_count: people.length,
					});
			} catch (error) {
				request.log.error({ err: error }, "Beacon search log failed");
			}

			return { answer, people, dsl };
		},
	);
}
