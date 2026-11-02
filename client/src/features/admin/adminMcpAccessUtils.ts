import type {
	McpAccessDecisionInput,
	McpAccessEntry,
	McpAccessRole,
} from "@member-manager/shared";

export const MCP_ACCESS_ROLE_LABELS: Record<McpAccessRole, string> = {
	reader: "Reader",
	editor: "Editor",
};

/** What each role may do in nomcp, for the role picker. */
export const MCP_ACCESS_ROLE_HINTS: Record<McpAccessRole, string> = {
	reader: "Search and read",
	editor: "Read, create, edit and comment",
};

/** Admins approve as editor unless they pick otherwise (nomcp's default). */
export const DEFAULT_MCP_ACCESS_ROLE: McpAccessRole = "editor";

export interface McpAccessGroups {
	/** Oldest request first, so nobody waits forever. */
	pending: McpAccessEntry[];
	/** By name. */
	approved: McpAccessEntry[];
	/** Latest decision first. */
	denied: McpAccessEntry[];
}

const byName = (a: McpAccessEntry, b: McpAccessEntry) =>
	a.name.localeCompare(b.name);

export function groupMcpAccess(entries: McpAccessEntry[]): McpAccessGroups {
	const groups: McpAccessGroups = { pending: [], approved: [], denied: [] };
	for (const entry of entries) {
		groups[entry.status].push(entry);
	}
	groups.pending.sort((a, b) => a.requested_at.localeCompare(b.requested_at));
	groups.approved.sort(byName);
	groups.denied.sort((a, b) =>
		(b.decided_at ?? "").localeCompare(a.decided_at ?? ""),
	);
	return groups;
}

/** "2 Nov 2026, 11:00" in Munich time; null for a missing timestamp. */
export function formatMcpAccessTime(value: string | null): string | null {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Berlin",
	});
}

/** When and with which AI app the member last used nomcp. */
export function describeLastUse(entry: McpAccessEntry): string {
	const seen = formatMcpAccessTime(entry.last_seen_at);
	if (!seen) return "Hasn't used it yet";
	const client = entry.last_client_name?.trim() || entry.last_client_id;
	return client ? `Last used ${seen} with ${client}` : `Last used ${seen}`;
}

/** The decision line under the member's name. */
export function describeDecision(entry: McpAccessEntry): string {
	const when = formatMcpAccessTime(entry.decided_at);
	const by = entry.decided_by_name ? ` by ${entry.decided_by_name}` : "";
	switch (entry.status) {
		case "pending":
			return `Requested ${formatMcpAccessTime(entry.requested_at)}`;
		case "approved":
			return `Approved as ${MCP_ACCESS_ROLE_LABELS[entry.role ?? DEFAULT_MCP_ACCESS_ROLE].toLowerCase()}${when ? ` ${when}` : ""}${by}`;
		case "denied":
			return `Declined${when ? ` ${when}` : ""}${by}`;
	}
}

/** The toast after a decision was saved. */
export function describeSavedDecision(
	entry: McpAccessEntry,
	decision: McpAccessDecisionInput,
): string {
	switch (decision.action) {
		case "approve":
			return `${entry.name} can now use the Notion MCP as ${decision.role}.`;
		case "set_role":
			return `${entry.name} is now ${decision.role === "editor" ? "an editor" : "a reader"}.`;
		case "deny":
			return `${entry.name}'s request was declined.`;
		case "revoke":
			return `${entry.name} no longer has Notion MCP access.`;
	}
}
