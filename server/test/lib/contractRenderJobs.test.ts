import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type ClaimedContractRenderJob,
	type ContractRenderJobStore,
	processContractRenderJobs,
} from "../../src/lib/contracts/contractRenderJobs.js";
import { ValidationError } from "../../src/lib/errors.js";

function job(
	overrides: Partial<ClaimedContractRenderJob> = {},
): ClaimedContractRenderJob {
	return {
		id: crypto.randomUUID(),
		operation: "submission_render",
		status: "processing",
		attempt_count: 1,
		max_attempts: 3,
		document_version_id: crypto.randomUUID(),
		template_document_id: crypto.randomUUID(),
		encrypted_payload: "enc-bin-v1:test",
		leased_by: "worker-1",
		lease_token: crypto.randomUUID(),
		lease_expires_at: new Date(Date.now() + 300_000).toISOString(),
		...overrides,
	};
}

describe("contract render job processor", () => {
	it("claims and finalizes successful jobs", async () => {
		const queue = [job()];
		const finalized: Parameters<ContractRenderJobStore["finalize"]>[0][] = [];
		const store: ContractRenderJobStore = {
			async claim() {
				return queue.shift() ?? null;
			},
			async finalize(args) {
				finalized.push(args);
			},
		};
		const result = await processContractRenderJobs({
			workerId: "worker-1",
			store,
			handlers: {
				submission_render: async () => ({
					converterVersion: "libreoffice-test",
					pdf: { path: "submission/v1.pdf", sizeBytes: 5, sha256: "a" },
				}),
			},
		});
		assert.deepEqual(result, { claimed: 1, succeeded: 1, failed: 0 });
		assert.equal(finalized.length, 1);
		assert.equal(finalized[0]?.succeeded, true);
	});

	it("persists a safe validation error", async () => {
		const queue = [job()];
		let finalized: Parameters<ContractRenderJobStore["finalize"]>[0] | null =
			null;
		const store: ContractRenderJobStore = {
			async claim() {
				return queue.shift() ?? null;
			},
			async finalize(args) {
				finalized = args;
			},
		};
		await processContractRenderJobs({
			workerId: "worker-1",
			store,
			handlers: {
				submission_render: async () => {
					throw new ValidationError("Invalid template", {
						code: "DOCX_INVALID",
					});
				},
			},
		});
		assert.equal(finalized?.succeeded, false);
		assert.equal(finalized?.errorCode, "DOCX_INVALID");
	});

	it("keeps an actionable message for unexpected failures", async () => {
		const queue = [job()];
		let finalized: Parameters<ContractRenderJobStore["finalize"]>[0] | null =
			null;
		const store: ContractRenderJobStore = {
			async claim() {
				return queue.shift() ?? null;
			},
			async finalize(args) {
				finalized = args;
			},
		};
		await processContractRenderJobs({
			workerId: "worker-1",
			store,
			handlers: {
				submission_render: async () => {
					throw new Error("Vercel OIDC token is missing");
				},
			},
		});
		assert.equal(finalized?.errorCode, "CONTRACT_RENDER_FAILED");
		assert.equal(finalized?.errorMessage, "Vercel OIDC token is missing");
	});

	it("fails a claimed job when its operation has no handler", async () => {
		const queue = [job({ operation: "opensign_ingest" })];
		let errorCode: string | null | undefined;
		const store: ContractRenderJobStore = {
			async claim() {
				return queue.shift() ?? null;
			},
			async finalize(args) {
				errorCode = args.errorCode;
			},
		};
		const result = await processContractRenderJobs({
			workerId: "worker-1",
			store,
			handlers: {},
		});
		assert.equal(result.failed, 1);
		assert.equal(errorCode, "CONTRACT_RENDER_HANDLER_MISSING");
	});
});
