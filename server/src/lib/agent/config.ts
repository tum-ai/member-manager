// Centralized, env-tunable knobs for the orchestrator loop and its model
// transport. One place to read (and document) every magic number, so operators
// can tune the agent without touching code and tests can inject a config.
//
// NOT here: the model id (agentModel) and API-key presence (agentConfigured) —
// those live in openai.ts and are injected separately via RunAgentDeps.

export type ReasoningEffort = "low" | "medium" | "high";

export interface AgentConfig {
	// Max model⇄tool rounds before a forced, tool-free final answer.
	maxSteps: number;
	// Max tool calls executed within a single round (the rest are answered
	// "skipped" to keep the round valid).
	maxToolsPerTurn: number;
	// Per-tool result text fed back to the model is truncated to this many chars.
	maxToolContent: number;
	// Upper bound on the model's output tokens per round.
	maxOutputTokens: number;
	// Reasoning effort passed to the Responses API.
	reasoningEffort: ReasoningEffort;
	// Per-request HTTP timeout for a model round (ms).
	requestTimeoutMs: number;
	// Offer OpenAI's hosted web_search tool alongside our function tools.
	enableWebSearch: boolean;
	// The hosted-search tool type (OpenAI occasionally versions this name).
	webSearchToolType: string;
}

function intEnv(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
	const raw = env[key]?.trim();
	if (!raw) return fallback;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

function effortEnv(
	env: NodeJS.ProcessEnv,
	key: string,
	fallback: ReasoningEffort,
): ReasoningEffort {
	const raw = env[key]?.trim();
	return raw === "low" || raw === "medium" || raw === "high" ? raw : fallback;
}

// Resolve the config from the environment (defaults mirror the historical
// hardcoded literals, so unset env == prior behavior).
export function loadAgentConfig(
	env: NodeJS.ProcessEnv = process.env,
): AgentConfig {
	return {
		maxSteps: intEnv(env, "OPENAI_AGENT_MAX_STEPS", 20),
		maxToolsPerTurn: intEnv(env, "OPENAI_AGENT_MAX_TOOLS_PER_TURN", 24),
		maxToolContent: intEnv(env, "OPENAI_AGENT_MAX_TOOL_CONTENT", 30_000),
		maxOutputTokens: intEnv(env, "OPENAI_AGENT_MAX_OUTPUT_TOKENS", 150_000),
		reasoningEffort: effortEnv(env, "OPENAI_AGENT_REASONING_EFFORT", "medium"),
		requestTimeoutMs: intEnv(env, "OPENAI_AGENT_TIMEOUT_MS", 120_000),
		enableWebSearch: env.OPENAI_ENABLE_WEB_SEARCH?.trim() !== "0",
		webSearchToolType: env.OPENAI_WEB_SEARCH_TOOL?.trim() || "web_search",
	};
}
