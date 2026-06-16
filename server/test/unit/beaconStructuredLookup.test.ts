import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	peopleByProject,
	peopleBySkill,
} from "../../src/lib/structuredLookup.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";

// Minimal chainable PostgREST stand-in: returns canned rows per table and
// honors `.in("status", [...])` so status filtering is exercised. Each `from()`
// yields a fresh thenable so chained awaits resolve to `{ data }`.
type Rows = Record<string, unknown>[];
class FakeQuery {
	private statusFilter: string[] | null = null;
	constructor(private data: Rows) {}
	select() {
		return this;
	}
	eq() {
		return this;
	}
	ilike() {
		return this;
	}
	limit() {
		return this;
	}
	overlaps() {
		return this;
	}
	order() {
		return this;
	}
	in(col: string, vals: string[]) {
		if (col === "status") this.statusFilter = vals;
		return this;
	}
	// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
	then(resolve: (v: { data: Rows }) => void) {
		const data = this.statusFilter
			? this.data.filter(
					(r) =>
						!("status" in r) ||
						(this.statusFilter as string[]).includes(r.status as string),
				)
			: this.data;
		resolve({ data });
	}
}

function fakeDb(tables: Record<string, Rows>): SupabaseClient {
	return {
		from: (t: string) => new FakeQuery(tables[t] ?? []),
	} as unknown as SupabaseClient;
}

test("peopleByProject: shapes role detail + carries pending status", async () => {
	setSupabaseClient(
		fakeDb({
			beacon_project: [{ id: "p1", name: "Study Set Creator" }],
			beacon_person_project: [
				{
					user_id: "u1",
					role: "builder",
					status: "confirmed",
					project_id: "p1",
				},
				{ user_id: "u2", role: null, status: "pending", project_id: "p1" },
			],
			members: [
				{ user_id: "u1", given_name: "Justin", surname: "Lanfermann" },
				{ user_id: "u2", given_name: "Ana", surname: null },
			],
		}),
	);

	const hits = await peopleByProject("Study Set Creator");
	assert.equal(hits.length, 2);
	const justin = hits.find((h) => h.user_id === "u1");
	assert.equal(justin?.name, "Justin Lanfermann");
	assert.equal(justin?.detail, "Study Set Creator — builder");
	assert.equal(justin?.status, "confirmed");
	const ana = hits.find((h) => h.user_id === "u2");
	assert.equal(ana?.name, "Ana");
	assert.equal(ana?.detail, "Study Set Creator"); // no role
	assert.equal(ana?.status, "pending");
});

test("peopleByProject: confirmed-only filter drops pending rows", async () => {
	setSupabaseClient(
		fakeDb({
			beacon_project: [{ id: "p1", name: "Study Set Creator" }],
			beacon_person_project: [
				{
					user_id: "u1",
					role: "builder",
					status: "confirmed",
					project_id: "p1",
				},
				{ user_id: "u2", role: null, status: "pending", project_id: "p1" },
			],
			members: [
				{ user_id: "u1", given_name: "Justin", surname: "Lanfermann" },
				{ user_id: "u2", given_name: "Ana", surname: null },
			],
		}),
	);
	const hits = await peopleByProject("Study Set Creator", ["confirmed"]);
	assert.equal(hits.length, 1);
	assert.equal(hits[0].user_id, "u1");
});

test("peopleBySkill: empty entity match → no hits", async () => {
	setSupabaseClient(
		fakeDb({ beacon_skill: [], beacon_person_skill: [], members: [] }),
	);
	assert.deepEqual(await peopleBySkill("nonexistent"), []);
});

test("peopleBySkill: shapes proficiency detail", async () => {
	setSupabaseClient(
		fakeDb({
			beacon_skill: [{ id: "s1", name: "Python" }],
			beacon_person_skill: [
				{
					user_id: "u1",
					proficiency: "expert",
					status: "confirmed",
					skill_id: "s1",
				},
			],
			members: [{ user_id: "u1", given_name: "Justin", surname: "L" }],
		}),
	);
	const hits = await peopleBySkill("python");
	assert.equal(hits.length, 1);
	assert.equal(hits[0].detail, "Python (expert)");
});
