import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const MIGRATION_PATH = new URL(
	"../../../supabase/migrations/20260906120000_vivid_reimbursements.sql",
	import.meta.url,
);
const migration = readFileSync(MIGRATION_PATH, "utf8");
const RUN_LOCAL_RLS_TESTS = process.env.RUN_LOCAL_SUPABASE_RLS_TESTS === "true";
const REPO_ROOT =
	process.env.SUPABASE_TEST_PROJECT_DIR ??
	fileURLToPath(new URL("../../..", import.meta.url));

test("Vivid reimbursement migration preserves API-only writes and invariants", () => {
	assert.match(
		migration,
		/reimbursements_submission_type_check[\s\S]*vivid_reimbursement/i,
	);
	assert.match(
		migration,
		/reimbursements_payment_status_check[\s\S]*not_required/i,
	);
	assert.match(
		migration,
		/reimbursements_bank_details_required_check[\s\S]*vivid_reimbursement[\s\S]*payment_iban[\s\S]*is null[\s\S]*payment_bic[\s\S]*is null/i,
	);
	assert.match(
		migration,
		/reimbursements_vivid_payment_status_check[\s\S]*payment_status[\s\S]*not_required/i,
	);
	assert.match(
		migration,
		/create policy "Eligible Vivid members insert reimbursements"[\s\S]*as restrictive[\s\S]*for insert[\s\S]*to authenticated/i,
	);
	assert.match(
		migration,
		/member_role in \('Team Lead', 'President', 'Vice-President'\)/i,
	);
	assert.match(
		migration,
		/revoke all on table "public"\."reimbursements"[\s\S]*from public, anon, authenticated/i,
	);
	assert.doesNotMatch(
		migration,
		/grant (?:select,\s*)?insert[\s\S]*to authenticated/i,
	);
});

function localSupabaseEnvironment(): Record<string, string> {
	const output = execFileSync("supabase", ["status", "-o", "env"], {
		cwd: REPO_ROOT,
		encoding: "utf8",
	});
	return Object.fromEntries(
		output
			.split(/\r?\n/)
			.map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
			.filter((match): match is RegExpMatchArray => match !== null)
			.map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, "")]),
	);
}

test("local RLS denies direct inserts for eligible and regular members", {
	skip: !RUN_LOCAL_RLS_TESTS,
}, async () => {
	const environment = localSupabaseEnvironment();
	const authOptions = {
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
	};
	const eligibleClient = createClient(
		environment.API_URL,
		environment.ANON_KEY,
		authOptions,
	);
	const regularClient = createClient(
		environment.API_URL,
		environment.ANON_KEY,
		authOptions,
	);
	const serviceClient = createClient(
		environment.API_URL,
		environment.SERVICE_ROLE_KEY,
		authOptions,
	);
	const vividId = randomUUID();
	const invalidIds: string[] = [];
	const encryptedIban =
		"enc-v1:PdayjKDOvLrZMvx8:xaHiqMnPTTIA_5_QoVTl5A:Rp2u_WN-8II1kg";
	const encryptedBic =
		"enc-v1:KayxX15tC5KsZjmV:XD6OlMbTzQ8jgNhi4b4s0g:4rtmTi7apV9d";

	const { error: seedError } = await serviceClient
		.from("reimbursements")
		.insert({
			id: vividId,
			user_id: "00000000-0000-0000-0000-000000000011",
			amount: 75,
			date: "2026-09-06",
			description: "RLS Vivid expense",
			department: "Makeathon",
			submission_type: "vivid_reimbursement",
			payment_iban: null,
			payment_bic: null,
			receipt_filename: "vivid.pdf",
			receipt_mime_type: "application/pdf",
			receipt_base64: "JVBERi0xLjQ=",
			status: "requested",
			approval_status: "pending",
			payment_status: "not_required",
		});
	assert.ifError(seedError);

	try {
		const { error: eligibleSignInError } =
			await eligibleClient.auth.signInWithPassword({
				email: "makeathon-lead@example.com",
				password: "password123",
			});
		assert.ifError(eligibleSignInError);
		const { error: eligibleInsertError } = await eligibleClient
			.from("reimbursements")
			.insert({
				user_id: "00000000-0000-0000-0000-000000000011",
				amount: 5,
				date: "2026-09-06",
				description: "Direct eligible insert",
				department: "Makeathon",
				submission_type: "vivid_reimbursement",
				payment_iban: null,
				payment_bic: null,
				receipt_filename: "vivid.pdf",
				receipt_mime_type: "application/pdf",
				receipt_base64: "JVBERi0xLjQ=",
				status: "requested",
				approval_status: "pending",
				payment_status: "not_required",
			});
		assert.strictEqual(eligibleInsertError?.code, "42501");

		const { error: regularSignInError } =
			await regularClient.auth.signInWithPassword({
				email: "regular-member@example.com",
				password: "password123",
			});
		assert.ifError(regularSignInError);
		const { error: regularInsertError } = await regularClient
			.from("reimbursements")
			.insert({
				user_id: "00000000-0000-0000-0000-000000000006",
				amount: 5,
				date: "2026-09-06",
				description: "Direct regular insert",
				department: "Community",
				submission_type: "vivid_reimbursement",
				payment_iban: null,
				payment_bic: null,
				receipt_filename: "vivid.pdf",
				receipt_mime_type: "application/pdf",
				receipt_base64: "JVBERi0xLjQ=",
				status: "requested",
				approval_status: "pending",
				payment_status: "not_required",
			});
		assert.strictEqual(regularInsertError?.code, "42501");

		const { error: paidError } = await serviceClient
			.from("reimbursements")
			.update({ status: "paid", payment_status: "paid" })
			.eq("id", vividId);
		assert.strictEqual(paidError?.code, "23514");

		const invalidRows = [
			{
				description: "Vivid encrypted bank details",
				submission_type: "vivid_reimbursement",
				payment_iban: encryptedIban,
				payment_bic: encryptedBic,
				payment_status: "not_required",
				status: "requested",
			},
			{
				description: "Vivid paid payment status",
				submission_type: "vivid_reimbursement",
				payment_iban: null,
				payment_bic: null,
				payment_status: "paid",
				status: "requested",
			},
			{
				description: "Vivid payable payment status",
				submission_type: "vivid_reimbursement",
				payment_iban: null,
				payment_bic: null,
				payment_status: "to_be_paid",
				status: "requested",
			},
			{
				description: "Vivid paid lifecycle status",
				submission_type: "vivid_reimbursement",
				payment_iban: null,
				payment_bic: null,
				payment_status: "not_required",
				status: "paid",
			},
			{
				description: "Regular non-payout status",
				submission_type: "reimbursement",
				payment_iban: encryptedIban,
				payment_bic: encryptedBic,
				payment_status: "not_required",
				status: "requested",
			},
		] as const;

		for (const invalidRow of invalidRows) {
			const id = randomUUID();
			const { error } = await serviceClient.from("reimbursements").insert({
				id,
				user_id: "00000000-0000-0000-0000-000000000011",
				amount: 5,
				date: "2026-09-06",
				department: "Makeathon",
				receipt_filename: "vivid.pdf",
				receipt_mime_type: "application/pdf",
				receipt_base64: "JVBERi0xLjQ=",
				approval_status: "pending",
				...invalidRow,
			});
			assert.strictEqual(
				error?.code,
				"23514",
				`expected constraint rejection for ${invalidRow.description}`,
			);
			if (!error) invalidIds.push(id);
		}
	} finally {
		await serviceClient
			.from("reimbursements")
			.delete()
			.in("id", [vividId, ...invalidIds]);
		await eligibleClient.auth.signOut();
		await regularClient.auth.signOut();
	}
});
