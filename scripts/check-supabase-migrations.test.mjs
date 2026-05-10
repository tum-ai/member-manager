import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	formatMigrationDrift,
	parseSupabaseMigrationList,
} from "./check-supabase-migrations.mjs";

describe("parseSupabaseMigrationList", () => {
	test("reports migrations that exist locally but not remotely", () => {
		const drift = parseSupabaseMigrationList(`
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20260426001000 | 20260426001000 | 2026-04-26 00:10:00
   20260429090000 |                | 2026-04-29 09:00:00
   20260502110000 |                | 2026-05-02 11:00:00
`);

		assert.deepEqual(drift, {
			missingRemote: ["20260429090000", "20260502110000"],
			missingLocal: [],
			mismatchedRows: [],
		});
	});

	test("reports migrations that exist remotely but not locally", () => {
		const drift = parseSupabaseMigrationList(`
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
                  | 20260429090000 | 2026-04-29 09:00:00
`);

		assert.deepEqual(drift, {
			missingRemote: [],
			missingLocal: ["20260429090000"],
			mismatchedRows: [],
		});
	});

	test("ignores headers and matched rows", () => {
		const drift = parseSupabaseMigrationList(`
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20260426001000 | 20260426001000 | 2026-04-26 00:10:00
`);

		assert.deepEqual(drift, {
			missingRemote: [],
			missingLocal: [],
			mismatchedRows: [],
		});
	});
});

describe("formatMigrationDrift", () => {
	test("prints actionable migration ids", () => {
		const message = formatMigrationDrift({
			missingRemote: ["20260429090000"],
			missingLocal: ["20260430090000"],
			mismatchedRows: [],
		});

		assert.match(message, /Local migrations missing/);
		assert.match(message, /20260429090000/);
		assert.match(message, /Remote migrations missing/);
		assert.match(message, /20260430090000/);
	});
});
