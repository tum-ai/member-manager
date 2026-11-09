import {
	DEV_MCP_ACCESS_ACTION_FROM,
	type DevMcpAccessAction,
	type DevMcpAccessEntry,
	type DevMcpAccessRecord,
	type DevMcpAccessStatus,
	type DevMcpCatalog,
	type DevMcpRole,
	devMcpAccessRecordSchema,
	devMcpPresetTools,
	devMcpRoleAtLeast,
	type OwnDevMcpAccess,
} from "@member-manager/shared";
import { getDevMcpCatalog } from "./devMcpCatalog.js";
import {
	ConflictError,
	DatabaseError,
	NotFoundError,
	ValidationError,
} from "./errors.js";
import { memberName, readMemberSummaries } from "./mcpAccess.js";
import { getSupabase } from "./supabase.js";

/**
 * dev-mcp (Dev Claude's MCP server) access per member, in
 * `public.dev_mcp_access` and `public.dev_mcp_tool_grants`. The rules are
 * ported from dev-mcp's `src/access/service.ts`:
 *
 * - approving (again) replaces the grants with the role's preset;
 * - a demotion drops grants the new role doesn't allow;
 * - grants above the role, or tools dev-mcp doesn't know, are rejected;
 * - nobody can remove the last active admin;
 * - every change writes a `dev_mcp_access_events` row in the same
 *   transaction.
 *
 * Which statuses an action applies to and which tools a role allows are
 * decided here (the catalog comes from dev-mcp); `public.dev_mcp_apply_change`
 * applies the change atomically and re-checks the status, the role and the
 * last-admin rule under a lock.
 */

interface DevMcpAccessRow {
	user_id: string;
	status: DevMcpAccessStatus;
	role: DevMcpRole | null;
	requested_at: string;
	decided_at: string | null;
	decided_by: string | null;
	decision_note: string | null;
	last_seen_at: string | null;
	last_client_id: string | null;
	last_client_name: string | null;
}

const ROW_COLUMNS =
	"user_id, status, role, requested_at, decided_at, decided_by, decision_note, last_seen_at, last_client_id, last_client_name";

/** Where an access change came from (`dev_mcp_access_events.source`). */
export type DevMcpChangeSource = "admin" | "import";

async function readGrants(userIds: string[]): Promise<Map<string, string[]>> {
	const grants = new Map<string, string[]>();
	if (userIds.length === 0) return grants;
	const { data, error } = await getSupabase()
		.from("dev_mcp_tool_grants")
		.select("user_id, tool")
		.in("user_id", userIds);
	if (error) throw new DatabaseError();
	for (const row of (data ?? []) as Array<{ user_id: string; tool: string }>) {
		grants.set(row.user_id, [...(grants.get(row.user_id) ?? []), row.tool]);
	}
	for (const tools of grants.values()) tools.sort();
	return grants;
}

async function toEntries(
	rows: DevMcpAccessRow[],
): Promise<DevMcpAccessEntry[]> {
	const ids = new Set<string>();
	for (const row of rows) {
		ids.add(row.user_id);
		if (row.decided_by) ids.add(row.decided_by);
	}
	const [members, grants] = await Promise.all([
		readMemberSummaries([...ids]),
		readGrants(
			rows.filter((row) => row.status === "active").map((row) => row.user_id),
		),
	]);
	return rows.map((row) => {
		const member = members.get(row.user_id);
		return {
			...row,
			role: row.status === "active" ? row.role : null,
			tools: row.status === "active" ? (grants.get(row.user_id) ?? []) : [],
			name: memberName(member) ?? "Unknown member",
			department: member?.department ?? null,
			member_status: member?.member_status ?? null,
			decided_by_name: row.decided_by
				? memberName(members.get(row.decided_by))
				: null,
		};
	});
}

async function readRow(userId: string): Promise<DevMcpAccessRow | null> {
	const { data, error } = await getSupabase()
		.from("dev_mcp_access")
		.select(ROW_COLUMNS)
		.eq("user_id", userId)
		.maybeSingle();
	if (error) throw new DatabaseError();
	return (data as DevMcpAccessRow | null) ?? null;
}

/** Every request, oldest first; the admin page groups them by status. */
export async function listDevMcpAccess(): Promise<DevMcpAccessEntry[]> {
	const { data, error } = await getSupabase()
		.from("dev_mcp_access")
		.select(ROW_COLUMNS)
		.order("requested_at", { ascending: true });
	if (error) throw new DatabaseError();
	return toEntries((data ?? []) as DevMcpAccessRow[]);
}

/** The parameters of `public.dev_mcp_apply_change`. */
export interface DevMcpChange {
	p_action:
		| "member_approved"
		| "member_updated"
		| "member_tools_set"
		| "member_imported";
	p_from_statuses: Array<DevMcpAccessStatus | "none">;
	p_expected_role: DevMcpRole | null;
	p_status: DevMcpAccessStatus;
	p_role: DevMcpRole | null;
	p_note: string | null;
	p_set_tools: string[] | null;
	p_drop_tools: string[] | null;
	p_details?: Record<string, unknown>;
}

const ACTION_VERBS: Record<DevMcpAccessAction["action"], string> = {
	approve: "approve",
	reapprove: "approve again",
	set_role: "change the role of",
	set_tools: "change the tools of",
	suspend: "suspend",
	deny: "deny",
};

function catalogToolsByName(catalog: DevMcpCatalog) {
	return new Map(catalog.tools.map((tool) => [tool.name, tool]));
}

/**
 * Turns an admin action into the change `dev_mcp_apply_change` applies, or
 * rejects it (400 for tools, 409 for a status the action doesn't apply to).
 * Loads dev-mcp's catalog only for actions that need it.
 */
export async function planDevMcpAccessChange(
	current: Pick<DevMcpAccessRow, "status" | "role">,
	action: DevMcpAccessAction,
	loadCatalog: () => Promise<DevMcpCatalog> = getDevMcpCatalog,
): Promise<DevMcpChange> {
	if (!DEV_MCP_ACCESS_ACTION_FROM[action.action].includes(current.status)) {
		throw new ConflictError(
			`Can't ${ACTION_VERBS[action.action]} Dev MCP access that is ${current.status}`,
		);
	}
	const unchanged = {
		p_from_statuses: [current.status],
		p_note: null,
		p_set_tools: null,
		p_drop_tools: null,
	};

	switch (action.action) {
		case "approve":
		case "reapprove": {
			const catalog = await loadCatalog();
			return {
				...unchanged,
				p_action: "member_approved",
				p_expected_role: null,
				p_status: "active",
				p_role: action.role,
				p_set_tools: devMcpPresetTools(action.role, catalog.tools),
			};
		}
		case "set_role": {
			const catalog = await loadCatalog();
			// Tools dev-mcp no longer lists are left alone, as dev-mcp does.
			const notAllowed = catalog.tools
				.filter((tool) => !devMcpRoleAtLeast(action.role, tool.minRole))
				.map((tool) => tool.name)
				.sort();
			return {
				...unchanged,
				p_action: "member_updated",
				p_expected_role: current.role,
				p_status: "active",
				p_role: action.role,
				p_drop_tools: notAllowed,
			};
		}
		case "set_tools": {
			const role = current.role ?? "member";
			const known = catalogToolsByName(await loadCatalog());
			const wanted = [...new Set(action.tools)].sort();
			const unknown = wanted.filter((tool) => !known.has(tool));
			if (unknown.length > 0) {
				throw new ValidationError(`Unknown tools: ${unknown.join(", ")}`);
			}
			const tooHigh = wanted.filter((tool) => {
				const rule = known.get(tool);
				return rule !== undefined && !devMcpRoleAtLeast(role, rule.minRole);
			});
			if (tooHigh.length > 0) {
				throw new ValidationError(
					`${tooHigh.join(", ")} need a higher role than ${role}; change the role first`,
				);
			}
			return {
				...unchanged,
				p_action: "member_tools_set",
				p_expected_role: current.role,
				p_status: "active",
				p_role: current.role,
				p_set_tools: wanted,
			};
		}
		case "suspend":
		case "deny":
			return {
				...unchanged,
				p_action: "member_updated",
				p_expected_role: null,
				p_status: action.action === "suspend" ? "suspended" : "denied",
				p_role: null,
				p_note: action.note,
			};
	}
}

interface RpcError {
	message?: string;
	hint?: string | null;
}

/** Maps the hints `dev_mcp_apply_change` raises to HTTP errors. */
function changeError(error: RpcError): Error {
	switch (error.hint) {
		case "dev_mcp_conflict":
		case "dev_mcp_last_admin":
			return new ConflictError(error.message ?? "Dev MCP access changed");
		case "dev_mcp_not_found":
			return new NotFoundError(error.message ?? "No Dev MCP access request");
		default:
			return new DatabaseError();
	}
}

/** Applies a planned change through `public.dev_mcp_apply_change`. */
export async function applyDevMcpChange(
	userId: string,
	actorId: string | null,
	source: DevMcpChangeSource,
	change: DevMcpChange,
): Promise<void> {
	const { error } = await getSupabase().rpc("dev_mcp_apply_change", {
		p_user_id: userId,
		p_actor_id: actorId,
		p_source: source,
		p_details: {},
		...change,
	});
	if (error) throw changeError(error as RpcError);
}

/** An admin's action on one member's dev-mcp access; returns the new entry. */
export async function changeDevMcpAccess(
	userId: string,
	action: DevMcpAccessAction,
	adminId: string,
	loadCatalog: () => Promise<DevMcpCatalog> = getDevMcpCatalog,
): Promise<DevMcpAccessEntry> {
	const current = await readRow(userId);
	if (!current) {
		throw new NotFoundError("This member has no Dev MCP access request");
	}
	const change = await planDevMcpAccessChange(current, action, loadCatalog);
	await applyDevMcpChange(userId, adminId, "admin", change);
	const updated = await readRow(userId);
	if (!updated) throw new DatabaseError();
	const [entry] = await toEntries([updated]);
	return entry;
}

/** The member's own status for /connected-apps. */
export async function readOwnDevMcpAccess(
	userId: string,
): Promise<OwnDevMcpAccess> {
	const row = await readRow(userId);
	if (!row) return { status: "none", role: null, tools: [] };
	if (row.status !== "active") {
		return { status: row.status, role: null, tools: [] };
	}
	const grants = await readGrants([userId]);
	return {
		status: "active",
		role: row.role,
		tools: grants.get(userId) ?? [],
	};
}

/**
 * The access record of the member with this TUM.ai Slack user ID
 * (`public.dev_mcp_access_for`), or null when no member-manager account has it.
 */
export async function readDevMcpAccessRecord(
	slackUserId: string,
): Promise<DevMcpAccessRecord | null> {
	const { data, error } = await getSupabase().rpc("dev_mcp_access_for", {
		slack_user_id: slackUserId,
	});
	if (error) throw new DatabaseError();
	if (data === null || data === undefined) return null;
	const parsed = devMcpAccessRecordSchema.safeParse(data);
	if (!parsed.success) throw new DatabaseError();
	return parsed.data;
}

/**
 * Files an access request for the member with this Slack user ID: a new
 * `requested` row, or a `denied` one moved back to `requested`
 * (`created: true`); anything else stays as it is. Null when no account has
 * the Slack ID.
 */
export async function requestDevMcpAccess(
	slackUserId: string,
	displayName: string | undefined,
): Promise<{ access: DevMcpAccessRecord; created: boolean } | null> {
	const before = await readDevMcpAccessRecord(slackUserId);
	if (!before) return null;
	const { data, error } = await getSupabase().rpc("dev_mcp_file_request", {
		p_user_id: before.user_id,
		p_source: "dev_mcp",
		p_actor_id: before.user_id,
		p_details: {
			slack_user_id: slackUserId,
			...(displayName ? { display_name: displayName } : {}),
		},
	});
	if (error) throw new DatabaseError();
	const access = await readDevMcpAccessRecord(slackUserId);
	if (!access) throw new DatabaseError();
	return { access, created: data === true };
}
