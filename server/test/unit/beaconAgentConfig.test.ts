import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAgentConfig } from "../../src/lib/agent/config.js";

test("config: defaults mirror the historical literals", () => {
	const c = loadAgentConfig({});
	assert.equal(c.maxSteps, 20);
	assert.equal(c.maxToolsPerTurn, 24);
	assert.equal(c.maxToolContent, 30_000);
	assert.equal(c.maxOutputTokens, 150_000);
	assert.equal(c.reasoningEffort, "medium");
	assert.equal(c.requestTimeoutMs, 120_000);
	assert.equal(c.enableWebSearch, true);
	assert.equal(c.webSearchToolType, "web_search");
});

test("config: integer env overrides parse; invalid falls back", () => {
	assert.equal(loadAgentConfig({ OPENAI_AGENT_MAX_STEPS: "5" }).maxSteps, 5);
	// non-numeric / non-positive → default
	assert.equal(loadAgentConfig({ OPENAI_AGENT_MAX_STEPS: "x" }).maxSteps, 20);
	assert.equal(loadAgentConfig({ OPENAI_AGENT_MAX_STEPS: "0" }).maxSteps, 20);
});

test("config: web search toggles off only on '0'", () => {
	assert.equal(
		loadAgentConfig({ OPENAI_ENABLE_WEB_SEARCH: "0" }).enableWebSearch,
		false,
	);
	assert.equal(
		loadAgentConfig({ OPENAI_ENABLE_WEB_SEARCH: "1" }).enableWebSearch,
		true,
	);
	assert.equal(loadAgentConfig({}).enableWebSearch, true);
});

test("config: reasoning effort validated against the allowed literals", () => {
	assert.equal(
		loadAgentConfig({ OPENAI_AGENT_REASONING_EFFORT: "high" }).reasoningEffort,
		"high",
	);
	assert.equal(
		loadAgentConfig({ OPENAI_AGENT_REASONING_EFFORT: "nonsense" })
			.reasoningEffort,
		"medium",
	);
});

test("config: web search tool type overridable", () => {
	assert.equal(
		loadAgentConfig({ OPENAI_WEB_SEARCH_TOOL: "web_search_preview" })
			.webSearchToolType,
		"web_search_preview",
	);
});
