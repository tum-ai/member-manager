import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runMemberSearch } from "../../src/lib/agent/fallback.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";

delete process.env.OPENAI_API_KEY;

type Rows = Record<string, unknown>[];

class FakeQuery {
	private filters: ((row: Record<string, unknown>) => boolean)[] = [];

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

	overlaps(column: string, values: unknown[]) {
		this.filters.push((row) => {
			const stored = row[column];
			return (
				Array.isArray(stored) && stored.some((item) => values.includes(item))
			);
		});
		return this;
	}

	limit() {
		return this;
	}

	// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
	then(resolve: (value: { data: Rows; error: null }) => void) {
		resolve({
			data: this.rows.filter((row) =>
				this.filters.every((filter) => filter(row)),
			),
			error: null,
		});
	}
}

function fakeSearchDb(input: {
	tables: Record<string, Rows>;
	hits: Rows;
	capture: { candidateIds?: unknown };
}): SupabaseClient {
	return {
		from: (table: string) => new FakeQuery(input.tables[table] ?? []),
		rpc: async (_name: string, args: Record<string, unknown>) => {
			input.capture.candidateIds = args.candidate_ids;
			return { data: input.hits, error: null };
		},
	} as unknown as SupabaseClient;
}

const members: Rows = [
	{
		user_id: "visible-hit",
		given_name: "Visible",
		surname: "Hit",
		member_status: "active",
	},
	{
		user_id: "visible-miss",
		given_name: "Visible",
		surname: "Miss",
		member_status: "active",
	},
	{
		user_id: "hidden-hit",
		given_name: "Hidden",
		surname: "Hit",
		member_status: "active",
	},
];

test("semantic-only search stays hit-only while enforcing visible RPC candidates", async () => {
	const capture: { candidateIds?: unknown } = {};
	setSupabaseClient(
		fakeSearchDb({
			tables: {
				members,
				beacon_person: [{ user_id: "hidden-hit", opted_out: true }],
			},
			hits: [
				{
					user_id: "visible-hit",
					score: 1,
					best_chunk: "Climbing",
				},
				{ user_id: "hidden-hit", score: 2, best_chunk: "Private" },
			],
			capture,
		}),
	);
	const result = await runMemberSearch({ text: "someone who climbs" });
	assert.deepEqual(capture.candidateIds, ["visible-hit", "visible-miss"]);
	assert.deepEqual(
		result.people.map((person) => person.user_id),
		["visible-hit"],
	);
});

test("structured search still includes visible deterministic matches without RPC hits", async () => {
	const capture: { candidateIds?: unknown } = {};
	setSupabaseClient(
		fakeSearchDb({
			tables: {
				members: members.slice(0, 2),
				beacon_organization: [{ id: "org", tags: ["bigtech"] }],
				beacon_employment: [
					{
						user_id: "visible-hit",
						organization_id: "org",
						status: "confirmed",
					},
					{
						user_id: "visible-miss",
						organization_id: "org",
						status: "pending",
					},
				],
			},
			hits: [
				{
					user_id: "visible-hit",
					score: 1,
					best_chunk: "Big tech",
				},
			],
			capture,
		}),
	);
	const result = await runMemberSearch({ text: "big tech experience" });
	assert.deepEqual(capture.candidateIds, ["visible-hit", "visible-miss"]);
	assert.deepEqual(
		result.people.map((person) => person.user_id),
		["visible-hit", "visible-miss"],
	);
});
