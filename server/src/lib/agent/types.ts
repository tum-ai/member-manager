// Beacon assistant — core agent types. ONE orchestrator runs an OpenAI
// tool-calling loop; the org is split into "pillars" whose tools/knowledge are
// revealed on demand. See orchestrator.ts for the loop and registry.ts for the
// pillar/tool wiring.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodType } from "zod";

export interface AuthedUser {
	id: string;
	email?: string | null;
}

// A person surfaced by a tool. Superset of searchLlm.Candidate so the same
// rendering (mention chips, People panel) works unchanged on the client.
export interface CollectedPerson {
	user_id: string;
	name: string;
	avatar_url: string | null;
	best_chunk: string | null;
	score: number;
	match_reason?: string;
}

// Streamed over SSE (and collected for the JSON transport). One discriminated
// union mirrored on the client.
export type AgentEvent =
	| { type: "pillar_loaded"; pillar_id: string; tools: string[] }
	| { type: "tool_call"; id: string; name: string; args: unknown }
	| { type: "tool_result"; id: string; name: string; summary: string }
	| { type: "people"; people: CollectedPerson[] }
	| { type: "answer"; text: string }
	| { type: "error"; message: string }
	| { type: "done" };

// Everything a tool handler can touch. `collectedPeople` is the dedup'd union of
// everyone any tool surfaced this turn — it gates which @mentions the final
// answer may cite (anti-hallucination).
export interface ToolContext {
	supabase: SupabaseClient;
	user: AuthedUser;
	loadedPillars: Set<string>;
	collectedPeople: Map<string, CollectedPerson>;
	emit: (e: AgentEvent) => void;
	registry: PillarRegistry;
}

export interface ToolResult {
	// Text fed back to the model as the tool result.
	content: string;
	// People to harvest into collectedPeople + stream to the UI.
	people?: CollectedPerson[];
}

// A registered tool. `params` (zod) doubles as runtime validation and the
// source of the OpenAI JSON-schema; `run` validates then invokes the handler.
export interface PillarTool {
	name: string;
	description: string;
	params: ZodType;
	run: (rawArgs: unknown, ctx: ToolContext) => Promise<ToolResult>;
}

// Type-safe tool factory: ties the zod schema to a typed handler and validates
// the model's raw arguments before the handler sees them.
export function defineTool<A>(spec: {
	name: string;
	description: string;
	params: ZodType<A>;
	handler: (args: A, ctx: ToolContext) => Promise<ToolResult>;
}): PillarTool {
	return {
		name: spec.name,
		description: spec.description,
		params: spec.params,
		run: (rawArgs, ctx) => spec.handler(spec.params.parse(rawArgs ?? {}), ctx),
	};
}

// A "pillar" = a domain of the org. `shortDescription` is ALWAYS in the system
// prompt (the catalog); `load_pillar` reveals `longDescription`, activates
// `tools`, and (if set) exposes a `knowledgeRoot` directory the agent can read.
export interface Pillar {
	id: string;
	title: string;
	shortDescription: string;
	longDescription: string;
	knowledgeRoot?: string;
	tools: PillarTool[];
}

export interface PillarRegistry {
	register(p: Pillar): void;
	get(id: string): Pillar | undefined;
	all(): Pillar[];
	baseTools(): PillarTool[];
	// Base tools + the tools of every loaded pillar.
	activeTools(loaded: Set<string>): PillarTool[];
	activeTool(loaded: Set<string>, name: string): PillarTool | undefined;
}

export interface AgentStep {
	name: string;
	args: unknown;
	summary: string;
}

// A single executed tool call, with FULL (untruncated) args + result — the
// admin trace, never streamed to the client.
export interface AgentTraceToolCall {
	call_id: string;
	name: string;
	args: unknown;
	result: string;
	people: { user_id: string; name: string }[];
	ms: number;
}

// One model round of the loop: which tools it asked for + any prose it emitted.
export interface AgentTraceRound {
	index: number;
	response_id: string;
	tool_calls: AgentTraceToolCall[];
	text: string;
}

// Full reasoning trace for one assistant turn, persisted for admin review.
export interface AgentTrace {
	rounds: AgentTraceRound[];
	loadedPillars: string[];
	rawAnswer: string;
	finalAnswer: string;
	degraded: boolean;
}

export interface AgentResult {
	answer: string;
	people: CollectedPerson[];
	steps: AgentStep[];
	loadedPillars: string[];
	model: string;
	trace: AgentTrace;
}

export interface AgentInput {
	// Prior conversation (text only, last ~8 turns) for memory.
	messages: { role: "user" | "assistant"; content: string }[];
	text: string;
	mentions: { user_id: string; label: string }[];
	loadedPillars?: string[];
}
