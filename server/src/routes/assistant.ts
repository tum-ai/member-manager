// Beacon conversational assistant. POST /api/expertise/assistant runs the
// orchestrator (one tool-calling loop over the pillar registry) with
// conversation memory. Responds as Server-Sent Events when the client sends
// `Accept: text/event-stream` (live tool steps), otherwise as a single JSON
// body. The agent core is identical; only `emit` differs.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runAgent } from "../lib/agent/orchestrator.js";
import { registerAllPillars } from "../lib/agent/pillars/index.js";
import { registry } from "../lib/agent/registry.js";
import type { AgentEvent, AgentResult } from "../lib/agent/types.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const MAX_HISTORY = 8;

const AssistantRequestSchema = z.object({
	messages: z
		.array(
			z.object({
				role: z.enum(["user", "assistant"]),
				content: z.string(),
			}),
		)
		.default([]),
	text: z.string().trim().min(1).max(2000),
	mentions: z
		.array(z.object({ user_id: z.string().uuid(), label: z.string() }))
		.default([]),
	loaded_pillars: z.array(z.string()).optional(),
	// Correlate this turn with a chat session for the admin activity log.
	chat_id: z.string().uuid().optional(),
	turn_id: z.string().uuid().optional(),
});

export async function assistantRoutes(server: FastifyInstance) {
	registerAllPillars(registry);

	server.post(
		"/expertise/assistant",
		{ preHandler: authenticate },
		async (request, reply) => {
			const body = AssistantRequestSchema.parse(request.body);
			const user = (request as AuthenticatedRequest).user;
			const supabase = getSupabase();

			const input = {
				messages: body.messages.slice(-MAX_HISTORY),
				text: body.text,
				mentions: body.mentions,
				loadedPillars: body.loaded_pillars,
			};

			const chatId = body.chat_id ?? crypto.randomUUID();
			const turnId = body.turn_id ?? crypto.randomUUID();
			const startedAt = Date.now();

			const logSearch = async (result: AgentResult) => {
				try {
					await supabase.from("beacon_search_log").insert({
						user_id: user.id,
						query: body.text,
						dsl: {
							tools: result.steps.map((s) => s.name),
							pillars: result.loadedPillars,
						},
						result_count: result.people.length,
					});
				} catch (err) {
					request.log.error({ err }, "assistant search log failed");
				}
			};

			// Full reasoning trace for admin review (never fails the response).
			const logAgentTrace = async (result: AgentResult) => {
				try {
					await supabase.from("beacon_agent_log").insert({
						chat_id: chatId,
						turn_id: turnId,
						user_id: user.id,
						query: body.text,
						model: result.model,
						trace: result.trace,
						step_count: result.steps.length,
						people_count: result.people.length,
						duration_ms: Date.now() - startedAt,
					});
				} catch (err) {
					request.log.error({ err }, "assistant agent log failed");
				}
			};

			const persist = async (result: AgentResult) => {
				await Promise.all([logSearch(result), logAgentTrace(result)]);
			};

			const wantsStream = (request.headers.accept ?? "").includes(
				"text/event-stream",
			);

			// ---- SSE transport ------------------------------------------------
			if (wantsStream) {
				reply.hijack();
				const headers: Record<string, string> = {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache, no-transform",
					Connection: "keep-alive",
				};
				// CORS: hijacking skips the cors plugin's onSend hook, so reflect the
				// origin manually (auth is bearer, not cookie, so reflecting is safe).
				const origin = request.headers.origin;
				if (origin) {
					headers["Access-Control-Allow-Origin"] = origin;
					headers.Vary = "Origin";
				}
				reply.raw.writeHead(200, headers);
				const send = (e: AgentEvent) =>
					reply.raw.write(`data: ${JSON.stringify(e)}\n\n`);
				try {
					const result = await runAgent(input, {
						supabase,
						registry,
						user: { id: user.id, email: user.email },
						emit: send,
					});
					await persist(result);
				} catch (err) {
					request.log.error({ err }, "assistant run failed");
					send({ type: "error", message: "Something went wrong on my end." });
					send({ type: "done" });
				} finally {
					reply.raw.end();
				}
				return reply;
			}

			// ---- JSON transport (curl / tests) --------------------------------
			const result = await runAgent(input, {
				supabase,
				registry,
				user: { id: user.id, email: user.email },
				emit: () => {},
			});
			await persist(result);
			return {
				answer: result.answer,
				people: result.people,
				steps: result.steps,
				loadedPillars: result.loadedPillars,
			};
		},
	);
}
