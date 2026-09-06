import "../setup.js";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ADMIN_ID = "00000000-0000-4000-8000-000000000002";
const CHAT_ID = "00000000-0000-4000-8000-000000000003";
const TURN_ID = "00000000-0000-4000-8000-000000000004";

const user = (id: string): User => ({
	id,
	email: `${id}@example.test`,
	app_metadata: {},
	user_metadata: {},
	aud: "authenticated",
	created_at: "2026-01-01T00:00:00Z",
});

type Row = Record<string, unknown>;
let insertedAgentTrace: unknown = null;
const insertedAuditLogs: Row[] = [];
let reindexDeletes = 0;
let failSearchRpc = false;
const originalOpenAiKey = process.env.OPENAI_API_KEY;

class Query {
	private filters: ((row: Row) => boolean)[] = [];
	private result: Row[];
	private one = false;

	public constructor(
		private readonly table: string,
		result: Row[],
	) {
		this.result = result;
	}

	public select(): this {
		return this;
	}

	public order(): this {
		return this;
	}

	public limit(limit: number): this {
		this.result = this.result.slice(0, limit);
		return this;
	}

	public eq(column: string, value: unknown): this {
		this.filters.push((row) => row[column] === value);
		return this;
	}

	public in(column: string, values: unknown[]): this {
		this.filters.push((row) => values.includes(row[column]));
		return this;
	}

	public or(): this {
		return this;
	}

	public ilike(): this {
		return this;
	}

	public overlaps(): this {
		return this;
	}

	public insert(payload?: unknown): this {
		if (this.table === "beacon_agent_log") {
			insertedAgentTrace = (payload as Row | undefined)?.trace ?? null;
		}
		if (
			(this.table === "beacon_agent_log" ||
				this.table === "beacon_search_log") &&
			payload
		) {
			insertedAuditLogs.push(payload as Row);
		}
		return this;
	}

	public upsert(): this {
		return this;
	}

	public update(): this {
		return this;
	}

	public delete(): this {
		if (this.table === "beacon_search_chunk") reindexDeletes += 1;
		return this;
	}

	public maybeSingle(): this {
		this.one = true;
		return this;
	}

	public single(): this {
		this.one = true;
		return this;
	}

	// biome-ignore lint/suspicious/noThenProperty: intentional Supabase test double
	public then(
		resolve: (value: { data: Row[]; error: null; count: number }) => void,
	) {
		const data = this.result.filter((row) =>
			this.filters.every((filter) => filter(row)),
		);
		resolve({
			data: this.one ? (data[0] ?? null) : data,
			error: null,
			count: data.length,
		} as unknown as { data: Row[]; error: null; count: number });
	}
}

function fakeSupabase(): SupabaseClient {
	const tables: Record<string, Row[]> = {
		members: [
			{
				user_id: USER_ID,
				given_name: "Ada",
				surname: "Active",
				member_status: "active",
			},
			{
				user_id: ADMIN_ID,
				given_name: "Ada",
				surname: "Hidden",
				member_status: "active",
			},
		],
		beacon_person: [{ user_id: ADMIN_ID, opted_out: true }],
		beacon_employment: [
			{
				id: "00000000-0000-4000-8000-000000000006",
				user_id: USER_ID,
				organization_id: null,
				title: "Engineer",
				status: "confirmed",
			},
		],
		user_roles: [{ user_id: ADMIN_ID, role: "admin" }],
		beacon_agent_log: [
			{
				id: "00000000-0000-4000-8000-000000000005",
				chat_id: CHAT_ID,
				turn_id: TURN_ID,
				user_id: USER_ID,
				query: "find someone",
				model: "test",
				trace: { rounds: [] },
				step_count: 0,
				people_count: 0,
				duration_ms: 1,
				created_at: "2026-01-01T00:00:00Z",
			},
		],
	};
	return {
		from: (table: string) => new Query(table, tables[table] ?? []),
		rpc: async () =>
			failSearchRpc
				? { data: null, error: { message: "upstream provider secret" } }
				: { data: [], error: null },
		auth: {
			getUser: async (token: string) => ({
				data: {
					user: token === "admin-token" ? user(ADMIN_ID) : user(USER_ID),
				},
				error: null,
			}),
		},
	} as unknown as SupabaseClient;
}

describe("Beacon route contract", () => {
	let app: FastifyInstance;

	before(async () => {
		process.env.OPENAI_API_KEY = "";
		setSupabaseClient(fakeSupabase());
		app = await buildApp();
	});

	after(async () => {
		await app.close();
		if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
		else process.env.OPENAI_API_KEY = originalOpenAiKey;
	});

	test("assistant JSON returns the shared response shape", async () => {
		insertedAgentTrace = null;
		const response = await app.inject({
			method: "POST",
			url: "/api/expertise/assistant",
			headers: { authorization: "Bearer user-token" },
			payload: { text: "find someone", messages: [], mentions: [] },
		});

		assert.equal(response.statusCode, 200);
		const body = JSON.parse(response.payload) as Record<string, unknown>;
		assert.equal(typeof body.answer, "string");
		assert.ok(Array.isArray(body.people));
		assert.ok(Array.isArray(body.steps));
		assert.ok(insertedAgentTrace);
		assert.doesNotMatch(JSON.stringify(insertedAgentTrace), /"result"/);
	});

	test("assistant and legacy search redact sensitive audit queries", async () => {
		insertedAuditLogs.length = 0;
		const sensitiveQuery =
			"Find 123 Main Street / Hauptstr. 1, IBAN DE89370400440532013000, phone +49123456789, DOB 1990-01-02";

		for (const url of ["/api/expertise/assistant", "/api/expertise/search"]) {
			const response = await app.inject({
				method: "POST",
				url,
				headers: { authorization: "Bearer user-token" },
				payload: url.endsWith("assistant")
					? { text: sensitiveQuery, messages: [], mentions: [] }
					: { text: sensitiveQuery, mentions: [] },
			});
			assert.equal(response.statusCode, 200);
		}

		const persisted = JSON.stringify(insertedAuditLogs);
		assert.doesNotMatch(persisted, /DE89370400440532013000/);
		assert.doesNotMatch(persisted, /\+49123456789/);
		assert.doesNotMatch(persisted, /1990-01-02/);
		assert.doesNotMatch(persisted, /123 Main Street/);
		assert.doesNotMatch(persisted, /Hauptstr\. 1/);
	});

	test("expertise mutations await search-index rebuilds", async () => {
		reindexDeletes = 0;
		const headers = { authorization: "Bearer user-token" };
		const profile = await app.inject({
			method: "PUT",
			url: `/api/expertise/${USER_ID}`,
			headers,
			payload: { headline: "Visible profile" },
		});
		assert.equal(profile.statusCode, 200);
		assert.equal(reindexDeletes, 1);

		const optedIn = await app.inject({
			method: "POST",
			url: `/api/expertise/${USER_ID}/opt-out`,
			headers,
			payload: { opted_out: false },
		});
		assert.equal(optedIn.statusCode, 200);
		assert.equal(reindexDeletes, 2);

		const added = await app.inject({
			method: "POST",
			url: `/api/expertise/${USER_ID}/claims/employment`,
			headers,
			payload: { title: "Engineer" },
		});
		assert.equal(added.statusCode, 201);
		assert.equal(reindexDeletes, 3);

		const updated = await app.inject({
			method: "PATCH",
			url: `/api/expertise/${USER_ID}/claims/employment/00000000-0000-4000-8000-000000000006`,
			headers,
			payload: { title: "Senior Engineer" },
		});
		assert.equal(updated.statusCode, 200);
		assert.equal(reindexDeletes, 4);

		const deleted = await app.inject({
			method: "DELETE",
			url: `/api/expertise/${USER_ID}/claims/employment/00000000-0000-4000-8000-000000000006`,
			headers,
		});
		assert.equal(deleted.statusCode, 204);
		assert.equal(reindexDeletes, 5);
	});

	test("assistant SSE always emits a terminal done event", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/api/expertise/assistant",
			headers: {
				authorization: "Bearer user-token",
				accept: "text/event-stream",
			},
			payload: { text: "find someone", messages: [], mentions: [] },
		});

		assert.equal(response.statusCode, 200);
		assert.match(response.payload, /"type":"done"/);
	});

	test("assistant SSE hides failures and still terminates", async () => {
		failSearchRpc = true;
		try {
			const response = await app.inject({
				method: "POST",
				url: "/api/expertise/assistant",
				headers: {
					authorization: "Bearer user-token",
					accept: "text/event-stream",
				},
				payload: { text: "find someone", messages: [], mentions: [] },
			});

			assert.equal(response.statusCode, 200);
			assert.match(response.payload, /Something went wrong on my end/);
			assert.doesNotMatch(response.payload, /upstream provider secret/);
			assert.match(response.payload, /"type":"done"/);
		} finally {
			failSearchRpc = false;
		}
	});

	test("assistant rejects malformed bodies before running the agent", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/api/expertise/assistant",
			headers: { authorization: "Bearer user-token" },
			payload: { text: "" },
		});

		assert.equal(response.statusCode, 400);
		assert.deepEqual(Object.keys(JSON.parse(response.payload)), [
			"error",
			"details",
		]);
	});

	test("expertise validates UUID params and ownership", async () => {
		const invalid = await app.inject({
			method: "GET",
			url: "/api/expertise/not-a-uuid",
			headers: { authorization: "Bearer user-token" },
		});
		assert.equal(invalid.statusCode, 400);

		const forbidden = await app.inject({
			method: "PUT",
			url: `/api/expertise/${ADMIN_ID}`,
			headers: { authorization: "Bearer user-token" },
			payload: { headline: "No" },
		});
		assert.equal(forbidden.statusCode, 403, forbidden.payload);
	});

	test("people typeahead validates query and requires authentication", async () => {
		const unauthenticated = await app.inject({
			method: "GET",
			url: "/api/expertise/people?q=x",
		});
		assert.equal(unauthenticated.statusCode, 401);

		const invalid = await app.inject({
			method: "GET",
			url: "/api/expertise/people?q=%5B",
			headers: { authorization: "Bearer user-token" },
		});
		assert.equal(invalid.statusCode, 200);

		const tooLong = await app.inject({
			method: "GET",
			url: `/api/expertise/people?q=${"a".repeat(101)}`,
			headers: { authorization: "Bearer user-token" },
		});
		assert.equal(tooLong.statusCode, 400);

		const visible = await app.inject({
			method: "GET",
			url: "/api/expertise/people?q=Ada",
			headers: { authorization: "Bearer user-token" },
		});
		assert.equal(visible.statusCode, 200);
		assert.deepEqual(
			JSON.parse(visible.payload).people.map(
				(person: { user_id: string }) => person.user_id,
			),
			[USER_ID],
		);
	});

	test("admin agent log validates filters and is admin-only", async () => {
		const invalid = await app.inject({
			method: "GET",
			url: "/api/admin/beacon/agent-log",
			headers: { authorization: "Bearer admin-token" },
		});
		assert.equal(invalid.statusCode, 400);

		const forbidden = await app.inject({
			method: "GET",
			url: `/api/admin/beacon/agent-log?chat_id=${CHAT_ID}`,
			headers: { authorization: "Bearer user-token" },
		});
		assert.equal(forbidden.statusCode, 403);

		const response = await app.inject({
			method: "GET",
			url: `/api/admin/beacon/agent-log?chat_id=${CHAT_ID}`,
			headers: { authorization: "Bearer admin-token" },
		});
		assert.equal(response.statusCode, 200, response.payload);
		assert.equal(JSON.parse(response.payload).turns.length, 1);
	});
});
