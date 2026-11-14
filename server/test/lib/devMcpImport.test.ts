import "../setup.js";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { DevMcpAccessRecord } from "@member-manager/shared";
import {
	devMcpExportSchema,
	planDevMcpImport,
} from "../../src/lib/devMcpImport.js";

const record = (
	userId: string,
	status: DevMcpAccessRecord["status"] = "none",
): DevMcpAccessRecord => ({
	user_id: userId,
	slack_user_id: "U0ANY",
	display_name: `Member ${userId}`,
	member_status: "active",
	slack_team_ok: true,
	status,
	role: null,
	tools: [],
});

const EXPORT = devMcpExportSchema.parse({
	members: [
		{
			slack_user_id: "U0ACTIVE",
			display_name: "Ada",
			status: "active",
			role: "lead",
			created_at: "2026-09-01",
		},
		{
			slackUserId: "U0ASKED",
			displayName: "Bo",
			status: "requested",
			role: "member",
		},
		{
			slack_user_id: "U0GONE",
			display_name: "Cy",
			status: "active",
			role: "admin",
		},
		{
			slack_user_id: "U0HERE",
			display_name: "Di",
			status: "active",
			role: "member",
		},
	],
	member_tools: [
		{ slack_user_id: "U0ACTIVE", tool: "whoami", granted_by: "U0X" },
		{ slack_user_id: "U0ACTIVE", tool: "create_mailbox" },
		{ slack_user_id: "U0ASKED", tool: "whoami" },
	],
});

const RECORDS: Record<string, DevMcpAccessRecord> = {
	U0ACTIVE: record("user-active"),
	U0ASKED: record("user-asked"),
	U0HERE: record("user-here", "active"),
};
const resolve = async (slackUserId: string) => RECORDS[slackUserId] ?? null;

describe("planDevMcpImport", () => {
	test("mirrors status, role and grants for mapped members without a row", async () => {
		const plan = await planDevMcpImport(EXPORT, resolve);

		assert.deepEqual(
			plan.changes.map(({ slackUserId, userId, change }) => ({
				slackUserId,
				userId,
				from: change.p_from_statuses,
				status: change.p_status,
				role: change.p_role,
				tools: change.p_set_tools,
				action: change.p_action,
			})),
			[
				{
					slackUserId: "U0ACTIVE",
					userId: "user-active",
					from: ["none"],
					status: "active",
					role: "lead",
					tools: ["create_mailbox", "whoami"],
					action: "member_imported",
				},
				{
					slackUserId: "U0ASKED",
					userId: "user-asked",
					from: ["none"],
					status: "requested",
					role: null,
					tools: null,
					action: "member_imported",
				},
			],
		);
	});

	test("lists unmapped Slack IDs and skips existing rows", async () => {
		const plan = await planDevMcpImport(EXPORT, resolve);

		assert.deepEqual(plan.unmapped, [
			{ slackUserId: "U0GONE", displayName: "Cy", status: "active" },
		]);
		assert.deepEqual(plan.skipped, [
			{ slackUserId: "U0HERE", userId: "user-here", status: "active" },
		]);
	});

	test("--overwrite replaces existing rows, guarded by their current status", async () => {
		const plan = await planDevMcpImport(EXPORT, resolve, { overwrite: true });

		const here = plan.changes.find((item) => item.slackUserId === "U0HERE");
		assert.deepEqual(here?.change.p_from_statuses, ["active"]);
		assert.equal(plan.skipped.length, 0);
	});

	test("rejects an export that isn't one", () => {
		for (const value of [
			{},
			{
				members: [{ slack_user_id: "U1", status: "approved", role: "member" }],
			},
			{ members: [{ slack_user_id: "U1", status: "active", role: "owner" }] },
		]) {
			assert.equal(devMcpExportSchema.safeParse(value).success, false);
		}
	});
});
