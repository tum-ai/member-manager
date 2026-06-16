// Standalone, deterministic claim cleanup over EXISTING data: title-case
// organization/school names, then merge each member's near-duplicate
// employment/education rows. Shares its logic with the enrichment post-pass.
// Dry-run by default; pass --apply to write. Re-run `build:search-chunks`
// afterwards so the search index reflects the merged claims.
//
// Usage:
//   tsx src/scripts/consolidateClaims.ts [--apply] [--user <uuid>] [--limit N]

import {
	consolidateMemberClaims,
	titleCaseEntities,
} from "../lib/claimConsolidation.js";
import { getSupabase } from "../lib/supabase.js";

interface Flags {
	apply: boolean;
	user: string | null;
	limit: number | null;
}

function parseFlags(argv: string[]): Flags {
	const i = argv.indexOf("--limit");
	const u = argv.indexOf("--user");
	return {
		apply: argv.includes("--apply"),
		limit: i >= 0 ? Number(argv[i + 1]) : null,
		user: u >= 0 ? argv[u + 1] : null,
	};
}

async function candidateUserIds(): Promise<string[]> {
	const supabase = getSupabase();
	const ids = new Set<string>();
	for (const table of ["beacon_employment", "beacon_education"] as const) {
		const { data } = await supabase.from(table).select("user_id");
		for (const r of (data ?? []) as { user_id: string }[]) ids.add(r.user_id);
	}
	return [...ids];
}

async function main(): Promise<void> {
	const flags = parseFlags(process.argv.slice(2));
	console.log(
		`Beacon claim consolidation — ${flags.apply ? "APPLY" : "DRY RUN"}`,
	);

	const renamed = await titleCaseEntities({ apply: flags.apply });
	console.log(
		`Entity names title-cased: orgs=${renamed.organizations} schools=${renamed.schools}`,
	);

	let userIds = flags.user ? [flags.user] : await candidateUserIds();
	if (flags.limit) userIds = userIds.slice(0, flags.limit);
	console.log(`Candidate members: ${userIds.length}\n`);

	const totals = { members: 0, employment: 0, education: 0, errors: 0 };
	for (const userId of userIds) {
		try {
			const r = await consolidateMemberClaims(userId, { apply: flags.apply });
			if (r.employment + r.education > 0) {
				totals.members++;
				totals.employment += r.employment;
				totals.education += r.education;
				console.log(
					`  ${userId}: merged ${r.employment} employment, ${r.education} education`,
				);
			}
		} catch (e) {
			totals.errors++;
			console.log(`  ✗ ${userId}: ${e instanceof Error ? e.message : e}`);
		}
	}

	console.log(
		`\n${flags.apply ? "Done" : "Dry run"} — members=${totals.members} ` +
			`employmentMerged=${totals.employment} educationMerged=${totals.education} errors=${totals.errors}`,
	);
	if (!flags.apply) console.log("Re-run with --apply to write.");
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
