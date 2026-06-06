#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ANSI_PATTERN = new RegExp(String.raw`\x1B\[[0-?]*[ -/]*[@-~]`, "g");
const MIGRATION_ID_PATTERN = /^\d{14}$/;

export function parseSupabaseMigrationList(output) {
	const missingRemote = [];
	const missingLocal = [];
	const mismatchedRows = [];

	for (const line of output.replace(ANSI_PATTERN, "").split(/\r?\n/)) {
		if (!line.includes("|")) {
			continue;
		}

		const parts = line.split("|");
		if (parts.length < 3) {
			continue;
		}

		const local = parts[0].trim();
		const remote = parts[1].trim();
		const hasLocal = MIGRATION_ID_PATTERN.test(local);
		const hasRemote = MIGRATION_ID_PATTERN.test(remote);

		if (!hasLocal && !hasRemote) {
			continue;
		}

		if (hasLocal && !hasRemote) {
			missingRemote.push(local);
			continue;
		}

		if (!hasLocal && hasRemote) {
			missingLocal.push(remote);
			continue;
		}

		if (local !== remote) {
			mismatchedRows.push({ local, remote });
		}
	}

	return { missingRemote, missingLocal, mismatchedRows };
}

export function formatMigrationDrift(drift) {
	const lines = [];

	if (drift.missingRemote.length > 0) {
		lines.push(
			"Local migrations missing on linked Supabase project:",
			...drift.missingRemote.map((id) => `  - ${id}`),
		);
	}

	if (drift.missingLocal.length > 0) {
		lines.push(
			"Remote migrations missing from this checkout:",
			...drift.missingLocal.map((id) => `  - ${id}`),
		);
	}

	if (drift.mismatchedRows.length > 0) {
		lines.push(
			"Mismatched local/remote migration rows:",
			...drift.mismatchedRows.map(
				({ local, remote }) => `  - local ${local} != remote ${remote}`,
			),
		);
	}

	return lines.join("\n");
}

export function getBlockingMigrationDrift(
	drift,
	{ allowPendingProduction = false } = {},
) {
	return {
		missingRemote: allowPendingProduction ? [] : drift.missingRemote,
		missingLocal: drift.missingLocal,
		mismatchedRows: drift.mismatchedRows,
	};
}

function hasMigrationDrift(drift) {
	return (
		drift.missingRemote.length > 0 ||
		drift.missingLocal.length > 0 ||
		drift.mismatchedRows.length > 0
	);
}

function formatMigrationDriftAction(drift) {
	if (drift.missingLocal.length > 0 || drift.mismatchedRows.length > 0) {
		return "Production migration history does not match this checkout. Restore the missing migration files or repair the linked project's migration history before deploying.";
	}

	return "Run `supabase db push` against the production project before deploying app code that depends on these migrations.";
}

export function checkSupabaseMigrations(options = {}) {
	let output;
	try {
		output = execFileSync("supabase", ["migration", "list", "--linked"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch (error) {
		const stdout = error.stdout ? String(error.stdout) : "";
		const stderr = error.stderr ? String(error.stderr) : "";
		throw new Error(
			[
				"Failed to list linked Supabase migrations.",
				stdout.trim(),
				stderr.trim(),
			]
				.filter(Boolean)
				.join("\n"),
		);
	}

	const drift = parseSupabaseMigrationList(output);
	const blockingDrift = getBlockingMigrationDrift(drift, options);
	if (hasMigrationDrift(blockingDrift)) {
		throw new Error(
			`${formatMigrationDrift(blockingDrift)}\n\n${formatMigrationDriftAction(blockingDrift)}`,
		);
	}

	return drift;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const allowPendingProduction = process.argv.includes(
			"--allow-pending-production",
		);
		const drift = checkSupabaseMigrations({ allowPendingProduction });
		if (allowPendingProduction && drift.missingRemote.length > 0) {
			console.warn(
				[
					"Pending local migrations have not been applied to the linked Supabase project yet:",
					...drift.missingRemote.map((id) => `  - ${id}`),
					"",
					"`supabase db push` will apply them during the production release job.",
				].join("\n"),
			);
			console.log("Linked Supabase migrations have no blocking drift.");
		} else {
			console.log("Linked Supabase migrations match this checkout.");
		}
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
