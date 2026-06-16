import assert from "node:assert/strict";
import { test } from "node:test";
import { tagSlug } from "../../src/lib/beacon.js";
import { kindFromUrl, parseResearchJson } from "../../src/lib/webResearch.js";

test("tagSlug: normalizes to snake_case, idempotent on slugs", () => {
	assert.equal(tagSlug("Cloud Infrastructure"), "cloud_infrastructure");
	assert.equal(tagSlug("shipped_app_store"), "shipped_app_store");
	assert.equal(tagSlug("  C++ / Rust  "), "c_rust");
	assert.equal(tagSlug("iOS"), "ios");
});

test("kindFromUrl: classifies provenance source", () => {
	assert.equal(kindFromUrl("https://github.com/lanfermann"), "github");
	assert.equal(
		kindFromUrl("https://www.linkedin.com/in/lanfermann"),
		"linkedin",
	);
	assert.equal(kindFromUrl("https://lanfermann.substack.com/p/x"), "blog");
	assert.equal(kindFromUrl("https://example.com/about"), "web_search");
	assert.equal(kindFromUrl(""), "web_search");
});

test("parseResearchJson: extracts claims + source URLs from wrapped JSON", () => {
	const text = `Here is what I found:
{
  "summary": "Software engineer and founder.",
  "employment": [
    {"organization":"Google","title":"SWE","start_year":2019,"end_year":2022,"is_current":false,"confidence":0.8,"source_url":"https://linkedin.com/in/x"}
  ],
  "education": [
    {"school":"TU Munich","degree":"BSc","field":"CS","confidence":0.7,"source_url":"https://tum.de"}
  ],
  "projects": [
    {"name":"openlib","url":"https://github.com/x/openlib","description":"a lib","role":"maintainer","confidence":0.6,"source_url":"https://github.com/x/openlib"}
  ],
  "skills": [{"name":"Rust","confidence":0.9,"source_url":"https://github.com/x"}],
  "tags": [{"tag":"open_source","label":"Open-source contributor","category":"capability","confidence":0.85,"source_url":"https://github.com/x"}]
}
Hope that helps!`;

	const res = parseResearchJson(text);
	assert.equal(res.summary, "Software engineer and founder.");
	assert.equal(res.items.length, 5);

	const emp = res.items.find((i) => i.claim.type === "employment");
	assert.ok(emp);
	assert.equal(emp.sourceUrl, "https://linkedin.com/in/x");
	if (emp.claim.type === "employment") {
		assert.equal(emp.claim.organizationName, "Google");
		assert.equal(emp.claim.startYear, 2019);
		assert.equal(emp.claim.confidence, 0.8);
	}

	const tag = res.items.find((i) => i.claim.type === "tag");
	assert.ok(tag && tag.claim.type === "tag");
	if (tag.claim.type === "tag") {
		assert.equal(tag.claim.tag, "open_source");
		assert.equal(tag.claim.label, "Open-source contributor");
		assert.equal(tag.claim.category, "capability");
	}
});

test("parseResearchJson: junk → empty", () => {
	assert.deepEqual(parseResearchJson("no json here"), {
		items: [],
		summary: null,
	});
});
