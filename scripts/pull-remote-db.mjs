#!/usr/bin/env node
// Pull a READ-ONLY snapshot of the remote (production) Supabase into the LOCAL
// Supabase Docker stack, WITHOUT the database password — using the service-role
// key over the REST + Auth Admin APIs.
//
//   pnpm db:pull            # interactive confirm
//   pnpm db:pull --yes      # skip confirm
//
// Env (reads only; never commit):
//   BEACON_REMOTE_SUPABASE_URL       https://<ref>.supabase.co
//   BEACON_REMOTE_SERVICE_ROLE_KEY   service_role / secret key (Dashboard > API)
//   LOCAL_DB_URL                     optional, defaults to local Supabase DB
//
// REMOTE SAFETY — production is NEVER written to:
//   - The remote client is used ONLY for reads (`.select()`,
//     `auth.admin.listUsers()`). No write/RPC/delete calls are ever issued.
//   - No remote project setting is changed (no password reset, no link).
//   - Every destructive step targets LOCAL only and is gated to loopback:54322.
//
// Flow: read remote members + auth users/identities -> generate LOCAL load SQL
//       (mirrors supabase/seed.sql so real user_ids are preserved) -> reset
//       local schema -> truncate + load -> prepareLocalDb (sanitize + logins).
//
// Requires: supabase CLI, psql, pnpm, Docker (local stack running).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_DIR = join(REPO_ROOT, "server");
const REMOTE_DIR = join(REPO_ROOT, "supabase", ".remote");
const LOCAL_DB_URL_DEFAULT =
	"postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const LOCAL_DB_PORT = "54322";
const PAGE = 1000;

// Mirror supabase/seed.sql. The empty-string token columns avoid GoTrue's
// "converting NULL to string" crash on login.
const USER_COLS = [
	"id",
	"instance_id",
	"email",
	"encrypted_password",
	"email_confirmed_at",
	"created_at",
	"updated_at",
	"raw_app_meta_data",
	"raw_user_meta_data",
	"aud",
	"role",
	"confirmation_token",
	"recovery_token",
	"email_change_token_new",
	"email_change",
];
const IDENTITY_COLS = [
	"id",
	"user_id",
	"provider",
	"provider_id",
	"identity_data",
	"last_sign_in_at",
	"created_at",
	"updated_at",
];

// ---------------------------------------------------------------------------
// Pure, unit-tested helpers (no I/O)
// ---------------------------------------------------------------------------

export function assertRemoteApiUrlSafe(url) {
	if (!url) {
		throw new Error(
			"BEACON_REMOTE_SUPABASE_URL is not set. Set it to your remote project URL " +
				"(https://<ref>.supabase.co) from Supabase Dashboard.",
		);
	}
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error("BEACON_REMOTE_SUPABASE_URL is not a valid URL.");
	}
	const host = parsed.hostname.toLowerCase();
	if (LOCAL_HOSTS.has(host)) {
		throw new Error(
			`BEACON_REMOTE_SUPABASE_URL points at a local host ("${host}"). It must be ` +
				"the REMOTE/production project — refusing.",
		);
	}
	if (parsed.protocol !== "https:") {
		throw new Error("BEACON_REMOTE_SUPABASE_URL must use https.");
	}
	return parsed;
}

export function assertLocalUrlSafe(localUrl) {
	let parsed;
	try {
		parsed = new URL(localUrl);
	} catch {
		throw new Error("LOCAL_DB_URL is not a valid Postgres URL.");
	}
	const host = parsed.hostname.toLowerCase();
	const port = parsed.port || "5432";
	if (!LOCAL_HOSTS.has(host)) {
		throw new Error(
			`Refusing destructive ops: LOCAL_DB_URL host "${host}" is not loopback.`,
		);
	}
	if (port !== LOCAL_DB_PORT) {
		throw new Error(
			`Refusing destructive ops: LOCAL_DB_URL port "${port}" is not the local ` +
				`Supabase DB port (${LOCAL_DB_PORT}).`,
		);
	}
	return parsed;
}

// Serialize a JS value as a Postgres literal. Objects -> jsonb, strings are
// single-quote escaped (standard_conforming_strings).
export function sqlLiteral(value) {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	if (typeof value === "object") {
		return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
	}
	return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildUserInsert(users) {
	if (!users.length) return "";
	const rows = users.map((user) => {
		const values = [
			sqlLiteral(user.id),
			"'00000000-0000-0000-0000-000000000000'",
			sqlLiteral(user.email ?? null),
			// Real password hashes aren't exposed by the Admin API; give every
			// pulled user the dev password so you can log in as a real member.
			"extensions.crypt('password123', extensions.gen_salt('bf'))",
			user.email_confirmed_at ? sqlLiteral(user.email_confirmed_at) : "now()",
			user.created_at ? sqlLiteral(user.created_at) : "now()",
			user.updated_at ? sqlLiteral(user.updated_at) : "now()",
			sqlLiteral(user.app_metadata ?? {}),
			sqlLiteral(user.user_metadata ?? {}),
			"'authenticated'",
			"'authenticated'",
			"''",
			"''",
			"''",
			"''",
		];
		return `(${values.join(", ")})`;
	});
	return `INSERT INTO auth.users (${USER_COLS.join(", ")}) VALUES\n${rows.join(
		",\n",
	)}\nON CONFLICT (id) DO NOTHING;`;
}

export function buildIdentityInsert(users) {
	const rows = [];
	for (const user of users) {
		for (const identity of user.identities ?? []) {
			const providerId =
				identity.provider_id ??
				identity.id ??
				identity.identity_data?.sub ??
				user.id;
			const values = [
				"gen_random_uuid()",
				sqlLiteral(user.id),
				sqlLiteral(identity.provider ?? "email"),
				sqlLiteral(String(providerId)),
				sqlLiteral(identity.identity_data ?? {}),
				identity.last_sign_in_at
					? sqlLiteral(identity.last_sign_in_at)
					: "now()",
				identity.created_at ? sqlLiteral(identity.created_at) : "now()",
				identity.updated_at ? sqlLiteral(identity.updated_at) : "now()",
			];
			rows.push(`(${values.join(", ")})`);
		}
	}
	if (!rows.length) return "";
	return `INSERT INTO auth.identities (${IDENTITY_COLS.join(
		", ",
	)}) VALUES\n${rows.join(",\n")}\nON CONFLICT (provider, provider_id) DO NOTHING;`;
}

export function buildMemberInsert(members) {
	if (!members.length) return "";
	const cols = Object.keys(members[0]);
	const rows = members.map(
		(member) => `(${cols.map((col) => sqlLiteral(member[col])).join(", ")})`,
	);
	return `INSERT INTO public.members (${cols.join(", ")}) VALUES\n${rows.join(
		",\n",
	)}\nON CONFLICT (user_id) DO NOTHING;`;
}

// Infer a Postgres column type for a pulled column from its first non-null
// value (columns are uniform in a real schema). Used to add prod-only member
// columns (e.g. linkedin_id) to the local table so we keep their data.
export function inferPgType(members, col) {
	for (const member of members) {
		const value = member[col];
		if (value === null || value === undefined) continue;
		if (typeof value === "boolean") return "boolean";
		if (typeof value === "number") return "numeric";
		if (typeof value === "object") return "jsonb";
		return "text";
	}
	return "text";
}

// ALTER statements that add prod-only member columns to the local table.
export function buildAddColumnsSql(prodOnlyColumns, members) {
	if (!prodOnlyColumns.length) return "";
	return prodOnlyColumns
		.map(
			(col) =>
				`ALTER TABLE public.members ADD COLUMN IF NOT EXISTS "${col}" ${inferPgType(members, col)};`,
		)
		.join("\n");
}

export function buildLoadSql({ addColumns, users, identities, members }) {
	return [
		"-- Generated by scripts/pull-remote-db.mjs (no-password API pull). LOCAL only.",
		"SET session_replication_role = replica;", // disable FK/triggers during load
		addColumns, // add any prod-only member columns before loading
		// members has no FK to auth.users, so truncate it explicitly; CASCADE
		// then sweeps sepa/reimbursements/agreements/etc. that reference members.
		"TRUNCATE TABLE auth.users, public.members CASCADE;",
		users,
		identities,
		members,
		"SET session_replication_role = DEFAULT;",
		"",
	]
		.filter(Boolean)
		.join("\n\n");
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

function confirm(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((res) => {
		rl.question(question, (answer) => {
			rl.close();
			res(answer.trim().toLowerCase() === "yes");
		});
	});
}

function runSupabase(args, options = {}) {
	try {
		return execFileSync("supabase", args, {
			stdio: ["ignore", "inherit", "inherit"],
			...options,
		});
	} catch (error) {
		if (error && error.code === "ENOENT") {
			return execFileSync("npx", ["supabase", ...args], {
				stdio: ["ignore", "inherit", "inherit"],
				...options,
			});
		}
		throw error;
	}
}

// Column names of the LOCAL public.members table (after migrations), used to
// drop any prod-only columns from the pulled rows.
function getLocalMemberColumns(localUrl) {
	const out = execFileSync(
		"psql",
		[
			localUrl,
			"-Atc",
			"select column_name from information_schema.columns where table_schema='public' and table_name='members'",
		],
		{ encoding: "utf8" },
	);
	return out
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

function loadLocal(localUrl, file) {
	try {
		execFileSync("psql", [localUrl, "-v", "ON_ERROR_STOP=1", "-f", file], {
			stdio: ["ignore", "inherit", "inherit"],
		});
	} catch (error) {
		if (error && error.code === "ENOENT") {
			throw new Error(
				"`psql` not found on PATH. Install the Postgres client " +
					"(e.g. `brew install libpq` and add it to PATH) and retry.",
			);
		}
		throw error;
	}
}

// Load @supabase/supabase-js from the server workspace (same trick as
// scripts/download-member-cvs.mjs) so we don't add a root dependency.
function loadSupabaseFactory() {
	const require = createRequire(
		pathToFileURL(join(SERVER_DIR, "package.json")),
	);
	try {
		return require("@supabase/supabase-js").createClient;
	} catch (error) {
		throw new Error(
			"Could not load @supabase/supabase-js from the server workspace. Run " +
				`\`pnpm install\` first.\n${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

// The Admin `listUsers` response omits each user's identities, so fetch them
// per user (pooled). This is where the Slack provider_id (the per-member unique
// key Beacon anchors on) comes from. Reads only.
const IDENTITY_CONCURRENCY = 8;
async function enrichIdentities(remote, users) {
	const need = users.filter((u) => !u.identities?.length);
	if (!need.length) return;
	console.log(`  fetching identities for ${need.length} users...`);
	let cursor = 0;
	async function worker() {
		while (cursor < need.length) {
			const user = need[cursor++];
			const { data, error } = await remote.auth.admin.getUserById(user.id);
			if (!error && data?.user?.identities) {
				user.identities = data.user.identities;
			}
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(IDENTITY_CONCURRENCY, need.length) }, worker),
	);
}

async function readAllUsers(remote) {
	const users = [];
	for (let page = 1; ; page++) {
		const { data, error } = await remote.auth.admin.listUsers({
			page,
			perPage: PAGE,
		});
		if (error) throw new Error(`Remote listUsers failed: ${error.message}`);
		const batch = data?.users ?? [];
		users.push(...batch);
		if (batch.length < PAGE) break;
	}
	await enrichIdentities(remote, users);
	return users;
}

async function readAllMembers(remote) {
	const members = [];
	for (let from = 0; ; from += PAGE) {
		const { data, error } = await remote
			.from("members")
			.select("*")
			.range(from, from + PAGE - 1);
		if (error)
			throw new Error(`Remote members select failed: ${error.message}`);
		members.push(...(data ?? []));
		if (!data || data.length < PAGE) break;
	}
	return members;
}

async function main() {
	const args = process.argv.slice(2);
	const skipConfirm = args.includes("--yes");
	const skipReset = args.includes("--skip-reset");
	const keepDumps = args.includes("--keep-dumps");

	const localUrl = process.env.LOCAL_DB_URL || LOCAL_DB_URL_DEFAULT;
	const remoteUrl = process.env.BEACON_REMOTE_SUPABASE_URL;
	const remoteKey = process.env.BEACON_REMOTE_SERVICE_ROLE_KEY;

	const remote = assertRemoteApiUrlSafe(remoteUrl);
	if (!remoteKey) {
		throw new Error(
			"BEACON_REMOTE_SERVICE_ROLE_KEY is not set. Copy the service_role / secret " +
				"key from Supabase Dashboard > Project Settings > API.",
		);
	}
	assertLocalUrlSafe(localUrl);

	console.log("Pull remote Supabase -> local (no-password API pull)");
	console.log(`  remote (READ ONLY): ${remote.hostname}`);
	console.log(`  local  (REPLACED) : ${localUrl}`);

	if (!skipConfirm) {
		const ok = await confirm(
			`\nThis REPLACES member/auth data in your LOCAL Supabase (${LOCAL_DB_PORT}) with a ` +
				`read-only snapshot of ${remote.hostname}.\nThe remote is only ever READ. Type 'yes' to continue: `,
		);
		if (!ok) {
			console.log("Aborted.");
			return;
		}
	}

	try {
		runSupabase(["status"], {
			stdio: ["ignore", "ignore", "ignore"],
			cwd: REPO_ROOT,
		});
	} catch {
		throw new Error(
			"Local Supabase does not appear to be running. Start it with " +
				"`pnpm supabase:start` and retry.",
		);
	}

	// 1. Read remote (service-role; reads only).
	const createClient = loadSupabaseFactory();
	const remoteClient = createClient(remoteUrl, remoteKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	console.log("  reading remote auth users + identities...");
	const users = await readAllUsers(remoteClient);
	console.log("  reading remote members...");
	const members = await readAllMembers(remoteClient);
	const identityCount = users.reduce(
		(n, u) => n + (u.identities?.length ?? 0),
		0,
	);
	console.log(
		`  fetched ${users.length} users, ${identityCount} identities, ${members.length} members`,
	);

	// 2. Reset local schema first (re-applies migrations) so we can read the
	//    real local column set before generating SQL.
	assertLocalUrlSafe(localUrl);
	if (!skipReset) {
		console.log("  resetting local schema (supabase db reset)...");
		try {
			runSupabase(["db", "reset"], { cwd: REPO_ROOT });
		} catch (error) {
			// `supabase db reset` sometimes returns a 502 while restarting
			// containers AFTER migrations + seed have applied. If the schema is
			// actually present, treat the reset as done; otherwise re-throw.
			let schemaPresent = false;
			try {
				schemaPresent = getLocalMemberColumns(localUrl).length > 0;
			} catch {}
			if (!schemaPresent) throw error;
			console.warn(
				"  supabase db reset errored (likely a transient container restart); " +
					"schema is present, continuing.",
			);
		}
	}

	// 3. Generate the LOCAL load SQL. Keep all prod columns; add any that the
	//    local schema is missing (e.g. linkedin_id) with an inferred type.
	const localMemberColumns = new Set(getLocalMemberColumns(localUrl));
	const prodOnly = members.length
		? Object.keys(members[0]).filter((c) => !localMemberColumns.has(c))
		: [];
	if (prodOnly.length) {
		const described = prodOnly
			.map((c) => `${c} ${inferPgType(members, c)}`)
			.join(", ");
		console.log(`  members: adding prod-only column(s) to local: ${described}`);
	}
	mkdirSync(REMOTE_DIR, { recursive: true });
	const loadFile = join(REMOTE_DIR, "load.sql");
	writeFileSync(
		loadFile,
		buildLoadSql({
			addColumns: buildAddColumnsSql(prodOnly, members),
			users: buildUserInsert(users),
			identities: buildIdentityInsert(users),
			members: buildMemberInsert(members),
		}),
	);

	// 4. Load into LOCAL.
	console.log("  loading snapshot into local DB...");
	loadLocal(localUrl, loadFile);

	// 5. Refresh local env, then sanitize + ensure login users (LOCAL writes only).
	console.log("  refreshing local env (setup:local)...");
	execFileSync("node", [join(REPO_ROOT, "scripts", "setup-local-env.mjs")], {
		stdio: ["ignore", "inherit", "inherit"],
		cwd: REPO_ROOT,
	});
	console.log("  preparing local DB (sanitize + login users)...");
	execFileSync(
		"pnpm",
		[
			"--filter",
			"@member-manager/server",
			"exec",
			"tsx",
			"src/scripts/prepareLocalDb.ts",
		],
		{ stdio: ["ignore", "inherit", "inherit"], cwd: REPO_ROOT },
	);

	// 6. Remove the generated SQL (contains real data) unless asked to keep it.
	if (!keepDumps && existsSync(loadFile)) {
		rmSync(loadFile);
		console.log("  removed generated load.sql");
	}

	console.log(
		"\nDone. Start the app with `pnpm dev:local`. Log in as " +
			"admin@example.com / password123, or as any real member's email / password123.",
	);
}

const invokedAsScript =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
