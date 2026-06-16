import assert from "node:assert/strict";
import { test } from "node:test";
import {
	clusterRoles,
	rolesMatch,
	titleCaseName,
} from "../../src/lib/claimConsolidation.js";

test("titleCaseName: capitalizes plain words, preserves acronyms/proper nouns", () => {
	assert.equal(titleCaseName("mathematics tutor"), "Mathematics Tutor");
	assert.equal(
		titleCaseName("system administrator / software developer"),
		"System Administrator / Software Developer",
	);
	assert.equal(titleCaseName("westend61 gmbh"), "westend61 GmbH");
	assert.equal(titleCaseName("TUM.ai"), "TUM.ai"); // has caps → preserved
	assert.equal(titleCaseName("AWS"), "AWS");
	assert.equal(titleCaseName("BenGER"), "BenGER");
	assert.equal(titleCaseName(null), "");
});

test("rolesMatch: same job worded differently (overlapping years) → true", () => {
	assert.equal(
		rolesMatch(
			"system administrator / software developer",
			2024,
			null,
			"Software Developer & System Administrator (Working Student)",
			2024,
			null,
		),
		true,
	);
});

test("rolesMatch: distinct roles at same org → false", () => {
	assert.equal(
		rolesMatch(
			"Fundamentals of Programming Tutor",
			2024,
			2025,
			"Operating Systems Tutor",
			2025,
			2026,
		),
		false,
	);
});

test("rolesMatch: empty titles + overlapping years → same; disjoint years → not", () => {
	assert.equal(rolesMatch(null, 2020, 2022, null, 2021, 2023), true);
	assert.equal(rolesMatch("X", 2010, 2011, "X", 2020, 2021), false);
});

test("clusterRoles: merges the twin, keeps a distinct role separate", () => {
	const rows = [
		{
			title: "system administrator / software developer",
			start_year: 2024,
			end_year: null,
		},
		{
			title: "Software Developer & System Administrator (Working Student)",
			start_year: 2024,
			end_year: null,
		},
		{ title: "Operating Systems Tutor", start_year: 2025, end_year: 2026 },
	];
	const clusters = clusterRoles(rows);
	assert.equal(clusters.length, 2);
	assert.equal(clusters[0].length, 2); // the two westend61 wordings merged
	assert.equal(clusters[1].length, 1); // the tutor role stays separate
});
