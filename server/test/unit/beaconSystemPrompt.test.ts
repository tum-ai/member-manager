import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { createRegistry } from "../../src/lib/agent/registry.js";
import { buildSystemPrompt } from "../../src/lib/agent/systemPrompt.js";
import { defineTool, type Pillar } from "../../src/lib/agent/types.js";

function demoPillar(): Pillar {
	return {
		id: "demo",
		title: "Demo",
		shortDescription: "demo area",
		longDescription: "the demo area",
		promptGuidance: "ALWAYS_CALL_DEMO_ONCE",
		tools: [
			defineTool({
				name: "demo_tool",
				description: "demo",
				params: z.object({ q: z.string().optional() }),
				handler: async () => ({ content: "ok" }),
			}),
		],
	};
}

test("prompt: always in character; catalog lists the pillar", () => {
	const reg = createRegistry();
	reg.register(demoPillar());
	const out = buildSystemPrompt(new Set(), reg);
	assert.match(out, /You are Beacon/);
	assert.match(out, /demo: demo area/);
});

test("prompt: guidance injected only while the pillar is loaded", () => {
	const reg = createRegistry();
	reg.register(demoPillar());
	assert.ok(
		!buildSystemPrompt(new Set(), reg).includes("ALWAYS_CALL_DEMO_ONCE"),
		"guidance should be absent before load",
	);
	assert.ok(
		buildSystemPrompt(new Set(["demo"]), reg).includes("ALWAYS_CALL_DEMO_ONCE"),
		"guidance should appear once loaded",
	);
});
