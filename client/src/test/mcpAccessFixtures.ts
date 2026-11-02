import type { McpAccessEntry } from "@member-manager/shared";

/** A nomcp access request as `GET /api/admin/mcp-access` returns it. */
export function mcpAccessEntry(
	overrides: Partial<McpAccessEntry> = {},
): McpAccessEntry {
	return {
		user_id: "user-1",
		name: "Ada Lovelace",
		department: "Software Development",
		member_status: "active",
		status: "pending",
		role: null,
		requested_at: "2026-11-02T10:00:00Z",
		decided_at: null,
		decided_by: null,
		decided_by_name: null,
		decision_note: null,
		last_seen_at: "2026-11-02T10:00:00Z",
		last_client_id: "client-1",
		last_client_name: "Claude Code",
		...overrides,
	};
}
