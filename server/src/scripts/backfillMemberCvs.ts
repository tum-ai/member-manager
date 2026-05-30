import { readdir, readFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join, resolve } from "node:path";
import { addCvVersion, getCurrentCv } from "../lib/memberCvs.js";
import { getSupabase } from "../lib/supabase.js";

// Backfill member_cvs version 1 from previously downloaded application CVs
// (see docs/member-cv-download.md). Each PDF is matched to a member by
// normalized full name, uploaded into the private bucket, and recorded as
// `source = application`. Idempotent: members who already have a CV are
// skipped. Dry-run by default; pass --apply to write.
//
// Usage:
//   tsx src/scripts/backfillMemberCvs.ts [cvDir] [--apply]
// Default cvDir is <repo>/data/cvs-active-members.

const DEFAULT_DIR = "data/cvs-active-members";

function normalizeName(first: string | null, last: string | null): string {
	return `${first ?? ""} ${last ?? ""}`
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
}

// Filenames are `First_Last.pdf` (possibly with a numeric dedupe suffix).
function nameKeyFromFilename(file: string): string {
	return basename(file, extname(file))
		.replace(/_\d+$/, "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
}

interface MemberNameRow {
	user_id: string;
	given_name: string | null;
	surname: string | null;
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const apply = args.includes("--apply");
	const positional = args.filter((a) => !a.startsWith("--"));
	const rawDir = positional[0] ?? DEFAULT_DIR;
	const cvDir = isAbsolute(rawDir)
		? rawDir
		: resolve(process.cwd(), "..", rawDir);

	const entries = (await readdir(cvDir)).filter(
		(f) => extname(f).toLowerCase() === ".pdf",
	);
	console.log(`Found ${entries.length} PDF(s) in ${cvDir}`);

	const { data, error } = await getSupabase()
		.from("members")
		.select("user_id, given_name, surname");
	if (error) {
		throw new Error(`Failed to load members: ${error.message}`);
	}
	const members = (data ?? []) as MemberNameRow[];

	// Build name -> user_ids. Collisions (same normalized name) are ambiguous.
	const byName = new Map<string, string[]>();
	for (const m of members) {
		const key = normalizeName(m.given_name, m.surname);
		if (!key) continue;
		const bucket = byName.get(key) ?? [];
		bucket.push(m.user_id);
		byName.set(key, bucket);
	}

	let inserted = 0;
	let skippedExisting = 0;
	const unmatched: string[] = [];
	const ambiguous: string[] = [];
	const failed: string[] = [];

	for (const file of entries) {
		const key = nameKeyFromFilename(file);
		const candidates = byName.get(key) ?? [];
		if (candidates.length === 0) {
			unmatched.push(file);
			continue;
		}
		if (candidates.length > 1) {
			ambiguous.push(file);
			continue;
		}
		const userId = candidates[0];

		// One bad file (oversized, corrupt PDF, upload hiccup) must not abort the
		// whole backfill. Record it and keep going; the run is idempotent so it
		// can be safely re-run after the file is fixed.
		try {
			const existing = await getCurrentCv(userId);
			if (existing) {
				skippedExisting += 1;
				continue;
			}

			if (!apply) {
				inserted += 1; // would insert
				continue;
			}

			const buffer = await readFile(join(cvDir, file));
			await addCvVersion({
				userId,
				buffer,
				originalFilename: file,
				source: "application",
				uploadedByUserId: null,
			});
			inserted += 1;
		} catch (error) {
			const reason = error instanceof Error ? error.message : "unknown error";
			failed.push(`${file}: ${reason}`);
		}
	}

	console.log(
		`${apply ? "Backfill" : "Dry run"}: ${apply ? "inserted" : "would insert"}=${inserted} skipped_existing=${skippedExisting} unmatched=${unmatched.length} ambiguous=${ambiguous.length} failed=${failed.length}`,
	);
	if (unmatched.length > 0) {
		console.log("Unmatched files (no member by name):");
		for (const f of unmatched) console.log(`  - ${f}`);
	}
	if (ambiguous.length > 0) {
		console.log("Ambiguous files (multiple members share the name):");
		for (const f of ambiguous) console.log(`  - ${f}`);
	}
	if (failed.length > 0) {
		console.log("Failed files (matched but not inserted):");
		for (const f of failed) console.log(`  - ${f}`);
	}
	if (!apply) {
		console.log("\nRe-run with --apply to write.");
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Unknown error");
	process.exitCode = 1;
});
