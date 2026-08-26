import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { orgPillar } from "../../src/lib/agent/pillars/org.js";
import type { PillarTool, ToolContext } from "../../src/lib/agent/types.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";

type Rows = Record<string, unknown>[];
class FakeQuery {
	private filters: ((r: Record<string, unknown>) => boolean)[] = [];
	constructor(private data: Rows) {}
	select() {
		return this;
	}
	order() {
		return this;
	}
	limit() {
		return this;
	}
	eq(col: string, val: unknown) {
		this.filters.push((r) => r[col] === val);
		return this;
	}
	in(col: string, vals: unknown[]) {
		this.filters.push((r) => vals.includes(r[col]));
		return this;
	}
	not(col: string, op: string, val: unknown) {
		if (op === "is" && val === null)
			this.filters.push((r) => r[col] !== null && r[col] !== undefined);
		return this;
	}
	// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
	then(resolve: (v: { data: Rows }) => void) {
		resolve({ data: this.data.filter((r) => this.filters.every((f) => f(r))) });
	}
}
const fakeDb = (tables: Record<string, Rows>): SupabaseClient =>
	({
		from: (t: string) => new FakeQuery(tables[t] ?? []),
	}) as unknown as SupabaseClient;

const ctx = {} as unknown as ToolContext; // handlers read data via getSupabase()
const tool = (name: string): PillarTool => {
	const t = orgPillar.tools.find((x) => x.name === name);
	if (!t) throw new Error(`no tool ${name}`);
	return t;
};

const members: Rows = [
	{
		user_id: "u1",
		given_name: "Ada",
		surname: "Lovelace",
		department: "Software Development",
		batch: "WS24",
		member_status: "active",
		member_role: "Team Lead",
		board_role: null,
	},
	{
		user_id: "u2",
		given_name: "Alan",
		surname: "Turing",
		department: "Software Development",
		batch: "WS24",
		member_status: "alumni",
		member_role: "Team Lead",
		board_role: null,
	},
];

test("orgPillar: shape — id + 4 named tools", () => {
	assert.equal(orgPillar.id, "org");
	assert.deepEqual(orgPillar.tools.map((t) => t.name).sort(), [
		"find_role_holders",
		"list_departments",
		"people_in_batch",
		"people_in_department",
	]);
});

test("list_departments: aggregate text, no people harvested", async () => {
	setSupabaseClient(fakeDb({ members }));
	const res = await tool("list_departments").run({}, ctx);
	assert.match(res.content, /Software Development: 1 member/);
	assert.equal(res.people, undefined);
});

test("people_in_department: include_alumni cannot widen Beacon visibility", async () => {
	setSupabaseClient(fakeDb({ members }));
	const active = await tool("people_in_department").run(
		{ department: "softdev" },
		ctx,
	);
	assert.deepEqual(
		active.people?.map((p) => p.user_id),
		["u1"],
	);

	const all = await tool("people_in_department").run(
		{ department: "softdev", include_alumni: true },
		ctx,
	);
	assert.deepEqual(
		all.people?.map((p) => p.user_id),
		["u1"],
	);
});

test("find_role_holders: unknown role → guidance, no people", async () => {
	setSupabaseClient(fakeDb({ members }));
	const res = await tool("find_role_holders").run({ role: "wizard" }, ctx);
	assert.match(res.content, /isn't a role I track/);
	assert.equal(res.people, undefined);
});

test("find_role_holders: current holders from member_role", async () => {
	setSupabaseClient(fakeDb({ members }));
	const res = await tool("find_role_holders").run({ role: "team lead" }, ctx);
	assert.deepEqual(
		res.people?.map((p) => p.user_id),
		["u1"],
	);
	assert.match(res.content, /Current Team Lead/);
});

test("find_role_holders: current year is treated as current, not history", async () => {
	// No member_role_history table on purpose: if year==now wrongly routed to
	// history this would return empty (the gpt-5.4-mini failure mode).
	setSupabaseClient(fakeDb({ members }));
	const now = new Date().getFullYear();
	const res = await tool("find_role_holders").run(
		{ role: "team lead", year: now },
		ctx,
	);
	assert.deepEqual(
		res.people?.map((p) => p.user_id),
		["u1"],
	);
	assert.match(res.content, /Current Team Lead/);
});

test("find_role_holders: year routes to history + emits dept caveat", async () => {
	setSupabaseClient(
		fakeDb({
			member_role_history: [
				{
					user_id: "u1",
					role: "Team Lead",
					semester: "WS23/24",
					started_at: "2023-09-01",
					ended_at: "2024-02-28",
				},
			],
			members,
		}),
	);
	const res = await tool("find_role_holders").run(
		{ role: "team lead", year: 2023 },
		ctx,
	);
	assert.deepEqual(
		res.people?.map((p) => p.user_id),
		["u1"],
	);
	assert.match(res.content, /Team Lead in 2023/);
	assert.match(res.content, /role history records the role and dates only/);
	assert.equal(res.people?.[0].score, 0.9);
});
