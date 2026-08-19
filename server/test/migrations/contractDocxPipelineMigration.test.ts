import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const migration = readFileSync(
	new URL(
		"../../../supabase/migrations/20260819090000_contract_docx_pipeline.sql",
		import.meta.url,
	),
	"utf8",
);

describe("contract DOCX pipeline migration", () => {
	test("creates only private encrypted artifact buckets", () => {
		for (const bucket of [
			"contract-template-documents",
			"contract-render-artifacts",
		]) {
			assert.match(
				migration,
				new RegExp(
					`'${bucket}'[\\s\\S]*?false[\\s\\S]*?application/octet-stream`,
				),
			);
		}
		assert.match(migration, /No storage\.objects policies are added/i);
	});

	test("keeps form data and job payloads encrypted", () => {
		assert.match(
			migration,
			/contract_submissions_encrypted_form_check[\s\S]*?enc-bin-v1:%/i,
		);
		assert.match(
			migration,
			/contract_document_versions_encrypted_snapshot_check[\s\S]*?enc-bin-v1:%/i,
		);
		assert.match(
			migration,
			/contract_render_jobs_encrypted_payload_check[\s\S]*?enc-bin-v1:%/i,
		);
		assert.match(
			migration,
			/renderer_engine" = 'docx'[\s\S]*?form_data" = '\{\}'::jsonb[\s\S]*?form_data_encrypted" like 'enc-bin-v1:%'/i,
		);
	});

	test("uses durable leased jobs with bounded retries", () => {
		assert.match(
			migration,
			/create or replace function "public"\."claim_contract_render_job"[\s\S]*?for update skip locked[\s\S]*?lease_token = gen_random_uuid\(\)/i,
		);
		assert.match(
			migration,
			/create or replace function "public"\."finalize_contract_render_job"[\s\S]*?status = 'processing' and lease_token = p_lease_token/i,
		);
		assert.match(
			migration,
			/attempt_count < v_job\.max_attempts[\s\S]*?status = 'queued'[\s\S]*?least\(300, 5 \* \(2 \^/i,
		);
	});

	test("updates templates and signing state only after successful rendering", () => {
		const successfulBranch = migration.slice(
			migration.indexOf("if p_succeeded then"),
			migration.indexOf("else\n        if nullif(btrim(p_error_code)"),
		);
		assert.match(
			successfulBranch,
			/operation = 'template_preview'[\s\S]*?status = 'ready'[\s\S]*?active_document_id into v_active_document_id[\s\S]*?if v_active_document_id is null then[\s\S]*?activate_contract_template_document/i,
		);
		assert.match(
			successfulBranch,
			/operation = 'partner_signature'[\s\S]*?status = 'partner_signed'/i,
		);
		assert.match(
			successfulBranch,
			/operation = 'board_signature'[\s\S]*?status = 'board_signed'/i,
		);
	});

	test("keeps new submissions on the legacy engine until Legal cuts over", () => {
		assert.match(
			migration,
			/insert into "public"\."contract_pipeline_settings"[\s\S]*?values \(true, 'legacy_text'\)/i,
		);
		assert.match(
			migration,
			/Global cutover for new submissions only\. Existing submissions retain their pinned renderer\./i,
		);
	});

	test("limits tables and worker functions to the service role", () => {
		for (const table of [
			"contract_template_documents",
			"contract_pipeline_settings",
			"contract_render_jobs",
		]) {
			assert.match(
				migration,
				new RegExp(
					`alter table "public"\\."${table}" enable row level security`,
					"i",
				),
			);
			assert.match(
				migration,
				new RegExp(
					`revoke all on table "public"\\."${table}" from "public", "anon", "authenticated"`,
					"i",
				),
			);
		}
		for (const fn of [
			"claim_contract_render_job",
			"finalize_contract_render_job",
		]) {
			assert.match(
				migration,
				new RegExp(
					`revoke all on function "public"\\."${fn}"[\\s\\S]*?from "public", "anon", "authenticated"`,
					"i",
				),
			);
			assert.match(
				migration,
				new RegExp(
					`grant execute on function "public"\\."${fn}"[\\s\\S]*?to "service_role"`,
					"i",
				),
			);
		}
	});
});
