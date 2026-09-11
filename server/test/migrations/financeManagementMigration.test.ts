import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const managementMigration = readFileSync(
	new URL(
		"../../../supabase/migrations/20260721210000_finance_management_platform.sql",
		import.meta.url,
	),
	"utf8",
);
const reimbursementMigration = readFileSync(
	new URL(
		"../../../supabase/migrations/20260721211000_finance_reimbursement_links.sql",
		import.meta.url,
	),
	"utf8",
);
const planningMigration = readFileSync(
	new URL(
		"../../../supabase/migrations/20260721212000_finance_planning_and_budget_transfers.sql",
		import.meta.url,
	),
	"utf8",
);
const projectProtectionMigration = readFileSync(
	new URL(
		"../../../supabase/migrations/20260722090000_protect_finance_project_scope.sql",
		import.meta.url,
	),
	"utf8",
);
const projectSubTeamMigration = readFileSync(
	new URL(
		"../../../supabase/migrations/20260808120000_finance_project_sub_team.sql",
		import.meta.url,
	),
	"utf8",
);
const planItemLifecycleMigration = readFileSync(
	new URL(
		"../../../supabase/migrations/20260808120100_finance_plan_item_lifecycle.sql",
		import.meta.url,
	),
	"utf8",
);
const departmentMatchCapacityMigration = readFileSync(
	new URL(
		"../../../supabase/migrations/20260825120000_finance_department_match_capacity.sql",
		import.meta.url,
	),
	"utf8",
);
const projectDeleteFoldMigration = readFileSync(
	new URL(
		"../../../supabase/migrations/20260911120000_finance_project_delete_target_fold.sql",
		import.meta.url,
	),
	"utf8",
);

describe("finance management migrations", () => {
	test("creates all managed finance tables with RLS", () => {
		for (const table of [
			"finance_projects",
			"finance_plan_templates",
			"finance_plan_template_items",
			"finance_project_template_assignments",
			"finance_posting_allocations",
			"finance_reallocation_requests",
			"finance_reallocation_request_items",
			"finance_plan_item_posting_matches",
		]) {
			assert.match(
				managementMigration,
				new RegExp(`create table "public"\\."${table}"`),
			);
			assert.match(
				managementMigration,
				new RegExp(
					`alter table "public"\\."${table}"[\\s\\S]*?enable row level security`,
				),
			);
		}
	});

	test("hardens security-definer functions and limits RPC execution", () => {
		assert.match(
			managementMigration,
			/is_finance_department_member"[\s\S]*?security definer[\s\S]*?set search_path = ''/i,
		);
		for (const fn of [
			"assign_finance_plan_template",
			"replace_finance_posting_allocations",
			"create_finance_plan_item_posting_match",
			"create_finance_reallocation_request",
			"review_finance_reallocation_request",
		]) {
			assert.match(
				managementMigration,
				new RegExp(
					`${fn}"[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
					"i",
				),
			);
			assert.match(
				managementMigration,
				new RegExp(
					`grant execute[\\s\\S]*?${fn}"[\\s\\S]*?to service_role`,
					"i",
				),
			);
		}
	});

	test("uses exact grants without broad or truncate privileges", () => {
		assert.doesNotMatch(managementMigration, /\bgrant\s+all\b/i);
		assert.doesNotMatch(managementMigration, /\btruncate\b/i);
		const managedTables = [
			"finance_projects",
			"finance_plan_templates",
			"finance_plan_template_items",
			"finance_project_template_assignments",
			"finance_posting_allocations",
			"finance_reallocation_requests",
			"finance_reallocation_request_items",
			"finance_plan_item_posting_matches",
			"finance_plan_items",
		];
		const statements = managementMigration
			.split(";")
			.map((statement) => statement.trim());
		for (const table of managedTables) {
			assert.ok(
				statements.some(
					(statement) =>
						/^grant select\s/i.test(statement) &&
						new RegExp(`on table "public"\\."${table}"`, "i").test(statement) &&
						/\bto authenticated$/i.test(statement),
				),
				`expected authenticated SELECT grant for ${table}`,
			);
			assert.ok(
				statements.some(
					(statement) =>
						/^grant select, insert, update, delete\s/i.test(statement) &&
						new RegExp(`on table "public"\\."${table}"`, "i").test(statement) &&
						/\bto service_role$/i.test(statement),
				),
				`expected service-role write grant for ${table}`,
			);
		}
		for (const statement of statements) {
			if (
				/^grant .+\s+on table /is.test(statement) &&
				/\bto authenticated$/i.test(statement)
			) {
				assert.doesNotMatch(statement, /\b(insert|update|delete)\b/i);
			}
		}
		assert.doesNotMatch(reimbursementMigration, /\bgrant\s+all\b/i);
		assert.doesNotMatch(reimbursementMigration, /\btruncate\b/i);
		assert.match(
			reimbursementMigration,
			/grant select, insert, update, delete[\s\S]*?to service_role/i,
		);
	});

	test("keeps authenticated finance policies read-only", () => {
		const policyStatements = managementMigration
			.split(";")
			.map((statement) => statement.trim())
			.filter((statement) => /^create policy /i.test(statement));
		for (const statement of policyStatements) {
			if (/\bto authenticated\b/i.test(statement)) {
				assert.match(statement, /\bfor select\b/i);
				assert.doesNotMatch(statement, /\bwith check\b/i);
			}
		}
		assert.match(
			managementMigration,
			/drop policy if exists "Finance reviewers manage plan items"/i,
		);
		assert.match(
			managementMigration,
			/drop policy if exists "Department members manage own plan items"/i,
		);
	});

	test("serializes allocation replacement and match capacity checks", () => {
		const matchFunction = managementMigration.slice(
			managementMigration.indexOf(
				'create or replace function "public"."create_finance_plan_item_posting_match"',
			),
			managementMigration.indexOf(
				'create or replace function "public"."create_finance_reallocation_request"',
			),
		);
		assert.match(
			managementMigration,
			/create unique index "finance_posting_allocations_target_idx"[\s\S]*?nulls not distinct/i,
		);
		assert.match(
			managementMigration,
			/replace_finance_posting_allocations"[\s\S]*?'finance-posting:'[\s\S]*?Posting allocation targets must be unique[\s\S]*?cannot invalidate existing plan item matches/i,
		);
		assert.match(matchFunction, /p_posting_amount/i);
		assert.match(matchFunction, /'finance-posting:'/i);
		assert.match(matchFunction, /'finance-plan-item:'/i);
		assert.match(
			matchFunction,
			/least\(v_posting_lock, v_plan_item_lock\)[\s\S]*?greatest\(v_posting_lock, v_plan_item_lock\)/i,
		);
		assert.match(
			matchFunction,
			/row_number\(\) over[\s\S]*?coalesce\(a\.department, ''\) collate "C"[\s\S]*?coalesce\(a\.project_id::text, ''\) collate "C"[\s\S]*?coalesce\(a\.tax_area, ''\) collate "C"/i,
		);
		assert.match(
			matchFunction,
			/floor\([\s\S]*?v_posting_cents[\s\S]*?allocated_percentage[\s\S]*?\/ 100[\s\S]*?\+ 0\.5[\s\S]*?\)::bigint/i,
		);
		assert.match(
			matchFunction,
			/v_posting_cents[\s\S]*?-[\s\S]*?coalesce\(sum\(rounded_cents\) over \(\), 0\)/i,
		);
		assert.match(
			matchFunction,
			/sum\(abs\(allocated_cents\)\) filter[\s\S]*?v_scope_allocated_cents[\s\S]*?v_scope_allocated_cents::numeric \/ 100/i,
		);
		assert.doesNotMatch(matchFunction, /sum\(abs\(a\.allocated_amount\)\)/i);
		assert.doesNotMatch(matchFunction, /v_scope_percentage/i);
		assert.match(
			matchFunction,
			/project_id is not distinct from v_plan_item\.project_id/i,
		);
		assert.match(
			matchFunction,
			/v_posting_matched \+ p_matched_amount[\s\S]*?> v_effective_posting_capacity/i,
		);
		assert.doesNotMatch(
			matchFunction,
			/v_effective_posting_capacity \+ 0\.01/i,
		);
		assert.match(
			matchFunction,
			/v_plan_item_matched \+ p_matched_amount[\s\S]*?> v_plan_item\.planned_amount/i,
		);
		assert.match(
			managementMigration,
			/revoke all[\s\S]*?create_finance_plan_item_posting_match"[\s\S]*?from public, anon, authenticated, service_role[\s\S]*?grant execute[\s\S]*?create_finance_plan_item_posting_match"[\s\S]*?to service_role/i,
		);
		assert.match(
			managementMigration,
			/create unique index "finance_reallocation_requests_pending_posting_idx"[\s\S]*?where "status" = 'pending'/i,
		);
		assert.match(
			managementMigration,
			/create unique index "finance_reallocation_request_items_target_idx"[\s\S]*?nulls not distinct/i,
		);
		assert.match(
			managementMigration,
			/create_finance_reallocation_request"[\s\S]*?Requested allocation targets must be unique[\s\S]*?allocation_snapshot[\s\S]*?pending reallocation request/i,
		);
		assert.match(
			managementMigration,
			/review_finance_reallocation_request"[\s\S]*?'finance-posting:'[\s\S]*?allocation_snapshot[\s\S]*?request is stale/i,
		);
	});

	test("adds nullable reimbursement linkage with foreign keys", () => {
		assert.match(
			reimbursementMigration,
			/add column "finance_project_id" uuid[\s\S]*?references "public"\."finance_projects"/i,
		);
		assert.match(
			reimbursementMigration,
			/add column "finance_plan_item_id" uuid[\s\S]*?references "public"\."finance_plan_items"/i,
		);
		assert.match(
			reimbursementMigration,
			/add column "bb_posting_external_id" text/i,
		);
	});

	test("adds directional plans and atomic budget transfers", () => {
		assert.match(
			planningMigration,
			/add column "direction" text not null default 'expense'/i,
		);
		assert.match(
			planningMigration,
			/create_finance_plan_item_posting_match"[\s\S]*?p_posting_amount[\s\S]*?v_plan_item\.direction <> p_posting_direction[\s\S]*?row_number\(\) over[\s\S]*?rounded_cents[\s\S]*?allocated_cents[\s\S]*?v_scope_allocated_cents::numeric \/ 100/i,
		);
		assert.match(
			planningMigration,
			/update_finance_plan_item"[\s\S]*?'finance-plan-item:'[\s\S]*?cannot be reduced below its matched total[\s\S]*?coalesce\(p_direction, v_plan_item\.direction\)[\s\S]*?direction cannot change while postings are matched[\s\S]*?direction = coalesce\(p_direction, v_plan_item\.direction\)/i,
		);
		assert.match(
			planningMigration,
			/create table "public"\."finance_budget_transfer_requests"/i,
		);
		assert.match(
			planningMigration,
			/review_finance_budget_transfer_request"[\s\S]*?for update[\s\S]*?pg_advisory_xact_lock[\s\S]*?amount_planned = amount_planned - v_request.amount[\s\S]*?on conflict \(department, period_type, period_key\)/i,
		);
		assert.match(
			planningMigration,
			/revoke insert, update, delete[\s\S]*?from authenticated/i,
		);
	});

	test("protects linked finance records from project scope changes", () => {
		const lockedTables = [
			"finance_project_template_assignments",
			"finance_plan_items",
			"finance_posting_allocations",
			"finance_reallocation_request_items",
			"reimbursements",
			"finance_projects",
		];
		for (const table of lockedTables) {
			assert.match(
				projectProtectionMigration,
				new RegExp(
					`lock table public\\.${table}\\s+in share row exclusive mode`,
					"i",
				),
			);
		}
		assert.match(
			projectProtectionMigration,
			/update_finance_project"[\s\S]*?lock table public\.finance_project_template_assignments[\s\S]*?lock table public\.finance_projects[\s\S]*?pg_advisory_xact_lock[\s\S]*?for update/i,
		);
		assert.match(
			projectProtectionMigration,
			/p_parent_project_id is not null[\s\S]*?Parent finance project not found[\s\S]*?Parent project must use the same department and period[\s\S]*?with recursive parent_chain[\s\S]*?Project hierarchy cannot contain a cycle/i,
		);
		assert.match(
			projectProtectionMigration,
			/v_project\.department is distinct from p_department[\s\S]*?v_project\.period_type is distinct from p_period_type[\s\S]*?v_project\.period_key is distinct from p_period_key/i,
		);
		for (const dependency of [
			"finance_projects",
			"finance_plan_items",
			"finance_posting_allocations",
			"finance_reallocation_request_items",
			"finance_project_template_assignments",
			"reimbursements",
		]) {
			assert.match(
				projectProtectionMigration,
				new RegExp(
					`from public\\.${dependency}[\\s\\S]*?project_id = p_id`,
					"i",
				),
			);
		}
		assert.match(
			projectProtectionMigration,
			/dependent finance records exist/i,
		);
		assert.match(
			projectProtectionMigration,
			/revoke all[\s\S]*?update_finance_project"[\s\S]*?from public, anon, authenticated, service_role[\s\S]*?grant execute[\s\S]*?update_finance_project"[\s\S]*?to service_role/i,
		);
	});

	test("gives projects a sub-team and keeps update_finance_project single-arity", () => {
		assert.match(
			projectSubTeamMigration,
			/alter table "public"\."finance_projects"[\s\S]*?add column if not exists "sub_team" text/i,
		);
		assert.match(
			projectSubTeamMigration,
			/update_finance_project"[\s\S]*?"p_sub_team" text[\s\S]*?sub_team = p_sub_team/i,
		);
		// The pre-existing 10-argument overload has to go, or a caller that omits
		// p_sub_team resolves to it and silently drops the folder.
		assert.match(
			projectSubTeamMigration,
			/drop function if exists "public"\."update_finance_project"\(\s*uuid,(?:\s*(?:uuid|text|numeric),){8}\s*text\s*\)/i,
		);
	});

	test("validates the plan item project scope inside the creating transaction", () => {
		const createFunction = planItemLifecycleMigration.slice(
			planItemLifecycleMigration.indexOf(
				'create or replace function "public"."create_finance_plan_item"',
			),
			planItemLifecycleMigration.indexOf(
				'create or replace function "public"."delete_finance_plan_item_posting_match"',
			),
		);
		assert.ok(createFunction.length > 0);
		assert.match(
			createFunction,
			/security definer[\s\S]*?set search_path = ''/i,
		);
		// The route only authorises p_department, so the project reference has to
		// be checked against the item's own department and period before insert.
		assert.match(
			createFunction,
			/from public\.finance_projects[\s\S]*?where id = p_project_id[\s\S]*?for share[\s\S]*?Finance project not found[\s\S]*?v_project\.department is distinct from p_department[\s\S]*?v_project\.period_type is distinct from p_period_type[\s\S]*?v_project\.period_key is distinct from p_period_key[\s\S]*?Plan item project must use the same department and period/i,
		);
		assert.match(
			createFunction,
			/insert into public\.finance_plan_items[\s\S]*?returning \* into v_plan_item/i,
		);
		assert.match(
			planItemLifecycleMigration,
			/revoke all[\s\S]*?create_finance_plan_item"[\s\S]*?from public, anon, authenticated, service_role[\s\S]*?grant execute[\s\S]*?create_finance_plan_item"[\s\S]*?to service_role/i,
		);
	});

	test("keeps disabled Planposten out of new matches and single-arity updates", () => {
		assert.match(
			planItemLifecycleMigration,
			/add column if not exists "is_active" boolean not null default true/i,
		);
		assert.match(
			planItemLifecycleMigration,
			/add column if not exists "vat_rate" numeric\(5, 2\)[\s\S]*?>= 0 and "vat_rate" <= 100/i,
		);
		assert.match(
			planItemLifecycleMigration,
			/update_finance_plan_item"[\s\S]*?"p_project_id" uuid[\s\S]*?"p_is_active" boolean[\s\S]*?"p_vat_rate" numeric/i,
		);
		assert.match(
			planItemLifecycleMigration,
			/drop function if exists "public"\."update_finance_plan_item"\(\s*uuid,(?:\s*(?:text|numeric),){6}\s*text\s*\)/i,
		);
	});
	// A department-level Planposten must survive its invoice being filed into a
	// project of the same department: the money never leaves the department, so
	// the match is still funded (FR-L7).
	test("funds a department-level match from any project of that department", () => {
		assert.match(
			departmentMatchCapacityMigration,
			/create or replace function "public"\."replace_finance_posting_allocations"/i,
		);
		assert.match(
			departmentMatchCapacityMigration,
			/matched_scope\.project_id is null\s*\n\s*or nullif\(entry ->> 'project_id', ''\)::uuid\s*\n\s*is not distinct from matched_scope\.project_id/i,
		);
		// The rest of the guard is carried over verbatim, not weakened.
		assert.match(
			departmentMatchCapacityMigration,
			/cannot invalidate existing plan item matches/i,
		);
		assert.match(
			departmentMatchCapacityMigration,
			/pg_advisory_xact_lock[\s\S]*?'finance-posting:'/i,
		);
		assert.match(
			departmentMatchCapacityMigration,
			/Posting allocation targets must be unique/i,
		);
		assert.match(
			departmentMatchCapacityMigration,
			/grant execute\s*\non function "public"\."replace_finance_posting_allocations"/i,
		);
	});

	// An invoice split between a project and the *direct* bucket of the same
	// department with the same tax area leaves two rows that differ only in
	// `project_id`. Both target indexes are UNIQUE NULLS NOT DISTINCT, so the
	// ON DELETE SET NULL turned them into duplicates and the delete failed with
	// a 500 instead of detaching the invoice.
	test("folds colliding allocation targets before deleting a project", () => {
		assert.match(
			projectDeleteFoldMigration,
			/create or replace function "public"\."delete_finance_project"\("p_id" uuid\)[\s\S]*?security definer[\s\S]*?set search_path = ''/i,
		);
		// Same dependency-first lock order as update_finance_project, then the
		// per-project advisory lock, then the row itself.
		for (const table of [
			"finance_project_template_assignments",
			"finance_plan_items",
			"finance_posting_allocations",
			"finance_reallocation_request_items",
			"reimbursements",
			"finance_projects",
		]) {
			assert.match(
				projectDeleteFoldMigration,
				new RegExp(
					`lock table public\\.${table}\\s+in share row exclusive mode`,
					"i",
				),
			);
		}
		assert.match(
			projectDeleteFoldMigration,
			/lock table public\.finance_project_template_assignments[\s\S]*?lock table public\.finance_projects[\s\S]*?pg_advisory_xact_lock\(\s*\n\s*pg_catalog\.hashtextextended\('finance-project:'[\s\S]*?where id = p_id\s*\n\s*for update/i,
		);
		assert.match(
			projectDeleteFoldMigration,
			/if not found then\s*\n\s*raise exception 'Finance project not found';/i,
		);

		const allocationFold = projectDeleteFoldMigration.slice(
			projectDeleteFoldMigration.indexOf(
				"from public.finance_posting_allocations a",
			),
			projectDeleteFoldMigration.indexOf(
				"from public.finance_reallocation_request_items i",
			),
		);
		assert.ok(allocationFold.length > 0);
		// The post-delete target reads the project's department for a row that only
		// names the project, so the fold also keeps *_target_check satisfied.
		assert.match(
			allocationFold,
			/group by\s*\n\s*a\.posting_external_id,\s*\n\s*coalesce\(a\.department, v_project\.department\),\s*\n\s*a\.tax_area/i,
		);
		// Money is preserved by summing the stored fixed-scale values into the
		// surviving department-level row — no re-apportioning, no re-rounding.
		assert.match(
			allocationFold,
			/update public\.finance_posting_allocations s\s*\n\s*set\s*\n\s*allocated_amount = s\.allocated_amount \+ v_fold\.allocated_amount,\s*\n\s*allocated_percentage =\s*\n\s*s\.allocated_percentage \+ v_fold\.allocated_percentage/i,
		);
		assert.match(allocationFold, /and s\.project_id is null/i);
		assert.match(
			allocationFold,
			/delete from public\.finance_posting_allocations a\s*\n\s*where a\.project_id = p_id/i,
		);

		const itemFold = projectDeleteFoldMigration.slice(
			projectDeleteFoldMigration.indexOf(
				"from public.finance_reallocation_request_items i",
			),
		);
		assert.match(
			itemFold,
			/group by\s*\n\s*i\.request_id,\s*\n\s*coalesce\(i\.department, v_project\.department\),\s*\n\s*i\.tax_area/i,
		);
		assert.match(
			itemFold,
			/update public\.finance_reallocation_request_items s\s*\n\s*set\s*\n\s*allocated_amount = s\.allocated_amount \+ v_fold\.allocated_amount,\s*\n\s*allocated_percentage =\s*\n\s*s\.allocated_percentage \+ v_fold\.allocated_percentage/i,
		);
		assert.match(itemFold, /and s\.project_id is null/i);

		// Both folds have to happen before the project row goes away, or the FK
		// fires first and the unique violation is back.
		const projectDelete = projectDeleteFoldMigration.indexOf(
			"delete from public.finance_projects",
		);
		assert.ok(projectDelete > 0);
		assert.ok(
			projectDeleteFoldMigration.indexOf(
				"from public.finance_reallocation_request_items i",
			) < projectDelete,
		);
		// Re-rounding or re-apportioning the fold would corrupt the posting total.
		assert.doesNotMatch(projectDeleteFoldMigration, /\bfloor\(/i);
		assert.doesNotMatch(projectDeleteFoldMigration, /\bround\(/i);
		assert.match(
			projectDeleteFoldMigration,
			/revoke all\s*\non function "public"\."delete_finance_project"\(uuid\)\s*\nfrom public, anon, authenticated, service_role;\s*\ngrant execute\s*\non function "public"\."delete_finance_project"\(uuid\)\s*\nto service_role;/i,
		);
		assert.doesNotMatch(projectDeleteFoldMigration, /\bgrant\s+all\b/i);
		assert.doesNotMatch(projectDeleteFoldMigration, /\btruncate\b/i);
	});
});
