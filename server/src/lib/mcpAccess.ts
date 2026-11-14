import {
	MCP_ACCESS_ACTION_FROM,
	type McpAccessDecision,
	type McpAccessEntry,
	type McpAccessRole,
	type McpAccessStatus,
	type OwnMcpAccess,
} from "@member-manager/shared";
import { ConflictError, DatabaseError, NotFoundError } from "./errors.js";
import { getSupabase } from "./supabase.js";

/**
 * nomcp (TUM.ai Notion MCP) access per member, in `public.mcp_access`.
 * nomcp itself only reads it through `public.mcp_principal()`, which files the
 * pending request on a member's first sign-in; admins decide here.
 */

interface McpAccessRow {
	user_id: string;
	status: McpAccessStatus;
	role: McpAccessRole | null;
	requested_at: string;
	decided_at: string | null;
	decided_by: string | null;
	decision_note: string | null;
	last_seen_at: string | null;
	last_client_id: string | null;
	last_client_name: string | null;
}

export interface MemberSummary {
	user_id: string;
	given_name: string | null;
	surname: string | null;
	department: string | null;
	member_status: string | null;
}

const ROW_COLUMNS =
	"user_id, status, role, requested_at, decided_at, decided_by, decision_note, last_seen_at, last_client_id, last_client_name";

export function memberName(member: MemberSummary | undefined): string | null {
	if (!member) return null;
	const name = [member.given_name, member.surname]
		.map((part) => part?.trim())
		.filter(Boolean)
		.join(" ");
	return name || null;
}

export async function readMemberSummaries(
	userIds: string[],
): Promise<Map<string, MemberSummary>> {
	if (userIds.length === 0) return new Map();
	const { data, error } = await getSupabase()
		.from("members")
		.select("user_id, given_name, surname, department, member_status")
		.in("user_id", userIds);
	if (error) throw new DatabaseError();
	return new Map(
		((data ?? []) as MemberSummary[]).map((member) => [member.user_id, member]),
	);
}

async function toEntries(rows: McpAccessRow[]): Promise<McpAccessEntry[]> {
	const ids = new Set<string>();
	for (const row of rows) {
		ids.add(row.user_id);
		if (row.decided_by) ids.add(row.decided_by);
	}
	const members = await readMemberSummaries([...ids]);
	return rows.map((row) => {
		const member = members.get(row.user_id);
		return {
			...row,
			name: memberName(member) ?? "Unknown member",
			department: member?.department ?? null,
			member_status: member?.member_status ?? null,
			decided_by_name: row.decided_by
				? memberName(members.get(row.decided_by))
				: null,
		};
	});
}

/** Every request, oldest first; the page groups them by status. */
export async function listMcpAccess(): Promise<McpAccessEntry[]> {
	const { data, error } = await getSupabase()
		.from("mcp_access")
		.select(ROW_COLUMNS)
		.order("requested_at", { ascending: true });
	if (error) throw new DatabaseError();
	return toEntries((data ?? []) as McpAccessRow[]);
}

/**
 * Applies an admin's decision. The update only matches the status the
 * decision was checked against, so two admins deciding at once can't both
 * win: the second gets a conflict and reloads.
 */
export async function decideMcpAccess(
	userId: string,
	decision: McpAccessDecision,
	adminId: string,
): Promise<McpAccessEntry> {
	const supabase = getSupabase();
	const { data: current, error: readError } = await supabase
		.from("mcp_access")
		.select("user_id, status")
		.eq("user_id", userId)
		.maybeSingle();
	if (readError) throw new DatabaseError();
	if (!current) throw new NotFoundError("No nomcp access request for member");

	const status = (current as Pick<McpAccessRow, "status">).status;
	if (!MCP_ACCESS_ACTION_FROM[decision.action].includes(status)) {
		throw new ConflictError(
			`Can't ${decision.action.replace("_", " ")} nomcp access that is ${status}`,
		);
	}

	const change =
		decision.action === "approve" || decision.action === "set_role"
			? { status: "approved", role: decision.role, decision_note: null }
			: { status: "denied", role: null, decision_note: decision.note };

	const { data: updated, error: updateError } = await supabase
		.from("mcp_access")
		.update({
			...change,
			decided_at: new Date().toISOString(),
			decided_by: adminId,
		})
		.eq("user_id", userId)
		.eq("status", status)
		.select(ROW_COLUMNS);
	if (updateError) throw new DatabaseError();
	const [row] = (updated ?? []) as McpAccessRow[];
	if (!row) {
		throw new ConflictError(
			"This request was changed in the meantime; reload and try again",
		);
	}
	const [entry] = await toEntries([row]);
	return entry;
}

/** The member's own status for /connected-apps. */
export async function readOwnMcpAccess(userId: string): Promise<OwnMcpAccess> {
	const { data, error } = await getSupabase()
		.from("mcp_access")
		.select("status, role")
		.eq("user_id", userId)
		.maybeSingle();
	if (error) throw new DatabaseError();
	if (!data) return { status: "none", role: null };
	const row = data as Pick<McpAccessRow, "status" | "role">;
	return {
		status: row.status,
		role: row.status === "approved" ? row.role : null,
	};
}
