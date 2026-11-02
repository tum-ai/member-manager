import { z } from "zod";

/**
 * Access to nomcp, the TUM.ai Notion MCP, which admins decide per member.
 * Stored in `public.mcp_access` (migration
 * `20261102180000_nomcp_access_approval.sql`). nomcp reads it through
 * `public.mcp_principal()`, which also files the pending request the first
 * time an eligible member connects an AI app.
 */
export const MCP_ACCESS_STATUSES = ["pending", "approved", "denied"] as const;
export const mcpAccessStatusSchema = z.enum(MCP_ACCESS_STATUSES);
export type McpAccessStatus = z.infer<typeof mcpAccessStatusSchema>;

/** `reader` gets nomcp's read tools; `editor` also the write tools. */
export const MCP_ACCESS_ROLES = ["reader", "editor"] as const;
export const mcpAccessRoleSchema = z.enum(MCP_ACCESS_ROLES);
export type McpAccessRole = z.infer<typeof mcpAccessRoleSchema>;

/** Matches the `decision_note` check in the migration. */
export const MCP_ACCESS_NOTE_MAX_LENGTH = 500;

const decisionNoteSchema = z
	.string()
	.trim()
	.max(MCP_ACCESS_NOTE_MAX_LENGTH)
	.nullish()
	.transform((note) => note || null);

/**
 * Body of `PATCH /api/admin/mcp-access/:userId`.
 *
 * - `approve`: a pending or denied member gets access with this role.
 * - `set_role`: an approved member keeps access with another role.
 * - `deny`: a pending request is declined, optionally with a note.
 * - `revoke`: an approved member loses access (becomes denied).
 *
 * The note is for admins; members never see it.
 */
export const mcpAccessDecisionSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("approve"), role: mcpAccessRoleSchema }),
	z.object({ action: z.literal("set_role"), role: mcpAccessRoleSchema }),
	z.object({ action: z.literal("deny"), note: decisionNoteSchema }),
	z.object({ action: z.literal("revoke"), note: decisionNoteSchema }),
]);

export type McpAccessDecisionInput = z.input<typeof mcpAccessDecisionSchema>;
export type McpAccessDecision = z.infer<typeof mcpAccessDecisionSchema>;
export type McpAccessAction = McpAccessDecision["action"];

/** The statuses each action applies to; anything else is a conflict. */
export const MCP_ACCESS_ACTION_FROM: Record<
	McpAccessAction,
	readonly McpAccessStatus[]
> = {
	approve: ["pending", "denied"],
	set_role: ["approved"],
	deny: ["pending"],
	revoke: ["approved"],
};

/** One row of `GET /api/admin/mcp-access` (and the `PATCH` response). */
export interface McpAccessEntry {
	user_id: string;
	/** The member's name; "Unknown member" if the row can't be matched. */
	name: string;
	department: string | null;
	member_status: string | null;
	status: McpAccessStatus;
	/** Set exactly while `status` is `approved`. */
	role: McpAccessRole | null;
	requested_at: string;
	decided_at: string | null;
	decided_by: string | null;
	decided_by_name: string | null;
	decision_note: string | null;
	/** Last nomcp sign-in check; refreshed at most once per minute. */
	last_seen_at: string | null;
	last_client_id: string | null;
	last_client_name: string | null;
}

/**
 * Response of `GET /api/mcp-access/me`. `none`: the member hasn't connected
 * an AI app to nomcp yet, so there is no request.
 */
export interface OwnMcpAccess {
	status: McpAccessStatus | "none";
	role: McpAccessRole | null;
}
