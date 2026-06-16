// Post-processing for `pnpm db:pull`: runs AFTER a remote snapshot has been
// loaded into the LOCAL Supabase Docker database. Two jobs:
//
//   1. Sanitize encrypted/banking fields. The pulled rows still hold ciphertext
//      produced with the PRODUCTION FIELD_ENCRYPTION_KEY, which the local server
//      cannot decrypt. We overwrite those columns with harmless placeholders
//      re-encrypted under the LOCAL key, so no real DOB/address/IBAN ever rests
//      on the dev machine and the app's decrypt-on-read path keeps working
//      (including the strict `decryptRecord` paths in admin.ts).
//
//   2. Re-create the local login users (admin@example.com / user@example.com,
//      password `password123`) that the synthetic seed normally provides, since
//      the pull replaces all auth.users rows with real members. This keeps the
//      existing `/members/bootstrap-local-admin` dev flow working.
//
// SAFETY: this script WRITES. It refuses to run unless SUPABASE_URL points at a
// loopback host, so it can never mutate a remote/production project even if
// server/.env is misconfigured.

import {
	encryptValue,
	SENSITIVE_MEMBER_FIELDS,
	SENSITIVE_REIMBURSEMENT_FIELDS,
	SENSITIVE_SEPA_FIELDS,
} from "../lib/sensitiveData.js";
import { getSupabase } from "../lib/supabase.js";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const LOCAL_LOGIN_USERS = [
	{ email: "admin@example.com", password: "password123" },
	{ email: "user@example.com", password: "password123" },
];

// Readable, obviously-fake placeholders. Encrypted with the LOCAL key before
// they are written, so they round-trip through decrypt-on-read like real data.
const MEMBER_PLACEHOLDERS: Record<string, string> = {
	date_of_birth: "2000-01-01",
	street: "Redacted",
	number: "0",
	postal_code: "00000",
	city: "Redacted",
	country: "DE",
	phone: "+000000000",
};
const SEPA_PLACEHOLDERS: Record<string, string> = {
	iban: "DE00000000000000000000",
	bic: "XXXXXXXX",
	bank_name: "Redacted Bank",
};
const REIMBURSEMENT_PLACEHOLDERS: Record<string, string> = {
	payment_iban: "DE00000000000000000000",
	payment_bic: "XXXXXXXX",
};

function assertLocalTarget(): void {
	const url = process.env.SUPABASE_URL;
	if (!url) {
		throw new Error("Missing SUPABASE_URL — run `pnpm setup:local` first.");
	}
	let host: string;
	try {
		host = new URL(url).hostname;
	} catch {
		throw new Error(`SUPABASE_URL is not a valid URL: ${url}`);
	}
	if (!LOCAL_HOSTS.has(host)) {
		throw new Error(
			`Refusing to run: SUPABASE_URL points at "${host}", not a local host. ` +
				"prepareLocalDb only ever writes to the local Supabase stack.",
		);
	}
}

// Build a patch that sets every sensitive column to its encrypted placeholder.
// Reusing one ciphertext per column across rows is fine — it is dummy data.
function encryptedPatch(
	placeholders: Record<string, string>,
	fields: readonly string[],
): Record<string, unknown> {
	const patch: Record<string, unknown> = {};
	for (const field of fields) {
		patch[field] = encryptValue(placeholders[field] ?? "Redacted");
	}
	return patch;
}

async function scrubTable(
	table: string,
	placeholders: Record<string, string>,
	fields: readonly string[],
): Promise<void> {
	const supabase = getSupabase();
	const patch = encryptedPatch(placeholders, fields);
	// `user_id is not null` matches every row (user_id is the PK on these tables).
	const { error, count } = await supabase
		.from(table)
		.update(patch, { count: "exact" })
		.not("user_id", "is", null);
	if (error) {
		console.warn(`  ! skipped ${table}: ${error.message}`);
		return;
	}
	console.log(`  scrubbed ${table}: ${count ?? "?"} rows`);
}

async function findUserIdByEmail(email: string): Promise<string | null> {
	const supabase = getSupabase();
	for (let page = 1; ; page++) {
		const { data, error } = await supabase.auth.admin.listUsers({
			page,
			perPage: 1000,
		});
		if (error) return null;
		const users = data?.users ?? [];
		const match = users.find((u) => u.email === email);
		if (match) return match.id;
		if (users.length < 1000) return null;
	}
}

// Create the local login users and return their ids. Their member rows (made by
// the on_auth_user_created trigger) are removed afterwards so the directory
// shows only real members; logging in as admin re-creates the row via the
// existing bootstrap-local-admin flow.
async function ensureLoginUsers(): Promise<string[]> {
	const supabase = getSupabase();
	const ids: string[] = [];
	for (const { email, password } of LOCAL_LOGIN_USERS) {
		const { data, error } = await supabase.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
		});
		if (!error && data?.user) {
			console.log(`  created login user ${email}`);
			ids.push(data.user.id);
			continue;
		}
		if (error && /already|registered|exists/i.test(error.message)) {
			console.log(`  login user ${email} already exists`);
			const id = await findUserIdByEmail(email);
			if (id) ids.push(id);
		} else if (error) {
			console.warn(`  ! could not create ${email}: ${error.message}`);
		}
	}
	return ids;
}

async function removeLoginUserMembers(ids: string[]): Promise<void> {
	if (!ids.length) return;
	const supabase = getSupabase();
	const { error, count } = await supabase
		.from("members")
		.delete({ count: "exact" })
		.in("user_id", ids);
	if (error) {
		console.warn(
			`  ! could not remove login-user member rows: ${error.message}`,
		);
		return;
	}
	console.log(
		`  removed ${count ?? 0} login-user member row(s) from directory`,
	);
}

async function main(): Promise<void> {
	assertLocalTarget();
	console.log(`Preparing local DB at ${process.env.SUPABASE_URL}`);

	console.log("Sanitizing encrypted fields:");
	await scrubTable("members", MEMBER_PLACEHOLDERS, SENSITIVE_MEMBER_FIELDS);
	await scrubTable("sepa", SEPA_PLACEHOLDERS, SENSITIVE_SEPA_FIELDS);
	await scrubTable(
		"reimbursements",
		REIMBURSEMENT_PLACEHOLDERS,
		SENSITIVE_REIMBURSEMENT_FIELDS,
	);

	console.log("Ensuring local login users:");
	const loginUserIds = await ensureLoginUsers();
	await removeLoginUserMembers(loginUserIds);

	console.log("Local DB prepared.");
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
