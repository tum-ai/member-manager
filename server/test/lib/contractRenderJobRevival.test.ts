import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ValidationError } from "../../src/lib/errors.js";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { reviveStaleContractRenderJob } = await import(
	"../../src/lib/contracts/contractDocxPipeline.js"
);
const { getSupabase, setSupabaseClient } = await import(
	"../../src/lib/supabase.js"
);

const originalClient = getSupabase();

interface Recorded {
	name?: string;
	params?: Record<string, unknown>;
	calls: number;
}

/**
 * Eligibility and both resets live in `requeue_contract_render_job` so they share
 * one locked transaction. What is worth asserting here is the call it makes and how
 * the answer is read; the concurrency guarantee itself is in the SQL, covered by
 * contractDocxPipelineMigration.test.ts and by a live-database interleaving check
 * that cannot run in this database-free suite.
 */
function rpcClient(
	result: { data?: unknown; error?: { message: string } },
	recorded: Recorded,
): SupabaseClient {
	return {
		rpc: async (name: string, params: Record<string, unknown>) => {
			recorded.name = name;
			recorded.params = params;
			recorded.calls += 1;
			return { data: result.data ?? null, error: result.error ?? null };
		},
	} as unknown as SupabaseClient;
}

describe("reviving a stale contract render job", () => {
	afterEach(() => setSupabaseClient(originalClient));

	it("asks the database to requeue a template document", async () => {
		const recorded: Recorded = { calls: 0 };
		setSupabaseClient(rpcClient({ data: "revived" }, recorded));
		assert.equal(
			await reviveStaleContractRenderJob({ templateDocumentId: "doc-1" }),
			"revived",
		);
		assert.equal(recorded.name, "requeue_contract_render_job");
		assert.deepEqual(recorded.params, {
			p_template_document_id: "doc-1",
			p_document_version_id: null,
			p_include_failed: false,
		});
	});

	it("includes failed jobs only when asked, so a submission keeps its payload", async () => {
		const recorded: Recorded = { calls: 0 };
		setSupabaseClient(rpcClient({ data: "revived" }, recorded));
		await reviveStaleContractRenderJob({
			documentVersionId: "version-1",
			includeFailed: true,
		});
		assert.deepEqual(recorded.params, {
			p_template_document_id: null,
			p_document_version_id: "version-1",
			p_include_failed: true,
		});
	});

	it("reports a job that is genuinely in flight", async () => {
		const recorded: Recorded = { calls: 0 };
		setSupabaseClient(rpcClient({ data: "live" }, recorded));
		assert.equal(
			await reviveStaleContractRenderJob({ templateDocumentId: "doc-2" }),
			"live",
		);
	});

	it("reports a missing job so the caller can enqueue a fresh one", async () => {
		const recorded: Recorded = { calls: 0 };
		setSupabaseClient(rpcClient({ data: "missing" }, recorded));
		assert.equal(
			await reviveStaleContractRenderJob({ documentVersionId: "version-2" }),
			"missing",
		);
	});

	it("does not call the database without a target", async () => {
		const recorded: Recorded = { calls: 0 };
		setSupabaseClient(rpcClient({ data: "revived" }, recorded));
		assert.equal(await reviveStaleContractRenderJob({}), "missing");
		assert.equal(recorded.calls, 0);
	});

	it("refuses to read an unknown result as success", async () => {
		const recorded: Recorded = { calls: 0 };
		setSupabaseClient(rpcClient({ data: "something-else" }, recorded));
		await assert.rejects(
			() => reviveStaleContractRenderJob({ templateDocumentId: "doc-3" }),
			ValidationError,
		);
	});

	it("surfaces a database error rather than reporting nothing to do", async () => {
		const recorded: Recorded = { calls: 0 };
		setSupabaseClient(
			rpcClient({ error: { message: "deadlock detected" } }, recorded),
		);
		// Supabase errors are thrown as-is here, matching the rest of the server, so
		// the assertion reads the message rather than expecting an Error subclass.
		await assert.rejects(
			() => reviveStaleContractRenderJob({ templateDocumentId: "doc-4" }),
			(error: unknown) => {
				assert.match(
					String((error as { message?: string }).message),
					/deadlock detected/,
				);
				return true;
			},
		);
	});
});
