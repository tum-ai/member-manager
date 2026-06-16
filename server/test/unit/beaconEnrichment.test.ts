import assert from "node:assert/strict";
import { test } from "node:test";
import {
	CONFIRM_THRESHOLD,
	gateStatus,
	normalizeYear,
} from "../../src/lib/claims.js";
import { pdlToClaims } from "../../src/lib/pdl.js";
import { parseTags } from "../../src/lib/researchAgent.js";

test("gateStatus: self is always confirmed", () => {
	assert.equal(gateStatus(0.1, false, "self"), "confirmed");
});

test("gateStatus: high-confidence + identity-confirmed → confirmed", () => {
	assert.equal(gateStatus(0.9, true, "pdl"), "confirmed");
	assert.equal(gateStatus(CONFIRM_THRESHOLD, true, "pdl"), "confirmed");
});

test("gateStatus: high-confidence but identity NOT confirmed → pending", () => {
	assert.equal(gateStatus(0.99, false, "web_search"), "pending");
});

test("gateStatus: low-confidence → pending even if identity confirmed", () => {
	assert.equal(gateStatus(0.6, true, "pdl"), "pending");
});

test("normalizeYear: accepts 4-digit, rejects junk and out-of-range", () => {
	assert.equal(normalizeYear(2019), 2019);
	assert.equal(normalizeYear("2020"), 2020);
	assert.equal(normalizeYear("19"), null);
	assert.equal(normalizeYear("abcd"), null);
	assert.equal(normalizeYear(1700), null);
	assert.equal(normalizeYear(null), null);
});

test("pdlToClaims: maps experience/education/skills with confidence", () => {
	const claims = pdlToClaims({
		identityConfirmed: true,
		baseConfidence: 0.9,
		person: {
			job_title: "Staff Engineer",
			experience: [
				{
					company: { name: "Google" },
					title: { name: "Senior iOS Engineer" },
					start_date: "2019-06",
					end_date: null,
					is_primary: true,
				},
			],
			education: [
				{
					school: { name: "TU Munich" },
					degrees: ["MSc"],
					majors: ["Informatics"],
					start_date: "2016",
					end_date: "2018",
				},
			],
			skills: ["Swift", ""],
		},
	});

	const emp = claims.find((c) => c.type === "employment");
	assert.ok(emp && emp.type === "employment");
	assert.equal(emp.organizationName, "Google");
	assert.equal(emp.startYear, 2019);
	assert.equal(emp.isCurrent, true);
	assert.equal(emp.confidence, 0.9);

	const edu = claims.find((c) => c.type === "education");
	assert.ok(edu && edu.type === "education");
	assert.equal(edu.schoolName, "TU Munich");
	assert.equal(edu.degree, "MSc");
	assert.equal(edu.endYear, 2018);

	// One empty skill string is dropped.
	const skills = claims.filter((c) => c.type === "skill");
	assert.equal(skills.length, 1);
	assert.equal(skills[0].confidence, 0.9 * 0.8);
});

test("parseTags: keeps only allowed, dedupes, clamps confidence", () => {
	const allowed = ["ios", "ml_ai"];
	const out = parseTags(
		JSON.stringify({
			tags: [
				{ tag: "ios", confidence: 0.9 },
				{ tag: "ios", confidence: 0.7 }, // dupe dropped
				{ tag: "not_a_tag", confidence: 0.9 }, // not allowed
				{ tag: "ml_ai", confidence: 1.5 }, // clamped to 1
			],
		}),
		allowed,
	);
	assert.equal(out.length, 2);
	assert.equal(out[0].tag, "ios");
	assert.equal(out[1].tag, "ml_ai");
	assert.equal(out[1].confidence, 1);
});

test("parseTags: invalid JSON → empty", () => {
	assert.deepEqual(parseTags("not json", ["ios"]), []);
});
