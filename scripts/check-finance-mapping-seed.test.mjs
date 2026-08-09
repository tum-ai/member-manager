// Guard: the confirmed live Kostenstelle codes from
// docs/finance-cost-location-mapping.md must stay seeded in
// supabase/finance_department_mappings so a `supabase db reset` reproduces the
// department + sub-team decode the LnF relies on. Parses supabase/seed.sql
// directly — fully offline and deterministic, so it runs everywhere without a
// live stack.
//
// These three were previously missing from the reproducible seed even though the
// mapping doc marks them confirmed: 53 (Venture / Quant Finance), 60 (Makeathon
// general) and Berlin 111 (Community / Onboarding). Because normalizeCostLocation
// only strips leading zeroes, 111 does not collapse into 11 and needs its own row.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Every value row inside the finance_department_mappings insert, as
// { costLocation, department, subTeam }.
export function extractDepartmentMappings(source) {
	const insertStart = source.indexOf(
		"insert into public.finance_department_mappings",
	);
	assert.ok(
		insertStart !== -1,
		"supabase/seed.sql no longer inserts into finance_department_mappings",
	);
	const block = source.slice(
		insertStart,
		source.indexOf("on conflict", insertStart),
	);
	const rowPattern =
		/\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*(null|'[^']*')\s*,\s*(null|'[^']*')\s*\)/g;
	const rows = [];
	for (const match of block.matchAll(rowPattern)) {
		rows.push({
			costLocation: match[1],
			department: match[2],
			subTeam: match[4] === "null" ? null : match[4].slice(1, -1),
		});
	}
	return rows;
}

// The confirmed live codes that must never silently drop out of the seed again.
const CONFIRMED_CODES = [
	{ costLocation: "53", department: "Venture", subTeam: "Quant Finance" },
	{ costLocation: "60", department: "Makeathon", subTeam: null },
	{ costLocation: "111", department: "Community", subTeam: "Onboarding" },
];

test("extractDepartmentMappings parses the seed insert rows", () => {
	const sample = [
		"insert into public.finance_department_mappings",
		"    (cost_location, department, bereich, sub_team)",
		"values",
		"    ('60', 'Makeathon', null, null),",
		"    ('111', 'Community', null, 'Onboarding')",
		"on conflict (cost_location) do update set",
		"    department = excluded.department;",
	].join("\n");
	assert.deepEqual(extractDepartmentMappings(sample), [
		{ costLocation: "60", department: "Makeathon", subTeam: null },
		{ costLocation: "111", department: "Community", subTeam: "Onboarding" },
	]);
});

test("supabase/seed.sql seeds every confirmed finance cost-location code", () => {
	const seed = readFileSync(resolve(repoRoot, "supabase/seed.sql"), "utf8");
	const rows = extractDepartmentMappings(seed);
	const byCode = new Map(rows.map((row) => [row.costLocation, row]));
	for (const expected of CONFIRMED_CODES) {
		const actual = byCode.get(expected.costLocation);
		assert.ok(
			actual,
			`supabase/seed.sql is missing confirmed cost location '${expected.costLocation}' (${expected.department}). See docs/finance-cost-location-mapping.md.`,
		);
		assert.equal(
			actual.department,
			expected.department,
			`cost location '${expected.costLocation}' should map to ${expected.department}, got ${actual.department}`,
		);
		assert.equal(
			actual.subTeam,
			expected.subTeam,
			`cost location '${expected.costLocation}' should have sub-team ${JSON.stringify(expected.subTeam)}, got ${JSON.stringify(actual.subTeam)}`,
		);
	}
});
