import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseError } from "../../src/lib/errors.js";
import { expertiseLandscape } from "../../src/lib/expertiseGraphLookup.js";
import { peopleByDepartment } from "../../src/lib/orgLookup.js";
import { compileCandidates, SearchDslSchema } from "../../src/lib/searchDsl.js";
import { peopleByProject } from "../../src/lib/structuredLookup.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";

type Rows = Record<string, unknown>[];

class FakeQuery {
	private filters: ((row: Record<string, unknown>) => boolean)[] = [];
	private single = false;

	constructor(private readonly rows: Rows) {}

	select() {
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

	not(column: string, operator: string, value: unknown) {
		if (operator === "is" && value === null) {
			this.filters.push(
				(row) => row[column] !== null && row[column] !== undefined,
			);
		}
		return this;
	}

	overlaps(column: string, values: unknown[]) {
		this.filters.push((row) => {
			const stored = row[column];
			return (
				Array.isArray(stored) && stored.some((item) => values.includes(item))
			);
		});
		return this;
	}

	ilike(column: string, pattern: string) {
		const term = pattern.replaceAll("%", "").toLowerCase();
		this.filters.push((row) =>
			String(row[column] ?? "")
				.toLowerCase()
				.includes(term),
		);
		return this;
	}

	limit() {
		return this;
	}

	order() {
		return this;
	}

	maybeSingle() {
		this.single = true;
		return this;
	}

	// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
	then(resolve: (value: { data: unknown; error: null }) => void) {
		const rows = this.rows.filter((row) =>
			this.filters.every((filter) => filter(row)),
		);
		resolve({ data: this.single ? (rows[0] ?? null) : rows, error: null });
	}
}

function fakeDb(tables: Record<string, Rows>): SupabaseClient {
	return {
		from: (table: string) => new FakeQuery(tables[table] ?? []),
	} as unknown as SupabaseClient;
}

const members: Rows = [
	{
		user_id: "active",
		given_name: "Ada",
		surname: "Active",
		department: "Software Development",
		member_status: "active",
	},
	{
		user_id: "pending",
		given_name: "Pat",
		surname: "Pending",
		department: "Software Development",
		member_status: "active",
	},
	{
		user_id: "inactive",
		given_name: "Ina",
		surname: "Inactive",
		department: "Software Development",
		member_status: "inactive",
	},
	{
		user_id: "alumni",
		given_name: "Al",
		surname: "Alumni",
		department: "Software Development",
		member_status: "alumni",
	},
	{
		user_id: "opted",
		given_name: "Olivia",
		surname: "Opted",
		department: "Software Development",
		member_status: "active",
	},
];

const beaconPeople: Rows = [{ user_id: "opted", opted_out: true }];

test("search candidates always exclude inactive and opted-out members", async () => {
	setSupabaseClient(fakeDb({ members, beacon_person: beaconPeople }));
	const candidates = await compileCandidates(SearchDslSchema.parse({}));
	assert.deepEqual(candidates.sort(), ["active", "pending"]);
});

test("visibility query failures become typed errors without upstream details", async () => {
	const broken = {
		from: () => ({
			select() {
				return this;
			},
			eq() {
				return this;
			},
			// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
			then(
				resolve: (value: { data: null; error: { message: string } }) => void,
			) {
				resolve({ data: null, error: { message: "private upstream detail" } });
			},
		}),
	} as unknown as SupabaseClient;
	setSupabaseClient(broken);
	await assert.rejects(
		() => compileCandidates(SearchDslSchema.parse({})),
		(error: unknown) =>
			error instanceof DatabaseError &&
			!error.message.includes("private upstream detail"),
	);
});

test("structured lookup keeps pending claims explicit but hides blocked members", async () => {
	setSupabaseClient(
		fakeDb({
			members,
			beacon_person: beaconPeople,
			beacon_project: [
				{ id: "project", name: "Beacon", canonical_key: "beacon" },
			],
			beacon_person_project: [
				{
					user_id: "active",
					project_id: "project",
					role: "builder",
					status: "confirmed",
				},
				{
					user_id: "pending",
					project_id: "project",
					role: "reviewer",
					status: "pending",
				},
				...(["inactive", "alumni", "opted"] as const).map((user_id) => ({
					user_id,
					project_id: "project",
					role: "hidden",
					status: "confirmed",
				})),
			],
		}),
	);
	const hits = await peopleByProject("Beacon");
	assert.deepEqual(
		hits.map((hit) => hit.user_id),
		["active", "pending"],
	);
	assert.equal(hits[1]?.status, "pending");
});

test("org lookup cannot widen visibility with includeAlumni", async () => {
	setSupabaseClient(fakeDb({ members, beacon_person: beaconPeople }));
	const hits = await peopleByDepartment("softdev", { includeAlumni: true });
	assert.deepEqual(hits.map((hit) => hit.user_id).sort(), [
		"active",
		"pending",
	]);
});

test("expertise analytics excludes hidden members and counts pending as unverified", async () => {
	setSupabaseClient(
		fakeDb({
			members,
			beacon_person: beaconPeople,
			beacon_skill: [{ id: "skill", name: "TypeScript", category: "language" }],
			beacon_person_skill: members.map((member) => ({
				user_id: member.user_id,
				skill_id: "skill",
				status: member.user_id === "pending" ? "pending" : "confirmed",
			})),
		}),
	);
	const entries = await expertiseLandscape({ dimension: "skills" });
	assert.deepEqual(entries, [
		{
			key: "skill",
			label: "TypeScript",
			category: "language",
			count: 2,
			unverified_count: 1,
		},
	]);
});
