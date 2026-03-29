import {
	encryptRecord,
	isEncryptedValue,
	SENSITIVE_MEMBER_FIELDS,
	SENSITIVE_SEPA_FIELDS,
} from "../lib/sensitiveData.js";
import { getSupabase } from "../lib/supabase.js";

function needsBackfill(
	record: Record<string, unknown>,
	fields: readonly string[],
): boolean {
	return fields.some((field) => {
		const value = record[field];
		return (
			typeof value === "string" && value !== "" && !isEncryptedValue(value)
		);
	});
}

async function backfillMembers(): Promise<number> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from("members")
		.select(
			"user_id, date_of_birth, street, number, postal_code, city, country, phone",
		);

	if (error) {
		throw new Error(`Failed to load members for backfill: ${error.message}`);
	}

	let updatedRows = 0;

	for (const member of data || []) {
		if (!needsBackfill(member, SENSITIVE_MEMBER_FIELDS)) {
			continue;
		}

		const encrypted = encryptRecord(member, SENSITIVE_MEMBER_FIELDS);
		const { error: updateError } = await supabase
			.from("members")
			.update(encrypted)
			.eq("user_id", member.user_id);

		if (updateError) {
			throw new Error(
				`Failed to backfill member ${member.user_id}: ${updateError.message}`,
			);
		}

		updatedRows += 1;
	}

	return updatedRows;
}

async function backfillSepa(): Promise<number> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from("sepa")
		.select("user_id, iban, bic, bank_name");

	if (error) {
		throw new Error(`Failed to load SEPA rows for backfill: ${error.message}`);
	}

	let updatedRows = 0;

	for (const sepa of data || []) {
		if (!needsBackfill(sepa, SENSITIVE_SEPA_FIELDS)) {
			continue;
		}

		const encrypted = encryptRecord(sepa, SENSITIVE_SEPA_FIELDS);
		const { error: updateError } = await supabase
			.from("sepa")
			.update(encrypted)
			.eq("user_id", sepa.user_id);

		if (updateError) {
			throw new Error(
				`Failed to backfill SEPA row ${sepa.user_id}: ${updateError.message}`,
			);
		}

		updatedRows += 1;
	}

	return updatedRows;
}

async function main(): Promise<void> {
	const updatedMembers = await backfillMembers();
	const updatedSepa = await backfillSepa();

	console.log(
		`Backfill complete. members=${updatedMembers} sepa=${updatedSepa}`,
	);
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : "Unknown error";
	console.error(message);
	process.exitCode = 1;
});
