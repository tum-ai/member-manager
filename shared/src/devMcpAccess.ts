import { z } from "zod";

/**
 * Access to dev-mcp, the MCP server behind Dev Claude (`tum-ai/dev-mcp`),
 * which admins decide per member on /admin/mcp-access (Dev tab). Stored in
 * `public.dev_mcp_access` and `public.dev_mcp_tool_grants` (migration
 * `20261109120000_dev_mcp_access.sql`).
 *
 * dev-mcp keeps enforcing; it reads the {@link DevMcpAccessRecord} through the
 * service API (`/api/internal/dev-mcp/access/:slackUserId`, Dev Claude runs)
 * or `public.dev_mcp_principal()` (member OAuth tokens). The tool catalog and
 * the role presets come from dev-mcp (`GET <DEV_MCP_URL>/service/catalog`).
 */

/**
 * `requested`: waiting for an admin. `active`: may use dev-mcp. `suspended`:
 * access taken away. `denied`: request declined; the member may ask again.
 */
export const DEV_MCP_ACCESS_STATUSES = [
	"requested",
	"active",
	"suspended",
	"denied",
] as const;
export const devMcpAccessStatusSchema = z.enum(DEV_MCP_ACCESS_STATUSES);
export type DevMcpAccessStatus = z.infer<typeof devMcpAccessStatusSchema>;

/** dev-mcp's roles, lowest first; each role has everything below it. */
export const DEV_MCP_ROLES = ["member", "lead", "admin"] as const;
export const devMcpRoleSchema = z.enum(DEV_MCP_ROLES);
export type DevMcpRole = z.infer<typeof devMcpRoleSchema>;

/** Whether `role` meets `required` (dev-mcp's `atLeast`). */
export function devMcpRoleAtLeast(
	role: DevMcpRole,
	required: DevMcpRole,
): boolean {
	return DEV_MCP_ROLES.indexOf(role) >= DEV_MCP_ROLES.indexOf(required);
}

/** A Slack user ID as `public.member_slack_user_id()` returns it. */
export const SLACK_USER_ID_PATTERN = /^[UW][A-Z0-9]{2,20}$/;
export const slackUserIdSchema = z.string().regex(SLACK_USER_ID_PATTERN);

/** Matches the tool name check in the migration. */
export const DEV_MCP_TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
export const devMcpToolNameSchema = z
	.string()
	.regex(DEV_MCP_TOOL_NAME_PATTERN, "Invalid tool name");

/**
 * The access record dev-mcp decides on (contract with dev-mcp), returned by
 * the service API and `public.dev_mcp_principal()`. `status: "none"` means
 * the member has no request. `role` is set and `tools` non-empty only while
 * `active`.
 */
export const devMcpAccessRecordSchema = z.object({
	user_id: z.string(),
	slack_user_id: slackUserIdSchema,
	display_name: z.string().nullable(),
	member_status: z.string().nullable(),
	slack_team_ok: z.boolean(),
	status: z.enum([...DEV_MCP_ACCESS_STATUSES, "none"]),
	role: devMcpRoleSchema.nullable(),
	tools: z.array(z.string()),
});
export type DevMcpAccessRecord = z.infer<typeof devMcpAccessRecordSchema>;

/** Body of `POST /api/internal/dev-mcp/access/:slackUserId/request`. */
export const devMcpAccessRequestBodySchema = z
	.object({
		display_name: z.string().trim().max(200).optional(),
	})
	.nullish()
	.transform((body) => body ?? {});
export type DevMcpAccessRequestBody = z.infer<
	typeof devMcpAccessRequestBodySchema
>;

/**
 * One tool of dev-mcp's catalog (`GET <DEV_MCP_URL>/service/catalog`), from
 * its `WORKFLOW_POLICY` and workflows. Not filtered by integrations or
 * runtime switches.
 */
export const devMcpCatalogToolSchema = z.object({
	name: devMcpToolNameSchema,
	title: z.string(),
	description: z.string(),
	minRole: devMcpRoleSchema,
	requestableBy: devMcpRoleSchema.nullish().transform((role) => role ?? null),
	destructive: z.boolean(),
	maxCallsPerDay: z
		.number()
		.int()
		.nonnegative()
		.nullish()
		.transform((limit) => limit ?? null),
});
export type DevMcpCatalogTool = z.infer<typeof devMcpCatalogToolSchema>;

export const devMcpCatalogSchema = z.object({
	tools: z.array(devMcpCatalogToolSchema),
});
export type DevMcpCatalog = z.infer<typeof devMcpCatalogSchema>;

/** Every catalog tool whose `minRole` the role meets, destructive ones included. */
export function devMcpToolsAllowedFor(
	role: DevMcpRole,
	tools: readonly DevMcpCatalogTool[],
): string[] {
	return tools
		.filter((tool) => devMcpRoleAtLeast(role, tool.minRole))
		.map((tool) => tool.name)
		.sort();
}

/**
 * A role's default grants: everything it may run except destructive tools.
 * Must match `presetTools` in dev-mcp's `src/access/resolver.ts`.
 */
export function devMcpPresetTools(
	role: DevMcpRole,
	tools: readonly DevMcpCatalogTool[],
): string[] {
	return tools
		.filter(
			(tool) => !tool.destructive && devMcpRoleAtLeast(role, tool.minRole),
		)
		.map((tool) => tool.name)
		.sort();
}

/** Matches the `decision_note` check in the migration. */
export const DEV_MCP_ACCESS_NOTE_MAX_LENGTH = 500;

const decisionNoteSchema = z
	.string()
	.trim()
	.max(DEV_MCP_ACCESS_NOTE_MAX_LENGTH)
	.nullish()
	.transform((note) => note || null);

/**
 * Body of `PATCH /api/admin/dev-mcp-access/:userId`.
 *
 * - `approve`: a requested member becomes active with the role's preset tools.
 * - `reapprove`: a suspended or denied member, likewise.
 * - `set_role`: an active member's role changes; a demotion drops grants the
 *   new role doesn't allow.
 * - `set_tools`: an active member's grants become exactly these tools; each
 *   must be in the catalog and allowed for the role.
 * - `suspend`: an active member loses access.
 * - `deny`: a request is declined.
 *
 * Nobody can remove the last active admin. Notes are for admins only.
 */
export const devMcpAccessActionSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("approve"), role: devMcpRoleSchema }),
	z.object({ action: z.literal("reapprove"), role: devMcpRoleSchema }),
	z.object({ action: z.literal("set_role"), role: devMcpRoleSchema }),
	z.object({
		action: z.literal("set_tools"),
		tools: z.array(devMcpToolNameSchema).max(100),
	}),
	z.object({ action: z.literal("suspend"), note: decisionNoteSchema }),
	z.object({ action: z.literal("deny"), note: decisionNoteSchema }),
]);

export type DevMcpAccessActionInput = z.input<typeof devMcpAccessActionSchema>;
export type DevMcpAccessAction = z.infer<typeof devMcpAccessActionSchema>;
export type DevMcpAccessActionName = DevMcpAccessAction["action"];

/** The statuses each action applies to; anything else is a conflict. */
export const DEV_MCP_ACCESS_ACTION_FROM: Record<
	DevMcpAccessActionName,
	readonly DevMcpAccessStatus[]
> = {
	approve: ["requested"],
	reapprove: ["suspended", "denied"],
	set_role: ["active"],
	set_tools: ["active"],
	suspend: ["active"],
	deny: ["requested"],
};

/** One row of `GET /api/admin/dev-mcp-access` (and the `PATCH` response). */
export interface DevMcpAccessEntry {
	user_id: string;
	/** The member's name; "Unknown member" if the row can't be matched. */
	name: string;
	department: string | null;
	member_status: string | null;
	status: DevMcpAccessStatus;
	/** Set exactly while `status` is `active`. */
	role: DevMcpRole | null;
	/** Granted tools, sorted; empty unless active. */
	tools: string[];
	requested_at: string;
	decided_at: string | null;
	decided_by: string | null;
	decided_by_name: string | null;
	decision_note: string | null;
	/** Last OAuth sign-in check; Dev Claude runs don't update it. */
	last_seen_at: string | null;
	last_client_id: string | null;
	last_client_name: string | null;
}

/** Response of `GET /api/dev-mcp-access/me`, for /connected-apps. */
export interface OwnDevMcpAccess {
	status: DevMcpAccessStatus | "none";
	role: DevMcpRole | null;
	tools: string[];
}
