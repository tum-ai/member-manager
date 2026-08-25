import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.FIELD_ENCRYPTION_KEY ??= "s".repeat(32);

const { hydrateDocxSubmissions } = await import(
	"../../src/lib/contracts/contractDocxPipeline.js"
);
const { getSupabase, setSupabaseClient } = await import(
	"../../src/lib/supabase.js"
);

const originalClient = getSupabase();

/** Records every `.in()` lookup so the batch can be shown to issue just one. */
function versionClient(
	statuses: Record<string, string>,
	calls: string[][],
): SupabaseClient {
	return {
		from: () => ({
			select: () => ({
				in: async (_column: string, ids: string[]) => {
					calls.push(ids);
					return {
						data: ids
							.filter((id) => id in statuses)
							.map((id) => ({ id, artifact_status: statuses[id] })),
						error: null,
					};
				},
			}),
		}),
	} as unknown as SupabaseClient;
}

describe("batch DOCX submission hydration", () => {
	afterEach(() => setSupabaseClient(originalClient));

	it("resolves every document status with a single query", async () => {
		const calls: string[][] = [];
		setSupabaseClient(
			versionClient({ "version-a": "ready", "version-b": "failed" }, calls),
		);
		const rows = await hydrateDocxSubmissions([
			{
				id: "1",
				renderer_engine: "docx",
				active_document_version_id: "version-a",
			},
			{
				id: "2",
				renderer_engine: "docx",
				active_document_version_id: "version-b",
			},
			{
				id: "3",
				renderer_engine: "docx",
				active_document_version_id: "version-a",
			},
		]);
		assert.equal(calls.length, 1);
		assert.deepEqual(calls[0]?.sort(), ["version-a", "version-b"]);
		assert.deepEqual(
			rows.map((row) => row.document_status),
			["ready", "failed", "ready"],
		);
	});

	it("does not query at all when no row has a document version", async () => {
		const calls: string[][] = [];
		setSupabaseClient(versionClient({}, calls));
		const rows = await hydrateDocxSubmissions([
			{ id: "1", renderer_engine: "docx", active_document_version_id: null },
		]);
		assert.equal(calls.length, 0);
		assert.equal(rows[0]?.document_status, null);
	});

	it("leaves retired non-DOCX rows untouched", async () => {
		const calls: string[][] = [];
		setSupabaseClient(versionClient({}, calls));
		const legacy = {
			id: "1",
			renderer_engine: "legacy_text",
			form_data: { a: 1 },
		};
		const rows = await hydrateDocxSubmissions([legacy]);
		assert.equal(rows[0], legacy);
		assert.equal(calls.length, 0);
	});
});
