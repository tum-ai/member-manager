#!/usr/bin/env node
// Download member CV files referenced from a TUM.ai membership-application
// submissions CSV. The "CV (preferably without picture)" column holds
// Tally storage URLs whose access tokens expire, so run this soon after the
// CSV export. Output lands in `data/cvs/` (gitignored), named per member.
//
// Two modes:
//
//   1. All completed submissions (default):
//        node scripts/download-member-cvs.mjs <submissions.csv> [outDir]
//      Downloads a CV for every (non-test) row in the CSV.
//
//   2. Active members only (--active-members):
//        node scripts/download-member-cvs.mjs <submissions.csv> [outDir] \
//          --active-members
//      Reads active members from the prod Supabase `members` table
//      (member_status = 'active') using the service role from server/.env,
//      then downloads only the CVs of CSV rows that match an active member.
//      Matching is by email first, then normalized full name.
//
// Re-running skips files that already exist unless --force is passed.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Older Tally exports name the CV column "CV"; newer ones use the longer
// label. Check both, preferring the explicit longer one when present.
const CV_COLUMNS = ["CV (preferably without picture)", "CV"];
const FIRST_NAME_COLUMN = "First Name";
const LAST_NAME_COLUMN = "Last Name";
const EMAIL_COLUMN = "Email";
const DEFAULT_OUT_DIR = "data/cvs";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_CONCURRENCY = 6;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_ENV_PATH = join(REPO_ROOT, "server", ".env");

// RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, and
// newlines inside quoted values (the essay answers contain plenty).
export function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = "";
	let inQuotes = false;
	let i = 0;
	const pushField = () => {
		row.push(field);
		field = "";
	};
	const pushRow = () => {
		pushField();
		rows.push(row);
		row = [];
	};

	// Strip a leading UTF-8 BOM if present.
	if (text.charCodeAt(0) === 0xfeff) {
		i = 1;
	}

	for (; i < text.length; i++) {
		const char = text[i];
		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
		} else if (char === ",") {
			pushField();
		} else if (char === "\r") {
			if (text[i + 1] === "\n") {
				i++;
			}
			pushRow();
		} else if (char === "\n") {
			pushRow();
		} else {
			field += char;
		}
	}

	// Flush trailing field/row unless the file ended on a clean newline.
	if (field.length > 0 || row.length > 0) {
		pushRow();
	}

	return rows;
}

export function rowsToRecords(rows) {
	if (rows.length === 0) {
		return [];
	}
	const header = rows[0];
	return rows.slice(1).map((cells) => {
		const record = {};
		for (let i = 0; i < header.length; i++) {
			record[header[i]] = cells[i] ?? "";
		}
		return record;
	});
}

export function isTestRecord(record) {
	const first = (record[FIRST_NAME_COLUMN] || "").toLowerCase();
	const last = (record[LAST_NAME_COLUMN] || "").toLowerCase();
	const email = (record[EMAIL_COLUMN] || "").toLowerCase();
	return (
		/\btest\b/.test(first) ||
		/\btest\b/.test(last) ||
		email === "test@test.de" ||
		email.startsWith("test@")
	);
}

export function sanitizeNamePart(value) {
	return (value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "") // strip combining accents
		.replace(/[^A-Za-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

// Normalized join key for matching a DB member to a CSV row by full name.
// Same approach as the LinkedIn import: lowercase, strip diacritics, drop all
// non-alphanumerics so "Aziret Ashyrbai uulu" == "azíret  ashyrbaiuulu".
export function normalizeName(first, last) {
	return `${first || ""} ${last || ""}`
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
}

export function normalizeEmail(email) {
	return (email || "").trim().toLowerCase();
}

export function extensionFromUrl(url) {
	try {
		const { pathname } = new URL(url);
		const ext = extname(pathname).toLowerCase();
		return ext || ".pdf";
	} catch {
		return ".pdf";
	}
}

export function getCvUrl(record) {
	for (const column of CV_COLUMNS) {
		const value = (record[column] || "").trim();
		if (value) {
			return value;
		}
	}
	return "";
}

// Build collision-free `FirstName_LastName` base names. Duplicate names get a
// numeric suffix so we never silently overwrite one member with another.
export function buildFileNames(records) {
	const counts = new Map();
	const seen = new Map();
	for (const record of records) {
		const first = sanitizeNamePart(record[FIRST_NAME_COLUMN]) || "Unknown";
		const last = sanitizeNamePart(record[LAST_NAME_COLUMN]) || "Member";
		const base = `${first}_${last}`;
		counts.set(base, (counts.get(base) ?? 0) + 1);
	}
	const result = [];
	for (const record of records) {
		const first = sanitizeNamePart(record[FIRST_NAME_COLUMN]) || "Unknown";
		const last = sanitizeNamePart(record[LAST_NAME_COLUMN]) || "Member";
		let base = `${first}_${last}`;
		if (counts.get(base) > 1) {
			const n = (seen.get(base) ?? 0) + 1;
			seen.set(base, n);
			base = `${base}_${n}`;
		}
		const ext = extensionFromUrl(getCvUrl(record));
		result.push({ record, base, ext, fileName: `${base}${ext}` });
	}
	return result;
}

// Parse a minimal KEY=VALUE env file (server/.env). No interpolation, values
// may contain '=' (JWTs do), so split only on the first one.
export function parseEnvFile(text) {
	const env = {};
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}
		const eq = trimmed.indexOf("=");
		if (eq === -1) {
			continue;
		}
		env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
	}
	return env;
}

// Read active members from prod Supabase. Emails live on `auth.users` (not the
// `members` table), so we map user_id -> email via the auth admin API.
export async function loadActiveMembers() {
	const { createRequire } = await import("node:module");
	const require = createRequire(pathToFileURL(`${SERVER_ENV_PATH}`));
	let createClient;
	try {
		({ createClient } = require("@supabase/supabase-js"));
	} catch (error) {
		throw new Error(
			`Could not load @supabase/supabase-js from the server workspace. Run \`pnpm install\` first.\n${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}

	const env = parseEnvFile(await readFile(SERVER_ENV_PATH, "utf8"));
	const url = env.SUPABASE_URL;
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) {
		throw new Error(
			`Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${SERVER_ENV_PATH}`,
		);
	}

	const supabase = createClient(url, key, { auth: { persistSession: false } });

	const { data: members, error: membersError } = await supabase
		.from("members")
		.select("user_id,given_name,surname,member_status")
		.eq("member_status", "active");
	if (membersError) {
		throw new Error(`Failed to read active members: ${membersError.message}`);
	}

	const emailByUserId = new Map();
	for (let page = 1; ; page++) {
		const { data, error } = await supabase.auth.admin.listUsers({
			page,
			perPage: 1000,
		});
		if (error) {
			throw new Error(`Failed to list auth users: ${error.message}`);
		}
		const users = data?.users ?? [];
		for (const user of users) {
			if (user.email) {
				emailByUserId.set(user.id, user.email);
			}
		}
		if (users.length < 1000) {
			break;
		}
	}

	return members.map((member) => ({
		userId: member.user_id,
		givenName: member.given_name,
		surname: member.surname,
		email: emailByUserId.get(member.user_id) || "",
	}));
}

// Match active members to CSV rows. Prefer email; fall back to normalized full
// name. Returns matched records (CSV rows tagged with the member + matchedBy)
// plus diagnostics for unmatched members.
export function matchActiveMembersToRecords(members, records) {
	const byEmail = new Map();
	const byName = new Map();
	for (const record of records) {
		const email = normalizeEmail(record[EMAIL_COLUMN]);
		if (email && !byEmail.has(email)) {
			byEmail.set(email, record);
		}
		const name = normalizeName(
			record[FIRST_NAME_COLUMN],
			record[LAST_NAME_COLUMN],
		);
		if (name) {
			const bucket = byName.get(name) ?? [];
			bucket.push(record);
			byName.set(name, bucket);
		}
	}

	const matched = [];
	const unmatched = [];
	const ambiguous = [];
	const usedRecords = new Set();

	for (const member of members) {
		const email = normalizeEmail(member.email);
		let record = email ? byEmail.get(email) : undefined;
		let matchedBy = "email";

		if (!record) {
			const name = normalizeName(member.givenName, member.surname);
			const bucket = byName.get(name) ?? [];
			if (bucket.length === 1) {
				record = bucket[0];
				matchedBy = "name";
			} else if (bucket.length > 1) {
				ambiguous.push(member);
				continue;
			}
		}

		if (!record) {
			unmatched.push(member);
			continue;
		}
		if (usedRecords.has(record)) {
			continue;
		}
		usedRecords.add(record);
		matched.push({ record, member, matchedBy });
	}

	return { matched, unmatched, ambiguous };
}

async function downloadOne(entry, outDir, { force }) {
	const url = getCvUrl(entry.record);
	const dest = join(outDir, entry.fileName);
	if (!url) {
		return { ...entry, status: "skipped", reason: "no CV url" };
	}
	if (!force && existsSync(dest)) {
		return { ...entry, status: "exists", dest };
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) {
			return {
				...entry,
				status: "failed",
				reason: `HTTP ${response.status}`,
			};
		}
		const buffer = Buffer.from(await response.arrayBuffer());
		await writeFile(dest, buffer);
		return { ...entry, status: "ok", dest, bytes: buffer.length };
	} catch (error) {
		const reason =
			error?.name === "AbortError"
				? "timeout"
				: error instanceof Error
					? error.message
					: String(error);
		return { ...entry, status: "failed", reason };
	} finally {
		clearTimeout(timeout);
	}
}

async function runPool(entries, worker, concurrency) {
	const results = new Array(entries.length);
	let cursor = 0;
	const runners = Array.from(
		{ length: Math.min(concurrency, entries.length) },
		async () => {
			while (cursor < entries.length) {
				const index = cursor++;
				results[index] = await worker(entries[index]);
			}
		},
	);
	await Promise.all(runners);
	return results;
}

async function downloadEntries(entries, outDir, options) {
	await mkdir(outDir, { recursive: true });
	return runPool(
		entries,
		(entry) => downloadOne(entry, outDir, options),
		options.concurrency ?? MAX_CONCURRENCY,
	);
}

export async function downloadMemberCvs(csvPath, outDir, options = {}) {
	const text = await readFile(csvPath, "utf8");
	const records = rowsToRecords(parseCsv(text));
	const active = records.filter((record) => {
		if (isTestRecord(record)) {
			return false;
		}
		return Boolean(getCvUrl(record));
	});
	const testCount = records.length - active.length;
	const entries = buildFileNames(active);

	const results = await downloadEntries(entries, outDir, options);

	return {
		mode: "all-submissions",
		total: records.length,
		testCount,
		attempted: entries.length,
		results,
	};
}

// Read and pool records from one or more CSVs. When the same person (by email)
// appears in several exports, the later CSV in the list wins, since the caller
// passes newer exports last.
export async function poolRecords(csvPaths) {
	const all = [];
	for (const csvPath of csvPaths) {
		const text = await readFile(csvPath, "utf8");
		for (const record of rowsToRecords(parseCsv(text))) {
			all.push(record);
		}
	}
	const byEmail = new Map();
	const withoutEmail = [];
	for (const record of all) {
		const email = normalizeEmail(record[EMAIL_COLUMN]);
		if (email) {
			byEmail.set(email, record);
		} else {
			withoutEmail.push(record);
		}
	}
	return [...byEmail.values(), ...withoutEmail];
}

export async function downloadActiveMemberCvs(csvPaths, outDir, options = {}) {
	const paths = Array.isArray(csvPaths) ? csvPaths : [csvPaths];
	const records = await poolRecords(paths);
	const members = await loadActiveMembers();
	const { matched, unmatched, ambiguous } = matchActiveMembersToRecords(
		members,
		records,
	);

	const withCv = matched.filter((m) => {
		const cv = getCvUrl(m.record);
		if (!cv) {
			return false;
		}
		// Active-members mode is PDF-only: skip stray image/doc uploads.
		return extensionFromUrl(cv) === ".pdf";
	});
	const skippedNonPdf = matched.filter((m) => {
		const cv = getCvUrl(m.record);
		return cv && extensionFromUrl(cv) !== ".pdf";
	});

	const entries = buildFileNames(withCv.map((m) => m.record)).map(
		(entry, i) => ({
			...entry,
			member: withCv[i].member,
			matchedBy: withCv[i].matchedBy,
		}),
	);

	const results = await downloadEntries(entries, outDir, options);

	return {
		mode: "active-members",
		csvCount: paths.length,
		activeMembers: members.length,
		matched: matched.length,
		matchedByName: matched.filter((m) => m.matchedBy === "name").length,
		skippedNonPdf,
		unmatched,
		ambiguous,
		attempted: entries.length,
		results,
	};
}

function summarize(summary) {
	const byStatus = new Map();
	for (const r of summary.results) {
		byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
	}
	const lines = [];
	if (summary.mode === "active-members") {
		lines.push(`Active members (DB):   ${summary.activeMembers}`);
		lines.push(
			`Matched to CSV row:    ${summary.matched} (by name: ${summary.matchedByName})`,
		);
		lines.push(`Attempted downloads:   ${summary.attempted}`);
	} else {
		lines.push(`Records in CSV:        ${summary.total}`);
		lines.push(`Skipped (test/no CV):  ${summary.testCount}`);
		lines.push(`Attempted downloads:   ${summary.attempted}`);
	}
	for (const [status, count] of byStatus) {
		lines.push(`  ${status}: ${count}`);
	}

	if (summary.mode === "active-members") {
		if (summary.unmatched.length > 0) {
			lines.push(
				"",
				`Active members with NO matching CSV row (${summary.unmatched.length}):`,
			);
			for (const m of summary.unmatched) {
				lines.push(
					`  - ${m.givenName} ${m.surname} (${m.email || "no email"})`,
				);
			}
		}
		if (summary.ambiguous.length > 0) {
			lines.push(
				"",
				`Ambiguous name matches, skipped (${summary.ambiguous.length}):`,
			);
			for (const m of summary.ambiguous) {
				lines.push(
					`  - ${m.givenName} ${m.surname} (${m.email || "no email"})`,
				);
			}
		}
		if (summary.skippedNonPdf.length > 0) {
			lines.push(
				"",
				`Matched but skipped (non-PDF upload) (${summary.skippedNonPdf.length}):`,
			);
			for (const m of summary.skippedNonPdf) {
				lines.push(
					`  - ${m.member.givenName} ${m.member.surname} (${m.member.email || "no email"}): ${extensionFromUrl(getCvUrl(m.record))}`,
				);
			}
		}
	}

	if (summary.mode !== "active-members") {
		const nonPdf = summary.results.filter(
			(r) => (r.status === "ok" || r.status === "exists") && r.ext !== ".pdf",
		);
		if (nonPdf.length > 0) {
			lines.push("", "Non-PDF CVs (review these):");
			for (const r of nonPdf) {
				lines.push(
					`  - ${r.fileName} (${r.record[EMAIL_COLUMN] || "no email"})`,
				);
			}
		}
	}

	const failed = summary.results.filter((r) => r.status === "failed");
	if (failed.length > 0) {
		lines.push("", "Failed downloads:");
		for (const r of failed) {
			lines.push(
				`  - ${r.base} (${r.record[EMAIL_COLUMN] || "no email"}): ${r.reason}`,
			);
		}
	}

	return lines.join("\n");
}

// Pull `--out <dir>` out of argv, returning [outDir, remainingArgs].
function extractOutFlag(args) {
	const out = [];
	let outDir;
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--out") {
			outDir = args[i + 1];
			i++;
		} else if (args[i].startsWith("--out=")) {
			outDir = args[i].slice("--out=".length);
		} else {
			out.push(args[i]);
		}
	}
	return [outDir, out];
}

const USAGE = [
	"Usage:",
	"  node scripts/download-member-cvs.mjs <submissions.csv> [--out <dir>] [--force]",
	"  node scripts/download-member-cvs.mjs <csv> [<csv> ...] --active-members [--out <dir>] [--force]",
	"",
	"Default --out is data/cvs (all submissions) or data/cvs-active-members (--active-members).",
	"In --active-members mode you may pass several CSVs (e.g. multiple semester exports);",
	"rows are pooled by email and only active members (prod member_status='active') are downloaded.",
].join("\n");

async function main() {
	const [outFlag, rest] = extractOutFlag(process.argv.slice(2));
	const force = rest.includes("--force");
	const activeMembers = rest.includes("--active-members");
	const csvPaths = rest
		.filter((a) => !a.startsWith("--"))
		.map((p) => resolve(p));

	if (csvPaths.length === 0) {
		console.error(USAGE);
		process.exitCode = 1;
		return;
	}

	const defaultOut = activeMembers
		? "data/cvs-active-members"
		: DEFAULT_OUT_DIR;
	const outDir = resolve(outFlag || defaultOut);

	const summary = activeMembers
		? await downloadActiveMemberCvs(csvPaths, outDir, { force })
		: await downloadMemberCvs(csvPaths[0], outDir, { force });
	console.log(summarize(summary));
	console.log(`\nCVs written to: ${outDir}`);

	if (summary.results.some((r) => r.status === "failed")) {
		process.exitCode = 1;
	}
}

const invokedAsScript =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
