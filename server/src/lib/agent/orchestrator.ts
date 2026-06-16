// The Beacon orchestrator loop, over the OpenAI Responses API. Drives a
// reasoning + tool-calling conversation: model → function_calls → execute
// (harvesting people) → return outputs → repeat, capped by MAX_STEPS, then a
// forced tool-free final answer. Rounds chain via previous_response_id so the
// model's reasoning is preserved across tool calls; only new function_call
// outputs are sent each round. The final text is gated by sanitizeAnswerMentions
// so it can only cite people a tool returned. Transport-agnostic via deps.emit.
// No OPENAI_API_KEY → degrades to the legacy single-shot member search.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeAnswerMentions } from "../searchLlm.js";
import {
	type MemberSearchAnswer,
	type MemberSearchInput,
	runMemberSearchAnswer,
} from "./fallback.js";
import {
	type AgentResponse,
	agentConfigured,
	agentModel,
	createAgentResponse,
	type InputItem,
	type ResponsesTool,
} from "./openai.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import type {
	AgentEvent,
	AgentInput,
	AgentResult,
	AgentStep,
	AgentTrace,
	AgentTraceRound,
	AgentTraceToolCall,
	CollectedPerson,
	PillarRegistry,
	PillarTool,
	ToolContext,
} from "./types.js";
import { toToolJsonSchema } from "./zodSchema.js";

const MAX_STEPS = 20;
const MAX_TOOLS_PER_TURN = 24;
const MAX_TOOL_CONTENT = 30_000;
// Hosted web_search is on by default; set OPENAI_ENABLE_WEB_SEARCH=0 to disable
// (it can occasionally destabilize the model when results contain spam — the
// "answer silently" prompt + stripLeakedToolArgs guard against leakage).
const WEB_SEARCH_ENABLED = process.env.OPENAI_ENABLE_WEB_SEARCH !== "0";

export type RespondFn = typeof createAgentResponse;
export type LegacyFn = (
	input: MemberSearchInput,
) => Promise<MemberSearchAnswer>;

export interface RunAgentDeps {
	supabase: SupabaseClient;
	registry: PillarRegistry;
	user: { id: string; email?: string | null };
	emit: (e: AgentEvent) => void;
	// Injectable for tests; default to the real Responses call / legacy pipeline.
	respond?: RespondFn;
	legacy?: LegacyFn;
	configured?: boolean;
}

function toResponsesTool(t: PillarTool): ResponsesTool {
	return {
		type: "function",
		name: t.name,
		description: t.description,
		parameters: toToolJsonSchema(t.params),
	};
}

function harvest(ctx: ToolContext, people: CollectedPerson[]): void {
	for (const p of people) {
		const prev = ctx.collectedPeople.get(p.user_id);
		if (!prev || p.score > prev.score) ctx.collectedPeople.set(p.user_id, p);
	}
}

const validIds = (ctx: ToolContext): Set<string> =>
	new Set(ctx.collectedPeople.keys());

// Append the resolved @mention ids to the user turn so the model can cite them.
function renderUserTurn(
	text: string,
	mentions: { user_id: string; label: string }[],
): string {
	if (!mentions.length) return text;
	const refs = mentions
		.map((m) => `${m.label} = beacon:${m.user_id}`)
		.join("; ");
	return `${text}\n\n[Referenced people: ${refs}]`;
}

const escapeRe = (s: string): string =>
	s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Models often render a member's name as plain or **bold** text instead of the
// @[Name](beacon:uid) citation token. Deterministically rewrite each collected
// person's name into the token so they always become clickable chips. Skips
// names already inside a link/token (lookbehind on `[`). Exported for testing.
export function linkifyMentions(
	answer: string,
	people: CollectedPerson[],
): string {
	let out = answer;
	// Longest names first so "Ana Lee" wins over a stray "Ana".
	for (const p of [...people].sort((a, b) => b.name.length - a.name.length)) {
		const name = p.name?.trim();
		if (!name || name.toLowerCase() === "member") continue;
		const esc = escapeRe(name);
		const token = `@[${name}](beacon:${p.user_id})`;
		// **Bold** (optionally @-prefixed) occurrences → token.
		out = out.replace(new RegExp(`\\*\\*@?${esc}\\*\\*`, "g"), token);
		// Bare or @-prefixed occurrences, NOT already inside a [..](..) link/token
		// (excluded via the `[` lookbehind) and not mid-word. The optional leading
		// `@` is consumed so a plain "@Name" doesn't become "@@[Name](…)".
		out = out.replace(
			new RegExp(`(?<![\\w[])@?${esc}(?![\\w\\]])`, "g"),
			token,
		);
	}
	return out;
}

// Safety net: strip leaked tool-call channel syntax / argument JSON the model
// echoed into prose (e.g. `to=functions.find_people_by`, raw arg objects).
export function stripLeakedToolArgs(text: string): string {
	return text
		.replace(
			/\{[^{}]*"(?:project|organization|skill|tag|include_pending|query|user_id|pillar_id|path|top_k)"\s*:[^{}]*\}/g,
			"",
		)
		.replace(/\b(?:to=)?functions\.\w+/g, "")
		.replace(/【[^】]*】/g, "")
		.replace(/[ \t]{2,}/g, " ")
		.replace(/[ \t]+\n/g, "\n")
		.trim();
}

const finalize = (raw: string, ctx: ToolContext): string =>
	sanitizeAnswerMentions(
		linkifyMentions(stripLeakedToolArgs(raw.trim()), [
			...ctx.collectedPeople.values(),
		]),
		validIds(ctx),
	);

function fallbackText(ctx: ToolContext): string {
	const people = [...ctx.collectedPeople.values()];
	if (!people.length)
		return "I couldn't find anything on that just yet. Could you rephrase or add a detail?";
	const chips = people
		.slice(0, 5)
		.map((p) => `@[${p.name}](beacon:${p.user_id})`)
		.join(", ");
	return `Here's what I found: ${chips}.`;
}

function buildResult(
	answer: string,
	ctx: ToolContext,
	steps: AgentStep[],
	trace: AgentTrace,
): AgentResult {
	return {
		answer,
		people: [...ctx.collectedPeople.values()],
		steps,
		loadedPillars: [...ctx.loadedPillars],
		model: agentModel(),
		trace: { ...trace, loadedPillars: [...ctx.loadedPillars] },
	};
}

export async function runAgent(
	input: AgentInput,
	deps: RunAgentDeps,
): Promise<AgentResult> {
	const ctx: ToolContext = {
		supabase: deps.supabase,
		user: deps.user,
		loadedPillars: new Set(input.loadedPillars ?? []),
		collectedPeople: new Map(),
		emit: deps.emit,
		registry: deps.registry,
	};
	const steps: AgentStep[] = [];
	const rounds: AgentTraceRound[] = [];
	const trace: AgentTrace = {
		rounds,
		loadedPillars: [],
		rawAnswer: "",
		finalAnswer: "",
		degraded: false,
	};
	const respond = deps.respond ?? createAgentResponse;
	const legacy = deps.legacy ?? runMemberSearchAnswer;
	const isConfigured = deps.configured ?? agentConfigured();

	if (!isConfigured) return degradeToLegacy(input, ctx, legacy, trace);

	const instructions = buildSystemPrompt(ctx.loadedPillars, deps.registry);
	// First request carries the history + the new user turn; later rounds send
	// only the function outputs (previous_response_id carries the rest).
	let inputItems: InputItem[] = [
		...input.messages.map(
			(m) => ({ role: m.role, content: m.content }) as InputItem,
		),
		{ role: "user", content: renderUserTurn(input.text, input.mentions) },
	];
	let previousResponseId: string | undefined;
	let sentInstructions = false;

	for (let step = 0; step < MAX_STEPS; step++) {
		const tools = deps.registry
			.activeTools(ctx.loadedPillars)
			.map(toResponsesTool);
		let resp: AgentResponse | null;
		try {
			resp = await respond({
				input: inputItems,
				tools,
				instructions: sentInstructions ? undefined : instructions,
				previousResponseId,
				enableWebSearch: WEB_SEARCH_ENABLED,
			});
		} catch (e) {
			console.error(
				"[beacon] agent loop failed — degrading to legacy search:",
				e instanceof Error ? e.message : e,
			);
			deps.emit({
				type: "error",
				message: e instanceof Error ? e.message : "model error",
			});
			return degradeToLegacy(input, ctx, legacy, trace);
		}
		if (!resp) return degradeToLegacy(input, ctx, legacy, trace);
		sentInstructions = true;
		if (resp.id) previousResponseId = resp.id;

		const round: AgentTraceRound = {
			index: step,
			response_id: resp.id,
			tool_calls: [],
			text: resp.text,
		};
		rounds.push(round);

		if (resp.functionCalls.length === 0) {
			trace.rawAnswer = resp.text;
			const answer = finalize(resp.text, ctx) || fallbackText(ctx);
			trace.finalAnswer = answer;
			deps.emit({ type: "answer", text: answer });
			deps.emit({ type: "done" });
			return buildResult(answer, ctx, steps, trace);
		}

		// Respond to EVERY function_call (the API requires it), executing up to the
		// cap; beyond that return a "skipped" output to keep the round valid.
		const outputs: InputItem[] = [];
		for (let i = 0; i < resp.functionCalls.length; i++) {
			const call = resp.functionCalls[i];
			let args: unknown = {};
			try {
				args = call.arguments ? JSON.parse(call.arguments) : {};
			} catch {
				args = {};
			}

			let content: string;
			if (i >= MAX_TOOLS_PER_TURN) {
				content = "Skipped — too many capabilities requested at once.";
			} else {
				deps.emit({
					type: "tool_call",
					id: call.call_id,
					name: call.name,
					args,
				});
				const tool = deps.registry.activeTool(ctx.loadedPillars, call.name);
				const startedAt = Date.now();
				let callPeople: { user_id: string; name: string }[] = [];
				try {
					if (!tool) {
						content = `Capability "${call.name}" isn't available yet — load its area first with load_pillar.`;
					} else {
						const res = await tool.run(args, ctx);
						content = res.content;
						if (res.people?.length) {
							harvest(ctx, res.people);
							callPeople = res.people.map((p) => ({
								user_id: p.user_id,
								name: p.name,
							}));
							deps.emit({ type: "people", people: res.people });
						}
					}
				} catch (e) {
					content = `That step failed: ${e instanceof Error ? e.message : "error"}`;
				}
				const summary = content.slice(0, 200);
				steps.push({ name: call.name, args, summary });
				const traceCall: AgentTraceToolCall = {
					call_id: call.call_id,
					name: call.name,
					args,
					result: content,
					people: callPeople,
					ms: Date.now() - startedAt,
				};
				round.tool_calls.push(traceCall);
				deps.emit({
					type: "tool_result",
					id: call.call_id,
					name: call.name,
					summary,
				});
			}
			outputs.push({
				type: "function_call_output",
				call_id: call.call_id,
				output: content.slice(0, MAX_TOOL_CONTENT),
			});
		}
		// Next round sends only the new outputs; the rest is carried server-side.
		inputItems = outputs;
	}

	// Exhausted MAX_STEPS → force a final, tool-free answer (delivers the last
	// pending tool outputs via previous_response_id).
	let forced: AgentResponse | null = null;
	try {
		forced = await respond({
			input: inputItems,
			tools: [],
			previousResponseId,
		});
	} catch {
		// fall through to fallbackText
	}
	trace.rawAnswer = forced?.text ?? "";
	const answer = finalize(forced?.text ?? "", ctx) || fallbackText(ctx);
	trace.finalAnswer = answer;
	deps.emit({ type: "answer", text: answer });
	deps.emit({ type: "done" });
	return buildResult(answer, ctx, steps, trace);
}

// No-API-key (or mid-flight failure) path: the legacy single-shot member search.
async function degradeToLegacy(
	input: AgentInput,
	ctx: ToolContext,
	legacy: LegacyFn,
	trace: AgentTrace,
): Promise<AgentResult> {
	const { answer, people } = await legacy({
		text: input.text,
		mentions: input.mentions,
	});
	const collected: CollectedPerson[] = people.map((p) => ({ ...p }));
	harvest(ctx, collected);
	if (collected.length) ctx.emit({ type: "people", people: collected });
	ctx.emit({ type: "answer", text: answer });
	ctx.emit({ type: "done" });
	trace.degraded = true;
	trace.finalAnswer = answer;
	return buildResult(answer, ctx, [], trace);
}
