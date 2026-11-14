import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
	applyDevMcpChange,
	readDevMcpAccessRecord,
} from "../lib/devMcpAccess.js";
import { devMcpExportSchema, planDevMcpImport } from "../lib/devMcpImport.js";

// Imports dev-mcp's access list (its `members` and `member_tools` tables) into
// member-manager for the cutover (docs/deployment.md, "Dev MCP access"). Each
// dev-mcp member is matched to a member-manager account by Slack user ID
// (public.dev_mcp_access_for). Members who already have a row here are
// skipped unless --overwrite is passed. Every write goes through
// public.dev_mcp_apply_change, so it is logged in dev_mcp_access_events.
//
// Dry run by default; pass --apply to write. Always prints the Slack IDs
// that have no member-manager account: they lose dev-mcp access at the
// cutover unless they sign in to member-manager with Slack first.
//
// Export from dev-mcp's database (keep the file under /data, which is
// gitignored; it holds member names):
//   psql "$DEV_MCP_DATABASE_URL" -Atc "select json_build_object(
//     'members', (select coalesce(json_agg(m), '[]') from members m),
//     'member_tools', (select coalesce(json_agg(t), '[]') from member_tools t))" \
//     > data/dev-mcp-access.json
//
// Usage (from server/, with the target project's SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY in the environment):
//   pnpm import:dev-mcp-access ../data/dev-mcp-access.json [--apply] [--overwrite]

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const apply = args.includes("--apply");
	const overwrite = args.includes("--overwrite");
	const [rawPath] = args.filter((arg) => !arg.startsWith("--"));
	if (!rawPath) {
		throw new Error(
			"Usage: importDevMcpAccess.ts <export.json> [--apply] [--overwrite]",
		);
	}
	const path = isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
	const parsed = devMcpExportSchema.safeParse(
		JSON.parse(await readFile(path, "utf8")),
	);
	if (!parsed.success) {
		throw new Error(
			`${path} isn't a dev-mcp access export: ${parsed.error.issues[0]?.message}`,
		);
	}

	const plan = await planDevMcpImport(parsed.data, readDevMcpAccessRecord, {
		overwrite,
	});

	const failed: string[] = [];
	for (const item of plan.changes) {
		const { p_status, p_role, p_set_tools } = item.change;
		const summary = `${item.slackUserId} -> ${item.name ?? item.userId}: ${p_status}${p_role ? ` as ${p_role}` : ""}${p_set_tools?.length ? ` [${p_set_tools.join(", ")}]` : ""}`;
		if (!apply) {
			console.log(`  would import ${summary}`);
			continue;
		}
		try {
			await applyDevMcpChange(item.userId, null, "import", item.change);
			console.log(`  imported ${summary}`);
		} catch (error) {
			const reason = error instanceof Error ? error.message : "unknown error";
			failed.push(`${item.slackUserId}: ${reason}`);
		}
	}

	console.log(
		`${apply ? "Import" : "Dry run"}: ${apply ? "imported" : "would import"}=${plan.changes.length - failed.length} skipped_existing=${plan.skipped.length} unmapped=${plan.unmapped.length} failed=${failed.length}`,
	);
	if (plan.skipped.length > 0) {
		console.log("Already in member-manager (pass --overwrite to replace):");
		for (const row of plan.skipped) {
			console.log(`  - ${row.slackUserId} (${row.status})`);
		}
	}
	if (plan.unmapped.length > 0) {
		console.log(
			"Unmapped Slack IDs (no member-manager account with that Slack ID):",
		);
		for (const row of plan.unmapped) {
			console.log(
				`  - ${row.slackUserId} ${row.displayName ?? ""} (${row.status})`.trimEnd(),
			);
		}
	}
	if (failed.length > 0) {
		console.log("Failed:");
		for (const line of failed) console.log(`  - ${line}`);
		process.exitCode = 1;
	}
	if (!apply) {
		console.log("\nRe-run with --apply to write.");
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Unknown error");
	process.exitCode = 1;
});
