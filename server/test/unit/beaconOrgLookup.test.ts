import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	currentRoleHolders,
	historicalRoleHolders,
	listDepartments,
	normalizeBatch,
	normalizeRole,
	peopleByBatch,
	peopleByDepartment,
	resolveDepartment,
} from "../../src/lib/orgLookup.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";

// Generic chainable PostgREST stand-in: records eq/in/not filters and applies
// them in `then`, so column filtering is genuinely exercised (unlike the
// status-only fake used elsewhere).
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

function fakeDb(tables: Record<string, Rows>): SupabaseClient {
	return {
		from: (t: string) => new FakeQuery(tables[t] ?? []),
	} as unknown as SupabaseClient;
}

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
	{
		user_id: "u3",
		given_name: "Grace",
		surname: "Hopper",
		department: "Research",
		batch: "SS25",
		member_status: "active",
		member_role: "Member",
		board_role: null,
	},
	{
		user_id: "u4",
		given_name: "Edsger",
		surname: "Dijkstra",
		department: null,
		batch: "WS24",
		member_status: "active",
		member_role: "President",
		board_role: "Board Member",
	},
];

test("normalizeRole: maps synonyms to canonical, junk to null", () => {
	assert.equal(normalizeRole("teamlead"), "Team Lead");
	assert.equal(normalizeRole("TL"), "Team Lead");
	assert.equal(normalizeRole("team lead"), "Team Lead");
	assert.equal(normalizeRole("vp"), "Vice-President");
	assert.equal(normalizeRole("Vice President"), "Vice-President");
	assert.equal(normalizeRole("president"), "President");
	assert.equal(normalizeRole("board"), "Board Member");
	assert.equal(normalizeRole("Board Member"), "Board Member");
	assert.equal(normalizeRole("member"), "Member");
	assert.equal(normalizeRole("wizard"), null);
});

test("normalizeBatch: validates WS##/SS## form", () => {
	assert.equal(normalizeBatch("ws24"), "WS24");
	assert.equal(normalizeBatch("WS 24"), "WS24");
	assert.equal(normalizeBatch("ss25"), "SS25");
	assert.equal(normalizeBatch("WS19"), null); // year < 20
	assert.equal(normalizeBatch("garbage"), null);
});

test("resolveDepartment: fuzzy 'softdev' resolves to the canonical name", async () => {
	setSupabaseClient(fakeDb({ members }));
	assert.deepEqual(await resolveDepartment("softdev"), [
		"Software Development",
	]);
	assert.deepEqual(await resolveDepartment("Software Development"), [
		"Software Development",
	]);
	assert.deepEqual(await resolveDepartment("research"), ["Research"]);
	assert.deepEqual(await resolveDepartment("nope"), []);
});

test("listDepartments: visibility stays active-only even with includeAlumni", async () => {
	setSupabaseClient(fakeDb({ members }));
	const active = await listDepartments();
	const map = new Map(active.map((d) => [d.department, d.count]));
	assert.equal(map.get("Software Development"), 1); // u2 is alumni → excluded
	assert.equal(map.get("Research"), 1);
	assert.equal(map.get("Board"), 1); // u4 board_role
	const withAlumni = await listDepartments({ includeAlumni: true });
	const map2 = new Map(withAlumni.map((d) => [d.department, d.count]));
	assert.equal(map2.get("Software Development"), 1);
});

test("peopleByDepartment: includeAlumni cannot expose former members", async () => {
	setSupabaseClient(fakeDb({ members }));
	const active = await peopleByDepartment("softdev");
	assert.deepEqual(
		active.map((h) => h.user_id),
		["u1"],
	);
	assert.equal(active[0].detail, "Software Development");
	const all = await peopleByDepartment("softdev", { includeAlumni: true });
	assert.deepEqual(
		all.map((h) => h.user_id),
		["u1"],
	);
});

test("peopleByBatch: normalizes batch and filters status", async () => {
	setSupabaseClient(fakeDb({ members }));
	const hits = await peopleByBatch("ws24");
	assert.deepEqual(hits.map((h) => h.user_id).sort(), ["u1", "u4"]);
	assert.equal(await (await peopleByBatch("nope")).length, 0);
});

test("currentRoleHolders: member_role path + department narrowing", async () => {
	setSupabaseClient(fakeDb({ members }));
	const leads = await currentRoleHolders("Team Lead");
	assert.deepEqual(
		leads.map((h) => h.user_id),
		["u1"],
	); // u2 alumni excluded
	assert.equal(leads[0].detail, "Team Lead, Software Development");
	const narrowed = await currentRoleHolders("Team Lead", {
		department: "softdev",
	});
	assert.deepEqual(
		narrowed.map((h) => h.user_id),
		["u1"],
	);
});

test("currentRoleHolders: board uses board_role", async () => {
	setSupabaseClient(fakeDb({ members }));
	const board = await currentRoleHolders("Board Member");
	assert.deepEqual(
		board.map((h) => h.user_id),
		["u4"],
	);
});

test("historicalRoleHolders: returns period overlap regardless of current dept", async () => {
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
				{
					user_id: "u2",
					role: "Team Lead",
					semester: null,
					started_at: "2021-09-01",
					ended_at: "2022-02-28",
				},
				{
					user_id: "u3",
					role: "Team Lead",
					semester: "SS25",
					started_at: null,
					ended_at: null,
				},
			],
			members,
		}),
	);
	const hits = await historicalRoleHolders("Team Lead", 2023);
	assert.deepEqual(
		hits.map((h) => h.user_id),
		["u1"],
	);
	// u1's CURRENT department is Software Development — surfaced for narrowing,
	// proving we don't drop people whose department changed.
	assert.match(hits[0].detail, /WS23\/24/);
	assert.match(hits[0].detail, /currently Software Development/);
});

test("historicalRoleHolders: board roles aren't tracked → empty", async () => {
	setSupabaseClient(fakeDb({ member_role_history: [], members }));
	assert.deepEqual(await historicalRoleHolders("Board Member", 2023), []);
});
