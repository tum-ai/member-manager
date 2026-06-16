import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildChunksForProfile,
	toVectorLiteral,
} from "../../src/lib/searchChunks.js";

// Minimal profile shape accepted by buildChunksForProfile.
function profile(over: Record<string, unknown> = {}) {
	return {
		person: null,
		employment: [],
		education: [],
		skills: [],
		projects: [],
		tags: [],
		...over,
		// biome-ignore lint/suspicious/noExplicitAny: test fixture
	} as any;
}

test("buildChunks: headline + bio from person", () => {
	const chunks = buildChunksForProfile(
		profile({
			person: { headline: "Senior iOS eng", summary: "I ship apps." },
		}),
	);
	assert.deepEqual(
		chunks.map((c) => c.kind),
		["headline", "bio"],
	);
});

test("buildChunks: employment includes org tags for lexical match", () => {
	const chunks = buildChunksForProfile(
		profile({
			employment: [
				{
					title: "Senior iOS Engineer",
					is_current: false,
					start_year: 2019,
					end_year: 2023,
					raw_value: "Google",
					organization: { name: "Google", tags: ["bigtech", "faang"] },
				},
			],
		}),
	);
	assert.equal(chunks.length, 1);
	assert.equal(chunks[0].kind, "employment");
	assert.match(chunks[0].content, /Senior iOS Engineer at Google/);
	assert.match(chunks[0].content, /bigtech, faang/);
	assert.match(chunks[0].content, /2019–2023/);
});

test("buildChunks: skills collapse into one skill_cluster chunk", () => {
	const chunks = buildChunksForProfile(
		profile({
			skills: [
				{ raw_value: null, skill: { name: "Swift" } },
				{ raw_value: null, skill: { name: "Core ML" } },
			],
		}),
	);
	assert.equal(chunks.length, 1);
	assert.equal(chunks[0].kind, "skill_cluster");
	assert.equal(chunks[0].content, "Skills: Swift, Core ML");
});

test("buildChunks: tags use vocabulary labels", () => {
	const chunks = buildChunksForProfile(
		profile({
			tags: [
				{
					tag: "shipped_app_store",
					vocabulary: { label: "Shipped App Store app" },
				},
				{ tag: "ios", vocabulary: null },
			],
		}),
	);
	assert.equal(chunks[0].kind, "tag");
	assert.equal(chunks[0].content, "Capabilities: Shipped App Store app, ios");
});

test("buildChunks: empty profile → no chunks", () => {
	assert.deepEqual(buildChunksForProfile(profile()), []);
});

test("toVectorLiteral: array → pgvector literal; null → null", () => {
	assert.equal(toVectorLiteral([0.1, 0.2, 0.3]), "[0.1,0.2,0.3]");
	assert.equal(toVectorLiteral(null), null);
});
