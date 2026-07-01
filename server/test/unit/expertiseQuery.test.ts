import "../setup.js";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
	answerExpertiseQuery,
	type ExpertiseCandidate,
	rankByKeyword,
} from "../../src/lib/expertiseQuery.js";

function candidate(
	overrides: Partial<ExpertiseCandidate> & Pick<ExpertiseCandidate, "userId">,
): ExpertiseCandidate {
	return {
		name: overrides.userId,
		department: null,
		batch: null,
		degree: null,
		school: null,
		expertiseSummary: null,
		expertiseTags: [],
		...overrides,
	};
}

describe("rankByKeyword", () => {
	test("orders candidates by descending score", () => {
		const candidates = [
			candidate({
				userId: "a",
				name: "Alice",
				expertiseTags: ["machine", "learning"],
			}),
			candidate({
				userId: "b",
				name: "Bob",
				expertiseTags: ["learning"],
			}),
		];

		const matches = rankByKeyword("machine learning pipelines", candidates);

		assert.equal(matches.length, 2);
		assert.equal(matches[0].userId, "a");
		assert.equal(matches[1].userId, "b");
		assert.ok(matches[0].score > matches[1].score);
	});

	test("breaks ties by name ascending", () => {
		const candidates = [
			candidate({ userId: "z", name: "Zoe", expertiseTags: ["react"] }),
			candidate({ userId: "a", name: "Amir", expertiseTags: ["react"] }),
		];

		const matches = rankByKeyword("react frontend", candidates);

		assert.equal(matches.length, 2);
		assert.equal(matches[0].score, matches[1].score);
		assert.equal(matches[0].userId, "a");
		assert.equal(matches[1].userId, "z");
	});

	test("returns empty for empty tags / no overlap", () => {
		const candidates = [
			candidate({ userId: "a", name: "Alice", expertiseTags: [] }),
			candidate({
				userId: "b",
				name: "Bob",
				expertiseSummary: "cooking and baking",
			}),
		];

		assert.deepEqual(rankByKeyword("quantum computing", candidates), []);
	});

	test("matches case-insensitively across fields", () => {
		const candidates = [
			candidate({
				userId: "a",
				name: "Alice",
				department: "Research",
				expertiseSummary: "Deep NLP research",
			}),
		];

		const matches = rankByKeyword("NLP RESEARCH", candidates);

		assert.equal(matches.length, 1);
		assert.equal(matches[0].userId, "a");
		assert.ok(matches[0].reason.startsWith("Matched:"));
	});

	test("caps results at 10", () => {
		const candidates = Array.from({ length: 15 }, (_, index) =>
			candidate({
				userId: `u${index}`,
				name: `User ${String(index).padStart(2, "0")}`,
				expertiseTags: ["python"],
			}),
		);

		const matches = rankByKeyword("python", candidates);

		assert.equal(matches.length, 10);
	});

	test("clamps normalized score into [0,1]", () => {
		const candidates = [
			candidate({
				userId: "a",
				name: "Alice",
				expertiseTags: ["design", "figma", "prototyping"],
			}),
		];

		const matches = rankByKeyword("design", candidates);

		assert.equal(matches.length, 1);
		assert.ok(matches[0].score > 0 && matches[0].score <= 1);
	});
});

describe("answerExpertiseQuery without OPENAI_API_KEY", () => {
	let savedKey: string | undefined;

	beforeEach(() => {
		savedKey = process.env.OPENAI_API_KEY;
		delete process.env.OPENAI_API_KEY;
	});

	afterEach(() => {
		if (savedKey === undefined) {
			delete process.env.OPENAI_API_KEY;
		} else {
			process.env.OPENAI_API_KEY = savedKey;
		}
	});

	test("falls back to deterministic keyword ranking", async () => {
		const candidates = [
			candidate({
				userId: "a",
				name: "Alice",
				expertiseTags: ["kubernetes", "devops"],
			}),
			candidate({ userId: "b", name: "Bob", expertiseTags: ["kubernetes"] }),
		];

		const result = await answerExpertiseQuery(
			"who knows kubernetes devops",
			candidates,
		);

		assert.equal(result.source, "fallback");
		assert.equal(result.matches[0].userId, "a");
		assert.deepEqual(
			result.matches,
			rankByKeyword("who knows kubernetes devops", candidates),
		);
		assert.ok(result.answer.includes("Alice"));
	});

	test("returns an empty fallback for no candidates", async () => {
		const result = await answerExpertiseQuery("anything", []);

		assert.equal(result.source, "fallback");
		assert.deepEqual(result.matches, []);
		assert.ok(result.answer.includes("No members matched"));
	});
});

describe("answerExpertiseQuery with OPENAI_API_KEY", () => {
	let savedKey: string | undefined;
	let savedFetch: typeof globalThis.fetch;

	beforeEach(() => {
		savedKey = process.env.OPENAI_API_KEY;
		savedFetch = globalThis.fetch;
		process.env.OPENAI_API_KEY = "test-key";
	});

	afterEach(() => {
		if (savedKey === undefined) {
			delete process.env.OPENAI_API_KEY;
		} else {
			process.env.OPENAI_API_KEY = savedKey;
		}
		globalThis.fetch = savedFetch;
	});

	function stubFetch(result: { ok: boolean; content?: string }): void {
		globalThis.fetch = (async () => ({
			ok: result.ok,
			json: async () => ({
				choices: [{ message: { content: result.content ?? "" } }],
			}),
		})) as unknown as typeof globalThis.fetch;
	}

	const candidates = [
		candidate({ userId: "a", name: "Alice", expertiseTags: ["ml"] }),
		candidate({ userId: "b", name: "Bob", expertiseTags: ["ml"] }),
	];

	test("parses the LLM answer, filtering hallucinated ids and clamping scores", async () => {
		stubFetch({
			ok: true,
			content: JSON.stringify({
				answer: "Alice leads ML.",
				matches: [
					{ userId: "a", score: 0.8, reason: "ML lead" },
					{ userId: "ghost", score: 0.99, reason: "not a real member" },
					{ userId: "b", score: 5, reason: "over range" },
				],
			}),
		});

		const result = await answerExpertiseQuery("who knows ml", candidates);

		assert.equal(result.source, "llm");
		assert.equal(result.answer, "Alice leads ML.");
		assert.equal(result.matches.length, 2);
		assert.deepEqual([...result.matches.map((m) => m.userId)].sort(), [
			"a",
			"b",
		]);
		const byId = new Map(result.matches.map((m) => [m.userId, m.score]));
		assert.equal(byId.get("b"), 1); // 5 clamped to 1
		assert.equal(byId.get("a"), 0.8);
	});

	test("coerces a non-numeric score to 0", async () => {
		stubFetch({
			ok: true,
			content: JSON.stringify({
				answer: "x",
				matches: [{ userId: "a", score: "abc", reason: "r" }],
			}),
		});

		const result = await answerExpertiseQuery("who knows ml", candidates);

		assert.equal(result.source, "llm");
		assert.equal(result.matches[0].score, 0);
	});

	test("falls back when the model returns malformed JSON", async () => {
		stubFetch({ ok: true, content: "not json {" });

		const result = await answerExpertiseQuery("who knows ml", candidates);

		assert.equal(result.source, "fallback");
	});

	test("falls back on a non-ok response", async () => {
		stubFetch({ ok: false });

		const result = await answerExpertiseQuery("who knows ml", candidates);

		assert.equal(result.source, "fallback");
	});
});
