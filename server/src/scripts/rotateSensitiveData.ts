import { pathToFileURL } from "node:url";
import {
	encryptRecord,
	isEncryptedValue,
	reencryptRecord,
	SENSITIVE_MEMBER_FIELDS,
	SENSITIVE_REIMBURSEMENT_FIELDS,
	SENSITIVE_SEPA_FIELDS,
} from "../lib/sensitiveData.js";
import { verifySensitiveValue } from "../lib/sensitiveDataMaintenance.js";
import { getSupabase } from "../lib/supabase.js";
import {
	parseRotationOptions,
	type RotationOptions,
	requiresPrimaryVerification,
} from "./rotationOptions.js";

type RotationTarget = {
	table: "members" | "sepa" | "reimbursements";
	idField: "user_id" | "id";
	fields: readonly (
		| (typeof SENSITIVE_MEMBER_FIELDS)[number]
		| (typeof SENSITIVE_SEPA_FIELDS)[number]
		| (typeof SENSITIVE_REIMBURSEMENT_FIELDS)[number]
	)[];
};

type RotationStats = {
	scanned: number;
	candidates: number;
	updated: number;
	plaintextBefore: number;
};

const PAGE_SIZE = 250;

const ROTATION_TARGETS: RotationTarget[] = [
	{
		table: "members",
		idField: "user_id",
		fields: SENSITIVE_MEMBER_FIELDS,
	},
	{
		table: "sepa",
		idField: "user_id",
		fields: SENSITIVE_SEPA_FIELDS,
	},
	{
		table: "reimbursements",
		idField: "id",
		fields: SENSITIVE_REIMBURSEMENT_FIELDS,
	},
];

async function loadPage(
	target: RotationTarget,
	cursor?: string,
): Promise<Record<string, unknown>[]> {
	const supabase = getSupabase();
	const selectedFields = [target.idField, ...target.fields].join(", ");
	let query = supabase
		.from(target.table)
		.select(selectedFields)
		.order(target.idField, { ascending: true })
		.limit(PAGE_SIZE);
	if (cursor) {
		query = query.gt(target.idField, cursor);
	}
	const { data, error } = await query;

	if (error) {
		throw new Error(`Failed to load ${target.table}: ${error.message}`);
	}
	return (data || []) as unknown as Record<string, unknown>[];
}

function hasPlaintext(
	row: Record<string, unknown>,
	fields: RotationTarget["fields"],
): boolean {
	return fields.some((field) => {
		const value = row[field];
		return (
			typeof value === "string" && value !== "" && !isEncryptedValue(value)
		);
	});
}

function hasSensitiveValue(
	row: Record<string, unknown>,
	fields: RotationTarget["fields"],
): boolean {
	return fields.some((field) => {
		const value = row[field];
		return value !== null && value !== undefined && value !== "";
	});
}

async function updateWithCompareAndSwap(
	target: RotationTarget,
	row: Record<string, unknown>,
	updated: Record<string, unknown>,
): Promise<void> {
	const id = row[target.idField];
	if (typeof id !== "string") {
		throw new Error(`${target.table} row is missing ${target.idField}`);
	}

	const payload = Object.fromEntries(
		target.fields.map((field) => [field, updated[field]]),
	);
	let query = getSupabase()
		.from(target.table)
		.update(payload)
		.eq(target.idField, id);
	for (const field of target.fields) {
		const originalValue = row[field];
		query =
			originalValue === null
				? query.is(field, null)
				: query.eq(field, originalValue);
	}
	const { data, error } = await query.select(target.idField);
	if (error) {
		throw new Error(
			`Failed to update ${target.table} row ${id}: ${error.message}`,
		);
	}
	if (data?.length !== 1) {
		throw new Error(
			`Concurrent update detected for ${target.table} row ${id}; retry the command`,
		);
	}
}

async function rotateTarget(
	target: RotationTarget,
	options: RotationOptions,
): Promise<RotationStats> {
	const stats: RotationStats = {
		scanned: 0,
		candidates: 0,
		updated: 0,
		plaintextBefore: 0,
	};
	let cursor: string | undefined;

	while (true) {
		const rows = await loadPage(target, cursor);
		if (rows.length === 0) break;

		for (const row of rows) {
			const id = row[target.idField];
			if (typeof id !== "string") {
				throw new Error(`${target.table} row is missing ${target.idField}`);
			}
			cursor = id;
			stats.scanned += 1;

			const plaintext = hasPlaintext(row, target.fields);
			if (plaintext) stats.plaintextBefore += 1;
			const candidate =
				hasSensitiveValue(row, target.fields) &&
				(!options.plaintextOnly || plaintext);
			if (!candidate) continue;

			stats.candidates += 1;
			const updated = options.plaintextOnly
				? encryptRecord(row, target.fields)
				: reencryptRecord(row, target.fields);
			if (!options.apply) continue;

			await updateWithCompareAndSwap(target, row, updated);
			stats.updated += 1;
		}

		if (rows.length < PAGE_SIZE) break;
	}

	return stats;
}

async function verifyTarget(
	target: RotationTarget,
	{ primaryOnly }: { primaryOnly: boolean },
): Promise<void> {
	let cursor: string | undefined;
	while (true) {
		const rows = await loadPage(target, cursor);
		if (rows.length === 0) break;

		for (const row of rows) {
			const id = row[target.idField];
			if (typeof id !== "string") {
				throw new Error(`${target.table} row is missing ${target.idField}`);
			}
			cursor = id;
			for (const field of target.fields) {
				try {
					verifySensitiveValue(row[field], { primaryOnly });
				} catch (error) {
					throw new Error(
						`Verification failed for ${target.table}.${field} in row ${id}`,
						{ cause: error },
					);
				}
			}
		}

		if (rows.length < PAGE_SIZE) break;
	}
}

export async function runSensitiveDataMaintenance(
	options: RotationOptions,
): Promise<string[]> {
	const results: string[] = [];
	for (const target of ROTATION_TARGETS) {
		const stats = await rotateTarget(target, options);
		results.push(
			`${target.table}:scanned=${stats.scanned},candidates=${stats.candidates},updated=${stats.updated},plaintextBefore=${stats.plaintextBefore}`,
		);
	}
	if (options.apply) {
		for (const target of ROTATION_TARGETS) {
			await verifyTarget(target, {
				primaryOnly: requiresPrimaryVerification(options),
			});
		}
	}
	return results;
}

async function main(): Promise<void> {
	const options = parseRotationOptions(process.argv.slice(2));
	const results = await runSensitiveDataMaintenance(options);
	console.log(
		`${options.apply ? "Encryption maintenance complete" : "Dry run only; pass --apply to write"}. ${results.join(" ")}`,
	);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(message);
		process.exitCode = 1;
	});
}
