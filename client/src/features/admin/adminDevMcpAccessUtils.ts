import {
	type DevMcpAccessActionInput,
	type DevMcpAccessEntry,
	type DevMcpCatalogTool,
	type DevMcpRole,
	devMcpRoleAtLeast,
} from "@member-manager/shared";
import { formatMcpAccessTime } from "@/features/admin/adminMcpAccessUtils";

export const DEV_MCP_ROLE_LABELS: Record<DevMcpRole, string> = {
	member: "Member",
	lead: "Lead",
	admin: "Admin",
};

/** What each role means in dev-mcp, for the role picker. */
export const DEV_MCP_ROLE_HINTS: Record<DevMcpRole, string> = {
	member: "Everyday tools; asks for the rest",
	lead: "Also mailboxes and GitHub invites",
	admin: "Everything, and approves requests",
};

/** Admins approve as member unless they pick otherwise. */
export const DEFAULT_DEV_MCP_ROLE: DevMcpRole = "member";

export interface DevMcpAccessGroups {
	/** Oldest request first, so nobody waits forever. */
	requested: DevMcpAccessEntry[];
	/** By name. */
	active: DevMcpAccessEntry[];
	/** Latest decision first. */
	suspended: DevMcpAccessEntry[];
	/** Latest decision first. */
	denied: DevMcpAccessEntry[];
}

const byName = (a: DevMcpAccessEntry, b: DevMcpAccessEntry) =>
	a.name.localeCompare(b.name);
const latestDecisionFirst = (a: DevMcpAccessEntry, b: DevMcpAccessEntry) =>
	(b.decided_at ?? "").localeCompare(a.decided_at ?? "");

export function groupDevMcpAccess(
	entries: DevMcpAccessEntry[],
): DevMcpAccessGroups {
	const groups: DevMcpAccessGroups = {
		requested: [],
		active: [],
		suspended: [],
		denied: [],
	};
	for (const entry of entries) {
		groups[entry.status].push(entry);
	}
	groups.requested.sort((a, b) => a.requested_at.localeCompare(b.requested_at));
	groups.active.sort(byName);
	groups.suspended.sort(latestDecisionFirst);
	groups.denied.sort(latestDecisionFirst);
	return groups;
}

/** The tools an admin may grant to someone with this role, by name. */
export function devMcpToolChoices(
	role: DevMcpRole,
	catalog: readonly DevMcpCatalogTool[],
): DevMcpCatalogTool[] {
	return catalog
		.filter((tool) => devMcpRoleAtLeast(role, tool.minRole))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** The decision line under the member's name. */
export function describeDevMcpDecision(entry: DevMcpAccessEntry): string {
	const when = formatMcpAccessTime(entry.decided_at);
	const at = when ? ` ${when}` : "";
	const by = entry.decided_by_name ? ` by ${entry.decided_by_name}` : "";
	switch (entry.status) {
		case "requested":
			return `Requested ${formatMcpAccessTime(entry.requested_at)}`;
		case "active":
			return `Active as ${DEV_MCP_ROLE_LABELS[entry.role ?? DEFAULT_DEV_MCP_ROLE].toLowerCase()}${at ? ` since${at}` : ""}${by}`;
		case "suspended":
			return `Suspended${at}${by}`;
		case "denied":
			return `Declined${at}${by}`;
	}
}

const article = (role: DevMcpRole) => (role === "admin" ? "an" : "a");

/** The toast after an action was saved. */
export function describeSavedDevMcpAction(
	entry: DevMcpAccessEntry,
	action: DevMcpAccessActionInput,
): string {
	switch (action.action) {
		case "approve":
		case "reapprove":
			return `${entry.name} can now use Dev MCP as ${article(action.role)} ${action.role}.`;
		case "set_role":
			return `${entry.name} is now ${article(action.role)} ${action.role} in Dev MCP.`;
		case "set_tools":
			return `${entry.name}'s Dev MCP tools were saved.`;
		case "suspend":
			return `${entry.name}'s Dev MCP access was suspended.`;
		case "deny":
			return `${entry.name}'s Dev MCP request was declined.`;
	}
}
