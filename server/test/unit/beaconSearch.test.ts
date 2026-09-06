import assert from "node:assert/strict";
import { test } from "node:test";
import { SearchDslSchema } from "../../src/lib/searchDsl.js";
import {
	fallbackParse,
	mergeSkillMatches,
	sanitizeAnswerMentions,
	tokenizeForSkills,
} from "../../src/lib/searchLlm.js";

const VOCAB = {
	orgTags: ["bigtech", "faang"],
	schoolGroups: ["ivy_league", "oxbridge"],
	capabilityTags: [
		{ tag: "ios", label: "iOS" },
		{ tag: "shipped_app_store", label: "Shipped App Store app" },
	],
};

test("fallbackParse: detects big tech + ivy league + capability tag", () => {
	const dsl = fallbackParse(
		"senior ios engineer at a big tech company with an ivy league degree",
		VOCAB,
	);
	assert.ok(dsl.org_tags.includes("bigtech"));
	assert.ok(dsl.school_groups.includes("ivy_league"));
	assert.ok(dsl.tags.includes("ios"));
	assert.equal(dsl.semantic_query.length > 0, true);
});

test("fallbackParse: matches capability tag by label phrase", () => {
	const dsl = fallbackParse("who shipped app store app", VOCAB);
	assert.ok(dsl.tags.includes("shipped_app_store"));
});

test("fallbackParse: plain query → no filters, semantic only", () => {
	const dsl = fallbackParse("someone who loves climbing", VOCAB);
	assert.deepEqual(dsl.org_tags, []);
	assert.deepEqual(dsl.tags, []);
	assert.equal(dsl.semantic_query, "someone who loves climbing");
});

test("tokenizeForSkills: emits unigrams + bigrams incl. 'python'", () => {
	const toks = tokenizeForSkills("who speaks python");
	assert.ok(toks.includes("python"));
	assert.ok(toks.includes("who speaks"));
	assert.ok(toks.includes("speaks python"));
});

test("tokenizeForSkills: keeps multiword skill keys like 'core ml'", () => {
	const toks = tokenizeForSkills("anyone good at Core ML on iOS");
	assert.ok(toks.includes("core ml"));
});

test("mergeSkillMatches: merges + dedups into skills[]", () => {
	const dsl = SearchDslSchema.parse({ skills: ["Swift"] });
	const merged = mergeSkillMatches(dsl, ["Python", "Swift"]);
	assert.deepEqual([...merged.skills].sort(), ["Python", "Swift"]);
});

test("mergeSkillMatches: no matches → unchanged", () => {
	const dsl = SearchDslSchema.parse({ skills: ["Swift"] });
	assert.deepEqual(mergeSkillMatches(dsl, []).skills, ["Swift"]);
});

test("sanitizeAnswerMentions: keeps valid ids, downgrades unknown", () => {
	const valid = new Set(["11111111-1111-1111-1111-111111111111"]);
	const input =
		"See @[Ana](beacon:11111111-1111-1111-1111-111111111111) and " +
		"@[Ghost](beacon:99999999-9999-9999-9999-999999999999).";
	const out = sanitizeAnswerMentions(input, valid);
	assert.match(out, /@\[Ana\]\(beacon:11111111-1111-1111-1111-111111111111\)/);
	assert.ok(!out.includes("beacon:99999999"));
	assert.match(out, /Ghost/); // downgraded to plain text
});
