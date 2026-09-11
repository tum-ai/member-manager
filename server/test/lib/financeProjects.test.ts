import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { deleteFinanceProject } = await import(
	"../../src/lib/financeProjects.js"
);
const { DatabaseError, NotFoundError } = await import(
	"../../src/lib/errors.js"
);
const { setSupabaseClient } = await import("../../src/lib/supabase.js");

const PROJECT_ID = "10000000-0000-4000-8000-000000000001";

function stubSupabase(
	rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
): void {
	setSupabaseClient({
		rpc,
		from: () => {
			throw new Error(
				"deleteFinanceProject must not delete finance_projects directly",
			);
		},
	} as unknown as SupabaseClient);
}

describe("deleteFinanceProject", () => {
	// The reviewer's scenario: a valid invoice is split between this project and
	// the direct bucket of the same department with the same tax area. A bare
	// PostgREST delete lets the ON DELETE SET NULL produce two identical targets
	// under `finance_posting_allocations_target_idx` (UNIQUE NULLS NOT DISTINCT)
	// and answers 500, so the delete has to go through the folding RPC.
	test("detaches through the collision-folding RPC, not a bare delete", async () => {
		let rpcName = "";
		let rpcParams: Record<string, unknown> = {};
		stubSupabase(async (name, params) => {
			rpcName = name;
			rpcParams = params;
			return { data: null, error: null };
		});

		await deleteFinanceProject(PROJECT_ID);

		assert.strictEqual(rpcName, "delete_finance_project");
		assert.deepStrictEqual(rpcParams, { p_id: PROJECT_ID });
	});

	test("maps a missing project to a 404", async () => {
		stubSupabase(async () => ({
			data: null,
			error: { message: "Finance project not found" },
		}));

		await assert.rejects(deleteFinanceProject(PROJECT_ID), (error: unknown) => {
			assert.ok(error instanceof NotFoundError);
			assert.strictEqual(error.message, "Finance project not found");
			return true;
		});
	});

	test("maps any other RPC failure to a database error", async () => {
		stubSupabase(async () => ({
			data: null,
			error: { message: "deadlock detected" },
		}));

		await assert.rejects(deleteFinanceProject(PROJECT_ID), (error: unknown) => {
			assert.ok(error instanceof DatabaseError);
			assert.strictEqual(error.message, "Failed to delete finance project");
			return true;
		});
	});
});
