import {
	DEV_MCP_ACCESS_STATUSES,
	type DevMcpAccessRecord,
	devMcpRoleSchema,
} from "@member-manager/shared";
import { z } from "zod";
import type { DevMcpChange } from "./devMcpAccess.js";

/**
 * One-off import of dev-mcp's own access list (`members`, `member_tools` in
 * dev-mcp's database) into `public.dev_mcp_access` / `dev_mcp_tool_grants`,
 * for the cutover to member-manager (docs/deployment.md, "Dev MCP access").
 * The script is `src/scripts/importDevMcpAccess.ts`; this module holds the
 * parsing and planning so they can be tested without a database.
 */

const pick = (row: Record<string, unknown>, snake: string, camel: string) =>
	row[snake] ?? row[camel];

const memberSchema = z.preprocess(
	(value) => {
		if (!value || typeof value !== "object") return value;
		const row = value as Record<string, unknown>;
		return {
			slack_user_id: pick(row, "slack_user_id", "slackUserId"),
			display_name: pick(row, "display_name", "displayName"),
			status: row.status,
			role: row.role,
		};
	},
	z.object({
		slack_user_id: z.string().trim().min(1),
		display_name: z.string().nullish(),
		status: z.enum(DEV_MCP_ACCESS_STATUSES),
		role: devMcpRoleSchema,
	}),
);

const memberToolSchema = z.preprocess(
	(value) => {
		if (!value || typeof value !== "object") return value;
		const row = value as Record<string, unknown>;
		return {
			slack_user_id: pick(row, "slack_user_id", "slackUserId"),
			tool: row.tool,
		};
	},
	z.object({
		slack_user_id: z.string().trim().min(1),
		tool: z.string().trim().min(1),
	}),
);

/**
 * A JSON export of dev-mcp's access list, snake_case as the database returns
 * it (camelCase keys are accepted too):
 * `{ "members": [{ slack_user_id, display_name, status, role, … }],
 *    "member_tools": [{ slack_user_id, tool, … }] }`.
 */
export const devMcpExportSchema = z.object({
	members: z.array(memberSchema),
	member_tools: z.array(memberToolSchema).default([]),
});
export type DevMcpExport = z.infer<typeof devMcpExportSchema>;

export interface PlannedImport {
	slackUserId: string;
	userId: string;
	name: string | null;
	change: DevMcpChange;
}

export interface DevMcpImportPlan {
	changes: PlannedImport[];
	/** dev-mcp rows without a member-manager account with that Slack ID. */
	unmapped: Array<{
		slackUserId: string;
		displayName: string | null;
		status: string;
	}>;
	/** Members who already have access here (kept unless `overwrite`). */
	skipped: Array<{ slackUserId: string; userId: string; status: string }>;
}

/**
 * Maps every dev-mcp member to a member-manager account by Slack user ID and
 * plans the change that mirrors their dev-mcp status, role and grants
 * (`dev_mcp_apply_change`, action `member_imported`). Members who already
 * have a row here are skipped unless `overwrite` is set; then the change only
 * applies if their status hasn't moved since the plan.
 */
export async function planDevMcpImport(
	data: DevMcpExport,
	resolve: (slackUserId: string) => Promise<DevMcpAccessRecord | null>,
	{ overwrite = false }: { overwrite?: boolean } = {},
): Promise<DevMcpImportPlan> {
	const toolsBySlackId = new Map<string, Set<string>>();
	for (const { slack_user_id, tool } of data.member_tools) {
		const tools = toolsBySlackId.get(slack_user_id) ?? new Set<string>();
		tools.add(tool);
		toolsBySlackId.set(slack_user_id, tools);
	}

	const plan: DevMcpImportPlan = { changes: [], unmapped: [], skipped: [] };
	const members = [...data.members].sort((a, b) =>
		a.slack_user_id.localeCompare(b.slack_user_id),
	);
	for (const member of members) {
		const record = await resolve(member.slack_user_id);
		if (!record) {
			plan.unmapped.push({
				slackUserId: member.slack_user_id,
				displayName: member.display_name ?? null,
				status: member.status,
			});
			continue;
		}
		if (record.status !== "none" && !overwrite) {
			plan.skipped.push({
				slackUserId: member.slack_user_id,
				userId: record.user_id,
				status: record.status,
			});
			continue;
		}
		const active = member.status === "active";
		const tools = [...(toolsBySlackId.get(member.slack_user_id) ?? [])].sort();
		plan.changes.push({
			slackUserId: member.slack_user_id,
			userId: record.user_id,
			name: record.display_name,
			change: {
				p_action: "member_imported",
				p_from_statuses: [record.status],
				p_expected_role: null,
				p_status: member.status,
				p_role: active ? member.role : null,
				p_note: null,
				p_set_tools: active ? tools : null,
				p_drop_tools: null,
				p_details: {
					dev_mcp: {
						slack_user_id: member.slack_user_id,
						display_name: member.display_name ?? null,
						status: member.status,
						role: member.role,
						tools,
					},
				},
			},
		});
	}
	return plan;
}
