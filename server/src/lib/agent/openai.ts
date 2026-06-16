// OpenAI Responses API (/v1/responses) for the assistant orchestrator. The
// Responses API is required for gpt-5.x to combine reasoning with function
// tools (Chat Completions rejects that combination). We chain rounds with
// `previous_response_id` (+ store:true, the default): the server preserves the
// reasoning items and prior turns, so each follow-up only sends the NEW
// function_call_output items. Mirrors the fetch pattern in webResearch.ts.
//
// Model: OPENAI_AGENT_MODEL → OPENAI_RESEARCH_MODEL → "gpt-5.4".

import { fetchWithTimeout } from "../fetchWithTimeout.js";

const RESPONSES_URL = "https://api.openai.com/v1/responses";

export function agentConfigured(): boolean {
	return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function agentModel(): string {
	return (
		process.env.OPENAI_AGENT_MODEL?.trim() ||
		process.env.OPENAI_RESEARCH_MODEL?.trim() ||
		"gpt-5.4"
	);
}

// Function tool, Responses-API shape (flat — no nested `function` wrapper).
export interface ResponsesTool {
	type: "function";
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

// An input item we send: a role message OR a tool result. Prior reasoning /
// function_call items are carried by previous_response_id, never re-sent.
export type InputItem =
	| { role: "user" | "assistant" | "system"; content: string }
	| { type: "function_call_output"; call_id: string; output: string };

export interface AgentFunctionCall {
	call_id: string;
	name: string;
	arguments: string;
}

export interface AgentResponse {
	id: string;
	functionCalls: AgentFunctionCall[];
	text: string;
}

export interface CreateResponseParams {
	input: InputItem[];
	tools: ResponsesTool[];
	instructions?: string;
	previousResponseId?: string;
	toolChoice?: "auto" | "none";
	maxOutputTokens?: number;
	// Add OpenAI's hosted web_search tool (resolved by OpenAI; we don't run it).
	enableWebSearch?: boolean;
}

interface ResponsesBody {
	id?: string;
	output_text?: string;
	output?: Array<{
		type?: string;
		call_id?: string;
		name?: string;
		arguments?: string;
		content?: Array<{ type?: string; text?: string }>;
	}>;
}

// One model turn over the Responses API. Returns the normalized response (id +
// function calls + final text), or null when no API key (caller degrades).
// Throws on HTTP error.
export async function createAgentResponse(
	params: CreateResponseParams,
): Promise<AgentResponse | null> {
	const apiKey = process.env.OPENAI_API_KEY?.trim();
	if (!apiKey) return null;

	const body: Record<string, unknown> = {
		model: agentModel(),
		input: params.input,
		reasoning: { effort: "medium" },
		max_output_tokens: params.maxOutputTokens ?? 150_000,
		store: true,
	};
	if (params.instructions) body.instructions = params.instructions;
	if (params.previousResponseId)
		body.previous_response_id = params.previousResponseId;
	const toolList: unknown[] = [...params.tools];
	if (params.enableWebSearch) {
		toolList.push({
			type: process.env.OPENAI_WEB_SEARCH_TOOL?.trim() || "web_search",
		});
	}
	if (toolList.length > 0) {
		body.tools = toolList;
		body.tool_choice = params.toolChoice ?? "auto";
		body.parallel_tool_calls = true;
	}

	const res = await fetchWithTimeout(
		RESPONSES_URL,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body),
		},
		120_000,
	);

	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		console.error(
			`[beacon] OpenAI responses call failed (model=${agentModel()}): ${res.status} ${detail.slice(0, 600)}`,
		);
		throw new Error(`OpenAI responses call failed: ${res.status}`);
	}

	const json = (await res.json()) as ResponsesBody;
	const functionCalls: AgentFunctionCall[] = [];
	let text = "";
	for (const item of json.output ?? []) {
		if (item.type === "function_call" && item.call_id && item.name) {
			functionCalls.push({
				call_id: item.call_id,
				name: item.name,
				arguments: item.arguments ?? "{}",
			});
		} else if (item.type === "message") {
			for (const c of item.content ?? [])
				if (c.type === "output_text" && typeof c.text === "string")
					text += c.text;
		}
	}
	if (!text && typeof json.output_text === "string") text = json.output_text;
	return { id: json.id ?? "", functionCalls, text };
}
