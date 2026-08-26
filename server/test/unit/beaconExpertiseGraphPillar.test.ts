import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expertiseGraphPillar } from "../../src/lib/agent/pillars/expertiseGraph.js";
import type { PillarTool, ToolContext } from "../../src/lib/agent/types.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";

type Rows = Record<string, unknown>[];
class FakeQuery {
	private filters: ((r: Record<string, unknown>) => boolean)[] = [];
	private single = false;
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
	maybeSingle() {
		this.single = true;
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
	// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
	then(resolve: (v: { data: unknown }) => void) {
		const rows = this.data.filter((r) => this.filters.every((f) => f(r)));
		resolve({ data: this.single ? (rows[0] ?? null) : rows });
	}
}
const fakeDb = (tables: Record<string, Rows>): SupabaseClient =>
	({
		from: (t: string) => new FakeQuery(tables[t] ?? []),
	}) as unknown as SupabaseClient;

const activeMembers = (...ids: string[]): Rows =>
	ids.map((user_id) => ({
		user_id,
		given_name: user_id,
		surname: null,
		member_status: "active",
	}));

const ctx = {} as unknown as ToolContext; // handlers read data via getSupabase()
const tool = (name: string): PillarTool => {
	const t = expertiseGraphPillar.tools.find((x) => x.name === name);
	if (!t) throw new Error(`no tool ${name}`);
	return t;
};

test("expertiseGraphPillar: shape — id + 3 named tools", () => {
	assert.equal(expertiseGraphPillar.id, "expertise-graph");
	assert.deepEqual(expertiseGraphPillar.tools.map((t) => t.name).sort(), [
		"compare_members",
		"expertise_landscape",
		"find_collaborators",
	]);
});

test("expertise_landscape (skills): distinct member counts, no people", async () => {
	setSupabaseClient(
		fakeDb({
			members: activeMembers("u1", "u2"),
			beacon_skill: [
				{ id: "s1", name: "Python", category: "language" },
				{ id: "s2", name: "Swift", category: "language" },
			],
			beacon_person_skill: [
				{ user_id: "u1", skill_id: "s1", status: "confirmed" },
				{ user_id: "u2", skill_id: "s1", status: "pending" },
				{ user_id: "u1", skill_id: "s2", status: "confirmed" },
			],
		}),
	);
	const res = await tool("expertise_landscape").run(
		{ dimension: "skills" },
		ctx,
	);
	assert.match(res.content, /Python: 2 members/);
	assert.match(res.content, /Swift: 1 member/);
	assert.equal(res.people, undefined);
});

test("expertise_landscape (companies): explodes org tags into counts", async () => {
	setSupabaseClient(
		fakeDb({
			members: activeMembers("u1", "u2"),
			beacon_organization: [
				{ id: "o1", tags: ["bigtech", "faang"] },
				{ id: "o2", tags: ["consulting"] },
			],
			beacon_employment: [
				{ user_id: "u1", organization_id: "o1", status: "confirmed" },
				{ user_id: "u2", organization_id: "o1", status: "confirmed" },
				{ user_id: "u1", organization_id: "o2", status: "pending" },
			],
		}),
	);
	const res = await tool("expertise_landscape").run(
		{ dimension: "companies" },
		ctx,
	);
	assert.match(res.content, /bigtech: 2 members/);
	assert.match(res.content, /faang: 2 members/);
	assert.match(res.content, /consulting: 1 member/);
});

test("expertise_landscape (capabilities): counts via vocabulary labels", async () => {
	setSupabaseClient(
		fakeDb({
			members: activeMembers("u1", "u2"),
			beacon_tag_vocabulary: [
				{ tag: "ml_ai", label: "ML / AI", category: "domain" },
				{ tag: "ios", label: "iOS", category: "domain" },
			],
			beacon_person_tag: [
				{ user_id: "u1", tag: "ml_ai", status: "confirmed" },
				{ user_id: "u2", tag: "ml_ai", status: "pending" },
				{ user_id: "u1", tag: "ios", status: "confirmed" },
			],
		}),
	);
	const res = await tool("expertise_landscape").run(
		{ dimension: "capabilities" },
		ctx,
	);
	assert.match(res.content, /ML \/ AI: 2 members/);
	assert.match(res.content, /iOS: 1 member/);
});

test("expertise_landscape (schools): explodes school groups", async () => {
	setSupabaseClient(
		fakeDb({
			members: activeMembers("u1", "u2"),
			beacon_school: [
				{ id: "sc1", groups: ["tu9"] },
				{ id: "sc2", groups: ["ivy_league"] },
			],
			beacon_education: [
				{ user_id: "u1", school_id: "sc1", status: "confirmed" },
				{ user_id: "u2", school_id: "sc1", status: "confirmed" },
				{ user_id: "u1", school_id: "sc2", status: "confirmed" },
			],
		}),
	);
	const res = await tool("expertise_landscape").run(
		{ dimension: "schools" },
		ctx,
	);
	assert.match(res.content, /tu9: 2 members/);
	assert.match(res.content, /ivy_league: 1 member/);
});

test("expertise_landscape (overview): no dimension → all four sections", async () => {
	setSupabaseClient(
		fakeDb({
			members: activeMembers("u1"),
			beacon_skill: [{ id: "s1", name: "Python", category: "language" }],
			beacon_person_skill: [
				{ user_id: "u1", skill_id: "s1", status: "confirmed" },
			],
		}),
	);
	const res = await tool("expertise_landscape").run({}, ctx);
	assert.match(res.content, /Top skills:/);
	assert.match(res.content, /Top capabilities:/);
	assert.match(res.content, /Companies worked at/);
	assert.match(res.content, /School groups:/);
	assert.match(res.content, /Python: 1 member/);
});

test("find_collaborators: no shared projects/employers → friendly empty", async () => {
	setSupabaseClient(fakeDb({ members: activeMembers("u1") }));
	const res = await tool("find_collaborators").run({ user_id: "u1" }, ctx);
	assert.equal(res.people, undefined);
	assert.match(res.content, /No one shares/);
});

test("find_collaborators: harvests sharers; excludes self + opted-out", async () => {
	setSupabaseClient(
		fakeDb({
			beacon_person_project: [
				{ user_id: "u1", project_id: "p1", status: "confirmed" },
				{ user_id: "u2", project_id: "p1", status: "confirmed" },
				{ user_id: "u3", project_id: "p1", status: "confirmed" },
			],
			beacon_project: [{ id: "p1", name: "Study Set Creator" }],
			beacon_person: [{ user_id: "u3", opted_out: true }],
			members: [
				{
					user_id: "u1",
					given_name: "Ada",
					surname: "Lovelace",
					member_status: "active",
				},
				{
					user_id: "u2",
					given_name: "Alan",
					surname: "Turing",
					member_status: "active",
				},
				{
					user_id: "u3",
					given_name: "Grace",
					surname: "Hopper",
					member_status: "active",
				},
			],
		}),
	);
	const res = await tool("find_collaborators").run({ user_id: "u1" }, ctx);
	assert.deepEqual(
		res.people?.map((p) => p.user_id),
		["u2"],
	);
	assert.match(res.content, /Study Set Creator/);
	assert.equal(res.people?.[0].score, 1);
});

test("compare_members: harvests available members, skips opted-out", async () => {
	setSupabaseClient(
		fakeDb({
			beacon_person: [{ user_id: "u3", opted_out: true }],
			members: [
				{
					user_id: "u1",
					given_name: "Ada",
					surname: "Lovelace",
					member_status: "active",
				},
				{
					user_id: "u2",
					given_name: "Alan",
					surname: "Turing",
					member_status: "active",
				},
				{
					user_id: "u3",
					given_name: "Grace",
					surname: "Hopper",
					member_status: "active",
				},
			],
		}),
	);
	const res = await tool("compare_members").run(
		{ user_ids: ["u1", "u2", "u3"] },
		ctx,
	);
	assert.deepEqual(res.people?.map((p) => p.user_id).sort(), ["u1", "u2"]);
	assert.match(res.content, /Ada Lovelace/);
	assert.match(res.content, /Alan Turing/);
	assert.doesNotMatch(res.content, /Grace Hopper/);
});
