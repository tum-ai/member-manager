import assert from "node:assert/strict";
import { test } from "node:test";
import { compactProfileText } from "../../src/lib/agent/pillars/members.js";

test("compactProfileText: sorts experience earliest-first + flags unverified", () => {
	const text = compactProfileText({
		user_id: "u1",
		person: { headline: "iOS engineer", summary: null },
		member: { given_name: "Justin", surname: "L", member_role: "Member" },
		employment: [
			{
				title: "Senior Engineer",
				is_current: true,
				start_year: 2022,
				end_year: null,
				raw_value: "Apple",
				status: "confirmed",
				organization: { name: "Apple" },
			},
			{
				title: "Intern",
				is_current: false,
				start_year: 2019,
				end_year: 2020,
				raw_value: "Google",
				status: "pending",
				organization: { name: "Google" },
			},
		],
		education: [],
		skills: [
			{ raw_value: "Swift", status: "confirmed", skill: { name: "Swift" } },
		],
		projects: [],
		tags: [],
		counts: { confirmed: 0, pending: 0, rejected: 0 },
	} as never);

	assert.ok(text.includes("Name: @[Justin L](beacon:u1)"));
	// Earliest-first: the 2019 Google intern role appears before the 2022 Apple role.
	assert.ok(text.indexOf("Google") < text.indexOf("Apple"));
	// Pending employment flagged unverified; confirmed not.
	assert.match(text, /Intern at Google, 2019–2020 \(unverified\)/);
	assert.ok(text.includes("Senior Engineer at Apple, 2022–present"));
	assert.ok(!text.includes("Apple, 2022–present (unverified)"));
	assert.ok(text.includes("Skills: Swift"));
});

test("compactProfileText: minimal profile still renders a name", () => {
	const text = compactProfileText({
		user_id: "u1",
		person: null,
		member: { given_name: "Ada", surname: null },
		employment: [],
		education: [],
		skills: [],
		projects: [],
		tags: [],
		counts: { confirmed: 0, pending: 0, rejected: 0 },
	} as never);
	assert.ok(text.includes("Name: @[Ada](beacon:u1)"));
});
