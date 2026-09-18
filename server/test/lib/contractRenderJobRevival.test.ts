import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { reviveStaleContractRenderJob } = await import(
	"../../src/lib/contracts/contractDocxPipeline.js"
);
const { getSupabase, setSupabaseClient } = await import(
	"../../src/lib/supabase.js"
);

const originalClient = getSupabase();
const FUTURE = new Date(Date.now() + 120_000).toISOString();
const PAST = new Date(Date.now() - 120_000).toISOString();

interface Recorded {
	statuses?: string[];
	update?: Record<string, unknown>;
}

/**
 * A stub for the one query chain the revival uses, recording what it was asked
 * for so the test can assert the filter as well as the write.
 */
function jobsClient(
	row: Record<string, unknown> | null,
	recorded: Recorded,
): SupabaseClient {
	const selectChain = {
		eq: () => selectChain,
		in: (_column: string, statuses: string[]) => {
			recorded.statuses = statuses;
			return selectChain;
		},
		order: () => selectChain,
		limit: () => selectChain,
		maybeSingle: async () => ({ data: row, error: null }),
	};
	return {
		from: () => ({
			select: () => selectChain,
			update: (values: Record<string, unknown>) => {
				recorded.update = values;
				return { eq: async () => ({ error: null }) };
			},
		}),
	} as unknown as SupabaseClient;
}

describe("reviving a stale contract render job", () => {
	afterEach(() => setSupabaseClient(originalClient));

	it("leaves a job that still holds a live lease alone", async () => {
		const recorded: Recorded = {};
		setSupabaseClient(
			jobsClient(
				{ id: "job-1", status: "processing", lease_expires_at: FUTURE },
				recorded,
			),
		);
		assert.equal(
			await reviveStaleContractRenderJob({ templateDocumentId: "doc-1" }),
			"live",
		);
		assert.equal(recorded.update, undefined);
	});

	it("revives a job abandoned by a killed worker", async () => {
		// The attempt is consumed at claim time, so five kills leave the job
		// unclaimable at max_attempts while still 'processing'. A fresh attempt
		// budget is the point of an operator-initiated retry.
		const recorded: Recorded = {};
		setSupabaseClient(
			jobsClient(
				{ id: "job-2", status: "processing", lease_expires_at: PAST },
				recorded,
			),
		);
		assert.equal(
			await reviveStaleContractRenderJob({ documentVersionId: "version-1" }),
			"revived",
		);
		assert.equal(recorded.update?.status, "queued");
		assert.equal(recorded.update?.attempt_count, 0);
		// contract_render_jobs_lease_check rejects a queued row that still carries
		// lease columns.
		assert.equal(recorded.update?.leased_by, null);
		assert.equal(recorded.update?.lease_token, null);
		assert.equal(recorded.update?.lease_expires_at, null);
		assert.equal(recorded.update?.finished_at, null);
	});

	it("revives a queued job that no claim will pick up", async () => {
		const recorded: Recorded = {};
		setSupabaseClient(
			jobsClient(
				{ id: "job-3", status: "queued", lease_expires_at: null },
				recorded,
			),
		);
		assert.equal(
			await reviveStaleContractRenderJob({ templateDocumentId: "doc-2" }),
			"revived",
		);
		assert.deepEqual(recorded.statuses, ["queued", "processing"]);
	});

	it("can include failed jobs so a submission keeps its stored payload", async () => {
		const recorded: Recorded = {};
		setSupabaseClient(
			jobsClient(
				{ id: "job-4", status: "failed", lease_expires_at: PAST },
				recorded,
			),
		);
		assert.equal(
			await reviveStaleContractRenderJob({
				documentVersionId: "version-2",
				statuses: ["queued", "processing", "failed"],
			}),
			"revived",
		);
		assert.deepEqual(recorded.statuses, ["queued", "processing", "failed"]);
	});

	it("reports a missing job so the caller can enqueue a fresh one", async () => {
		const recorded: Recorded = {};
		setSupabaseClient(jobsClient(null, recorded));
		assert.equal(
			await reviveStaleContractRenderJob({ templateDocumentId: "doc-3" }),
			"missing",
		);
		assert.equal(recorded.update, undefined);
	});

	it("does nothing without a target", async () => {
		const recorded: Recorded = {};
		setSupabaseClient(jobsClient(null, recorded));
		assert.equal(await reviveStaleContractRenderJob({}), "missing");
		assert.equal(recorded.statuses, undefined);
	});
});
