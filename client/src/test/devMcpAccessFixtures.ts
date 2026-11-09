import type {
	DevMcpAccessEntry,
	DevMcpCatalogTool,
} from "@member-manager/shared";

/** A dev-mcp access request as `GET /api/admin/dev-mcp-access` returns it. */
export function devMcpAccessEntry(
	overrides: Partial<DevMcpAccessEntry> = {},
): DevMcpAccessEntry {
	return {
		user_id: "user-1",
		name: "Ada Lovelace",
		department: "Software Development",
		member_status: "active",
		status: "requested",
		role: null,
		tools: [],
		requested_at: "2026-11-09T10:00:00Z",
		decided_at: null,
		decided_by: null,
		decided_by_name: null,
		decision_note: null,
		last_seen_at: null,
		last_client_id: null,
		last_client_name: null,
		...overrides,
	};
}

const tool = (
	name: string,
	title: string,
	minRole: DevMcpCatalogTool["minRole"],
	destructive = false,
): DevMcpCatalogTool => ({
	name,
	title,
	description: `${title}.`,
	minRole,
	requestableBy: null,
	destructive,
	maxCallsPerDay: null,
});

/** dev-mcp's catalog as of 2026-11 (its WORKFLOW_POLICY). */
export const DEV_MCP_CATALOG: DevMcpCatalogTool[] = [
	tool("whoami", "Who am I", "member"),
	tool("create_notion_page", "Create a Notion page", "member"),
	tool("create_mailbox", "Create a mailbox", "lead"),
	tool("add_to_github_org", "Invite to GitHub", "lead"),
	tool("create_shared_mailbox", "Create a shared mailbox", "admin"),
	tool("suspend_mailbox", "Suspend a mailbox", "admin", true),
];
