// Beacon conversational assistant. POST /api/expertise/assistant runs the
// orchestrator (one tool-calling loop over the pillar registry) with
// conversation memory. Responds as Server-Sent Events when the client sends
// `Accept: text/event-stream` (live tool steps), otherwise as a single JSON
// body. The agent core is identical; only `emit` differs.

import {
	assistantEventSchema,
	assistantJsonResponseSchema,
	assistantRequestSchema,
} from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import type { z } from "zod";
import { runAgent } from "../lib/agent/orchestrator.js";
import { registerAllPillars } from "../lib/agent/pillars/index.js";
import { registry } from "../lib/agent/registry.js";
import type { AgentEvent, AgentResult } from "../lib/agent/types.js";
import { sanitizeAgentTrace } from "../lib/agentTrace.js";
import { sanitizeAuditQuery } from "../lib/auditQuery.js";
import { DatabaseError, ValidationError } from "../lib/errors.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const MAX_HISTORY = 8;

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

export async function assistantRoutes(server: FastifyInstance) {
	registerAllPillars(registry);

	server.post(
		"/expertise/assistant",
		{ preHandler: authenticate },
		async (request, reply) => {
			const body = parseRequest(
				assistantRequestSchema,
				request.body,
				"Invalid Beacon assistant payload",
			);
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
						query: sanitizeAuditQuery(body.text),
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
						query: sanitizeAuditQuery(body.text),
						model: result.model,
						trace: sanitizeAgentTrace(result.trace),
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
				const send = (event: AgentEvent): void => {
					const candidate =
						event.type === "error"
							? {
									type: "error" as const,
									message: "Something went wrong on my end.",
								}
							: event;
					const parsed = assistantEventSchema.safeParse(candidate);
					if (!parsed.success) {
						request.log.warn(
							{ issues: parsed.error.flatten() },
							"Invalid Beacon assistant event",
						);
						return;
					}
					reply.raw.write(`data: ${JSON.stringify(parsed.data)}\n\n`);
				};
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
			let result: AgentResult;
			try {
				result = await runAgent(input, {
					supabase,
					registry,
					user: { id: user.id, email: user.email },
					emit: () => {},
				});
			} catch (error) {
				request.log.error({ err: error }, "Beacon assistant run failed");
				throw new DatabaseError();
			}
			const parsedResult = parseResponse(assistantJsonResponseSchema, {
				answer: result.answer,
				people: result.people,
				steps: result.steps,
				loadedPillars: result.loadedPillars,
			});
			await persist(result);
			return parsedResult;
		},
	);
}
