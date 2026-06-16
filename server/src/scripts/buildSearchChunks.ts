// Beacon Layer-B builder. Regenerates `beacon_search_chunk` rows for members
// from their Layer-A claims (confirmed + pending — pending is searchable and
// labeled "unverified" when surfaced) plus headline/summary, embedding each
// chunk (OpenAI text-embedding-3-small) for hybrid search. Always
// full-regenerates a member's chunks (delete + insert) — Layer B is derived,
// never hand-edited. Shares `rebuildSearchChunks` with the on-mutation hook.
//
// No OPENAI_API_KEY → chunks are rebuilt with NULL embeddings (sparse/lexeme
// search still works); re-run with a key to backfill embeddings.
//
// Usage:
//   tsx src/scripts/buildSearchChunks.ts [--apply] [--user <uuid>] [--limit N]

import {
	getExpertiseProfile,
	rebuildSearchChunks,
	SEARCH_INDEX_STATUSES,
} from "../lib/beacon.js";
import {
	buildChunksForProfile,
	embeddingConfigured,
} from "../lib/searchChunks.js";
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

const CLAIM_TABLES = [
	"beacon_employment",
	"beacon_education",
	"beacon_person_skill",
	"beacon_person_project",
	"beacon_person_tag",
];

// Members who could have chunks: anyone with an indexed (confirmed or pending)
// claim or an editable headline/summary. Opted-out members are excluded later.
async function candidateUserIds(): Promise<string[]> {
	const supabase = getSupabase();
	const ids = new Set<string>();
	for (const table of CLAIM_TABLES) {
		const { data } = await supabase
			.from(table)
			.select("user_id")
			.in("status", SEARCH_INDEX_STATUSES);
		for (const r of (data ?? []) as { user_id: string }[]) ids.add(r.user_id);
	}
	const { data: persons } = await supabase
		.from("beacon_person")
		.select("user_id, headline, summary, opted_out");
	for (const p of (persons ?? []) as {
		user_id: string;
		headline: string | null;
		summary: string | null;
		opted_out: boolean;
	}[]) {
		if (!p.opted_out && (p.headline || p.summary)) ids.add(p.user_id);
	}
	return [...ids];
}

async function main(): Promise<void> {
	const flags = parseFlags(process.argv.slice(2));
	console.log(
		`Beacon search-chunk build — ${flags.apply ? "APPLY" : "DRY RUN"} | embeddings: ${
			embeddingConfigured() ? "on" : "off (NULL)"
		}`,
	);

	let userIds = flags.user ? [flags.user] : await candidateUserIds();
	if (flags.limit) userIds = userIds.slice(0, flags.limit);
	console.log(`Candidate members: ${userIds.length}\n`);

	const totals = { members: 0, chunks: 0, embedded: 0, cleared: 0, errors: 0 };

	for (const userId of userIds) {
		try {
			if (!flags.apply) {
				// Preview only: build chunks in-memory, write nothing.
				const profile = await getExpertiseProfile(userId, {
					statuses: SEARCH_INDEX_STATUSES,
				});
				const optedOut = (profile?.person as { opted_out?: boolean } | null)
					?.opted_out;
				if (!profile || optedOut === true) {
					totals.cleared++;
					continue;
				}
				const chunks = buildChunksForProfile(profile);
				totals.members++;
				totals.chunks += chunks.length;
				console.log(`  ${userId}: would build ${chunks.length} chunk(s)`);
				continue;
			}

			const res = await rebuildSearchChunks(userId);
			if (res.cleared && res.chunks === 0) {
				totals.cleared++;
				continue;
			}
			totals.members++;
			totals.chunks += res.chunks;
			totals.embedded += res.embedded;
			console.log(`  ${userId}: ${res.chunks} chunk(s) rebuilt`);
		} catch (e) {
			totals.errors++;
			console.log(`  ✗ ${userId}: ${e instanceof Error ? e.message : e}`);
		}
	}

	console.log(
		`\n${flags.apply ? "Built" : "Dry run"} — members=${totals.members} ` +
			`chunks=${totals.chunks} embedded=${totals.embedded} cleared=${totals.cleared} errors=${totals.errors}`,
	);
	if (!flags.apply) console.log("Re-run with --apply to write.");
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
