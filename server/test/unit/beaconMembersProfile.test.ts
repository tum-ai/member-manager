import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	compactProfileText,
	membersPillar,
} from "../../src/lib/agent/pillars/members.js";
import type { PillarTool, ToolContext } from "../../src/lib/agent/types.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";

type Row = Record<string, unknown>;

class ResolveQuery {
	private filters: ((row: Row) => boolean)[] = [];
	private rows: Row[];

	constructor(rows: Row[]) {
		this.rows = rows;
	}

	select() {
		return this;
	}

	or() {
		return this;
	}

	limit(limit: number) {
		this.rows = this.rows.slice(0, limit);
		return this;
	}

	eq(column: string, value: unknown) {
		this.filters.push((row) => row[column] === value);
		return this;
	}

	in(column: string, values: unknown[]) {
		this.filters.push((row) => values.includes(row[column]));
		return this;
	}

	// biome-ignore lint/suspicious/noThenProperty: intentional Supabase test double
	then(resolve: (value: { data: Row[]; error: null }) => void) {
		resolve({
			data: this.rows.filter((row) =>
				this.filters.every((filter) => filter(row)),
			),
			error: null,
		});
	}
}

function resolveDb(): SupabaseClient {
	const tables: Record<string, Row[]> = {
		members: [
			{
				user_id: "visible",
				given_name: "Ada",
				surname: "Active",
				member_status: "active",
			},
			{
				user_id: "hidden",
				given_name: "Grace",
				surname: "Opted Out",
				member_status: "active",
			},
		],
		beacon_person: [{ user_id: "hidden", opted_out: true }],
	};
	return {
		from: (table: string) => new ResolveQuery(tables[table] ?? []),
	} as unknown as SupabaseClient;
}

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

test("resolve_person: excludes opted-out members", async () => {
	setSupabaseClient(resolveDb());
	const tool = membersPillar.tools.find(
		(candidate) => candidate.name === "resolve_person",
	) as PillarTool;
	const result = await tool.run({ name: "Ada" }, {
		supabase: resolveDb(),
	} as unknown as ToolContext);

	assert.deepEqual(
		result.people?.map((person) => person.user_id),
		["visible"],
	);
	assert.doesNotMatch(result.content, /Grace/);
});
