// Beacon NL search (legacy single-shot) + @mention typeahead. The conversational
// assistant lives at POST /api/expertise/assistant (routes/assistant.ts); this
// POST /api/expertise/search remains for back-compat and as the no-key/JSON
// fallback. Both share the ranked pipeline in lib/agent/fallback.ts.
// GET /api/expertise/people backs the composer's @-mention typeahead.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nameOf, runMemberSearchAnswer } from "../lib/agent/fallback.js";
import { DatabaseError } from "../lib/errors.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const SearchRequestSchema = z.object({
	text: z.string().trim().min(1).max(1000),
	mentions: z
		.array(z.object({ user_id: z.string().uuid(), label: z.string() }))
		.default([]),
});

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
			const q = (request.query.q ?? "").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
			if (q.length < 2) return { people: [] };
			const { data, error } = await getSupabase()
				.from("members")
				.select("user_id, given_name, surname")
				.or(`given_name.ilike.%${q}%,surname.ilike.%${q}%`)
				.limit(8);
			if (error) {
				request.log.error({ err: error }, "people typeahead failed");
				throw new DatabaseError();
			}
			return {
				people: (data ?? []).map((m) => {
					const row = m as MemberRow;
					return { user_id: row.user_id, name: nameOf(row), avatar_url: null };
				}),
			};
		},
	);

	// ---- NL search (legacy single-shot) ----------------------------------
	server.post(
		"/expertise/search",
		{ preHandler: authenticate },
		async (request) => {
			const { text, mentions } = SearchRequestSchema.parse(request.body);
			const user = (request as AuthenticatedRequest).user;

			const { answer, people, dsl } = await runMemberSearchAnswer({
				text,
				mentions,
			});

			// GDPR audit (best-effort).
			await getSupabase().from("beacon_search_log").insert({
				user_id: user.id,
				query: text,
				dsl,
				result_count: people.length,
			});

			return { answer, people, dsl };
		},
	);
}
