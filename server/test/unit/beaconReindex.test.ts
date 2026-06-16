import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rebuildSearchChunks } from "../../src/lib/beacon.js";
import { buildChunksForProfile } from "../../src/lib/searchChunks.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";

// Force the no-key path so embeddings are deterministic NULLs (no network).
delete process.env.OPENAI_API_KEY;

type Rows = Record<string, unknown>[];

class FakeQuery {
	constructor(
		private data: Rows,
		private onInsert?: (rows: Rows) => void,
		private onDelete?: () => void,
	) {}
	select() {
		return this;
	}
	eq() {
		return this;
	}
	in() {
		return this;
	}
	order() {
		return this;
	}
	delete() {
		this.onDelete?.();
		return this;
	}
	insert(rows: Rows) {
		this.onInsert?.(rows);
		return this;
	}
	maybeSingle() {
		return {
			// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
			then: (res: (v: { data: unknown; error: null }) => void) =>
				res({ data: this.data[0] ?? null, error: null }),
		};
	}
	// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
	then(res: (v: { data: Rows; error: null; count: number }) => void) {
		res({ data: this.data, error: null, count: this.data.length });
	}
}

interface ProfileFixture {
	person: Record<string, unknown> | null;
	member: Record<string, unknown> | null;
	employment?: Rows;
	education?: Rows;
	skills?: Rows;
	projects?: Rows;
	tags?: Rows;
}

function fakeProfileDb(
	p: ProfileFixture,
	capture: { inserted: Rows | null; deleted: boolean },
): SupabaseClient {
	const tableData: Record<string, Rows> = {
		beacon_person: p.person ? [p.person] : [],
		members: p.member ? [p.member] : [],
		beacon_employment: p.employment ?? [],
		beacon_education: p.education ?? [],
		beacon_person_skill: p.skills ?? [],
		beacon_person_project: p.projects ?? [],
		beacon_person_tag: p.tags ?? [],
	};
	return {
		from: (t: string) => {
			if (t === "beacon_search_chunk")
				return new FakeQuery(
					[],
					(rows) => {
						capture.inserted = rows;
					},
					() => {
						capture.deleted = true;
					},
				);
			return new FakeQuery(tableData[t] ?? []);
		},
	} as unknown as SupabaseClient;
}

test("rebuildSearchChunks: builds chunks (NULL embeddings, no key) + delete-then-insert", async () => {
	const profile: ProfileFixture = {
		person: { opted_out: false, headline: "iOS engineer", summary: null },
		member: { user_id: "u1", given_name: "Justin", surname: "L" },
		employment: [
			{
				title: "Engineer",
				is_current: true,
				start_year: 2020,
				end_year: null,
				raw_value: "Google",
				organization: { name: "Google", tags: ["bigtech"] },
				status: "confirmed",
			},
		],
	};
	const capture = { inserted: null as Rows | null, deleted: false };
	setSupabaseClient(fakeProfileDb(profile, capture));

	const res = await rebuildSearchChunks("u1");
	// getExpertiseProfile always returns all claim arrays (defaulting to []), so
	// build `expected` from the same complete shape.
	const expected = buildChunksForProfile({
		person: profile.person,
		employment: profile.employment ?? [],
		education: [],
		skills: [],
		projects: [],
		tags: [],
	} as never);
	assert.equal(res.chunks, expected.length);
	assert.ok(res.chunks > 0);
	assert.equal(res.embedded, 0); // no key → all NULL
	assert.equal(capture.deleted, true);
	assert.equal(capture.inserted?.length, expected.length);
	for (const row of capture.inserted ?? []) assert.equal(row.embedding, null);
});

test("rebuildSearchChunks: opted-out → purge only, no insert", async () => {
	const capture = { inserted: null as Rows | null, deleted: false };
	setSupabaseClient(
		fakeProfileDb(
			{
				person: { opted_out: true, headline: "secret", summary: null },
				member: { user_id: "u1", given_name: "Justin", surname: "L" },
			},
			capture,
		),
	);
	const res = await rebuildSearchChunks("u1");
	assert.equal(res.cleared, true);
	assert.equal(res.chunks, 0);
	assert.equal(capture.deleted, true);
	assert.equal(capture.inserted, null);
});

test("rebuildSearchChunks: no claims/headline → cleared, no insert", async () => {
	const capture = { inserted: null as Rows | null, deleted: false };
	setSupabaseClient(
		fakeProfileDb(
			{
				person: { opted_out: false, headline: null, summary: null },
				member: { user_id: "u1", given_name: "Justin", surname: "L" },
			},
			capture,
		),
	);
	const res = await rebuildSearchChunks("u1");
	assert.equal(res.cleared, true);
	assert.equal(res.chunks, 0);
	assert.equal(capture.inserted, null);
});
