import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
	AgentResponse,
	CreateResponseParams,
} from "../../src/lib/agent/openai.js";
import {
	type LegacyFn,
	linkifyMentions,
	type RespondFn,
	runAgent,
	stripLeakedToolArgs,
} from "../../src/lib/agent/orchestrator.js";
import { createRegistry } from "../../src/lib/agent/registry.js";
import type { CollectedPerson } from "../../src/lib/agent/types.js";
import {
	type AgentEvent,
	defineTool,
	type Pillar,
	type PillarRegistry,
} from "../../src/lib/agent/types.js";

const ADA = "11111111-1111-1111-1111-111111111111";
const GHOST = "99999999-9999-9999-9999-999999999999";

const fc = (call_id: string, name: string, args: unknown) => ({
	call_id,
	name,
	arguments: JSON.stringify(args),
});

function demoRegistry(): PillarRegistry {
	const reg = createRegistry();
	const demo: Pillar = {
		id: "demo",
		title: "Demo",
		shortDescription: "demo people",
		longDescription: "the demo area",
		tools: [
			defineTool({
				name: "find_demo",
				description: "find a demo person",
				params: z.object({ q: z.string().optional() }),
				handler: async () => ({
					content: "Found Ada.",
					people: [
						{
							user_id: ADA,
							name: "Ada",
							avatar_url: null,
							best_chunk: null,
							score: 1,
						},
					],
				}),
			}),
		],
	};
	reg.register(demo);
	return reg;
}

// A respond() that replays a fixed script (last entry repeats).
function scripted(responses: AgentResponse[]): RespondFn {
	let i = 0;
	return async () => responses[Math.min(i++, responses.length - 1)];
}

function harness(reg: PillarRegistry) {
	const events: AgentEvent[] = [];
	const deps = {
		supabase: {} as unknown as SupabaseClient,
		registry: reg,
		user: { id: "me" },
		emit: (e: AgentEvent) => events.push(e),
		configured: true,
	};
	return { events, deps };
}

const baseInput = {
	messages: [],
	mentions: [] as { user_id: string; label: string }[],
};

test("loop: loads a pillar, calls its tool, harvests people, cites in answer", async () => {
	const { events, deps } = harness(demoRegistry());
	const respond = scripted([
		{
			id: "r1",
			functionCalls: [fc("c1", "load_pillar", { pillar_id: "demo" })],
			text: "",
		},
		{
			id: "r2",
			functionCalls: [fc("c2", "find_demo", { q: "ada" })],
			text: "",
		},
		{ id: "r3", functionCalls: [], text: `You want @[Ada](beacon:${ADA}).` },
	]);

	const res = await runAgent(
		{ ...baseInput, text: "who is ada" },
		{ ...deps, respond },
	);

	assert.equal(res.answer, `You want @[Ada](beacon:${ADA}).`);
	assert.deepEqual(
		res.people.map((p) => p.user_id),
		[ADA],
	);
	assert.ok(res.loadedPillars.includes("demo"));
	assert.deepEqual(
		res.steps.map((s) => s.name),
		["load_pillar", "find_demo"],
	);
	const types = events.map((e) => e.type);
	for (const t of [
		"pillar_loaded",
		"tool_call",
		"tool_result",
		"people",
		"answer",
		"done",
	])
		assert.ok(types.includes(t), `missing event ${t}`);
});

test("loop: calling a tool from an unloaded pillar reports unavailable", async () => {
	const { deps } = harness(demoRegistry());
	const respond = scripted([
		{ id: "r1", functionCalls: [fc("c1", "find_demo", { q: "x" })], text: "" },
		{ id: "r2", functionCalls: [], text: "Nothing found." },
	]);
	const res = await runAgent(
		{ ...baseInput, text: "ada?" },
		{ ...deps, respond },
	);
	assert.equal(res.people.length, 0);
	assert.match(res.steps[0].summary, /isn't available/);
});

test("loop: MAX_STEPS exhausted → forced final answer", async () => {
	const { deps } = harness(demoRegistry());
	// Always request a tool while tools are offered; the forced call gets none.
	const respond: RespondFn = async (params: CreateResponseParams) =>
		params.tools.length === 0
			? { id: "rf", functionCalls: [], text: "Final after cap." }
			: {
					id: "r",
					functionCalls: [fc("c", "load_pillar", { pillar_id: "demo" })],
					text: "",
				};
	const res = await runAgent(
		{ ...baseInput, text: "loop" },
		{ ...deps, respond },
	);
	assert.equal(res.answer, "Final after cap.");
	assert.equal(res.steps.length, 20); // one tool call per capped step (MAX_STEPS)
});

test("loop: final answer is sanitized against collected ids", async () => {
	const { deps } = harness(demoRegistry());
	const respond = scripted([
		{
			id: "r1",
			functionCalls: [fc("c1", "load_pillar", { pillar_id: "demo" })],
			text: "",
		},
		{ id: "r2", functionCalls: [fc("c2", "find_demo", { q: "x" })], text: "" },
		{
			id: "r3",
			functionCalls: [],
			text: `Maybe @[Ghost](beacon:${GHOST}) or @[Ada](beacon:${ADA}).`,
		},
	]);
	const res = await runAgent(
		{ ...baseInput, text: "who" },
		{ ...deps, respond },
	);
	assert.ok(!res.answer.includes(GHOST), "uncollected id should be dropped");
	assert.ok(res.answer.includes(ADA), "collected id should remain");
	assert.match(res.answer, /Ghost/); // downgraded to plain text
});

const PERSON = (name: string, id: string): CollectedPerson => ({
	user_id: id,
	name,
	avatar_url: null,
	best_chunk: null,
	score: 1,
});

test("linkifyMentions: rewrites bold + plain names into the citation token", () => {
	const people = [PERSON("Local Admin", ADA)];
	assert.equal(
		linkifyMentions("Best match: **Local Admin** is great.", people),
		`Best match: @[Local Admin](beacon:${ADA}) is great.`,
	);
	assert.equal(
		linkifyMentions("I'd talk to Local Admin about iOS.", people),
		`I'd talk to @[Local Admin](beacon:${ADA}) about iOS.`,
	);
});

test("linkifyMentions: handles an @-prefixed plain name (no double @)", () => {
	const people = [PERSON("Local Admin", ADA)];
	assert.equal(
		linkifyMentions("@Local Admin is a Team Lead.", people),
		`@[Local Admin](beacon:${ADA}) is a Team Lead.`,
	);
});

test("linkifyMentions: leaves existing tokens + non-people text untouched", () => {
	const people = [PERSON("Local Admin", ADA)];
	const already = `See @[Local Admin](beacon:${ADA}).`;
	assert.equal(linkifyMentions(already, people), already); // no double-wrap
	assert.equal(
		linkifyMentions("Nobody named here.", people),
		"Nobody named here.",
	);
});

test("stripLeakedToolArgs: removes leaked tool-call syntax + arg JSON", () => {
	const leaked =
		'Trying variants. {"project":"","organization":"x","include_pending":true} ' +
		"to=functions.find_people_by 【json】 Final answer.";
	const out = stripLeakedToolArgs(leaked);
	assert.ok(!out.includes("to=functions"));
	assert.ok(!out.includes('"include_pending"'));
	assert.ok(!out.includes("【"));
	assert.ok(out.includes("Final answer."));
});

test("loop: no API key → degrades to legacy search", async () => {
	const { deps } = harness(demoRegistry());
	const legacy: LegacyFn = async () => ({
		answer: `Legacy: @[Bob](beacon:${ADA}).`,
		people: [
			{
				user_id: ADA,
				name: "Bob",
				avatar_url: null,
				best_chunk: null,
				score: 0.5,
			},
		],
		dsl: {
			org_tags: [],
			school_groups: [],
			skills: [],
			tags: [],
			semantic_query: "",
			needs_clarification: null,
		},
	});
	const respond: RespondFn = async () => {
		throw new Error("respond must not be called when degraded");
	};
	const res = await runAgent(
		{ ...baseInput, text: "find bob" },
		{ ...deps, respond, legacy, configured: false },
	);
	assert.equal(res.answer, `Legacy: @[Bob](beacon:${ADA}).`);
	assert.deepEqual(
		res.people.map((p) => p.name),
		["Bob"],
	);
});
