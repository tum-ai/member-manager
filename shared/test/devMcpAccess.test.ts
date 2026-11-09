import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	DEV_MCP_ACCESS_ACTION_FROM,
	DEV_MCP_ACCESS_NOTE_MAX_LENGTH,
	type DevMcpCatalogTool,
	devMcpAccessActionSchema,
	devMcpAccessRecordSchema,
	devMcpAccessRequestBodySchema,
	devMcpCatalogSchema,
	devMcpPresetTools,
	devMcpRoleAtLeast,
	devMcpToolsAllowedFor,
} from "../dist/index.js";

// dev-mcp's WORKFLOW_POLICY as of 2026-11 (src/access/policy.ts there).
const CATALOG: DevMcpCatalogTool[] = [
	["whoami", "member", null, false],
	["create_mailbox", "lead", "member", false],
	["create_shared_mailbox", "admin", "member", false],
	["suspend_mailbox", "admin", "lead", true],
	["add_to_github_org", "lead", "member", false],
	["create_notion_page", "member", null, false],
].map(([name, minRole, requestableBy, destructive]) => ({
	name: name as string,
	title: String(name),
	description: "",
	minRole: minRole as DevMcpCatalogTool["minRole"],
	requestableBy: requestableBy as DevMcpCatalogTool["requestableBy"],
	destructive: destructive as boolean,
	maxCallsPerDay: null,
}));

describe("dev-mcp roles and presets", () => {
	test("roles inherit everything below them", () => {
		assert.equal(devMcpRoleAtLeast("admin", "member"), true);
		assert.equal(devMcpRoleAtLeast("lead", "lead"), true);
		assert.equal(devMcpRoleAtLeast("member", "lead"), false);
	});

	test("a preset is every tool the role meets, except destructive ones", () => {
		assert.deepEqual(devMcpPresetTools("member", CATALOG), [
			"create_notion_page",
			"whoami",
		]);
		assert.deepEqual(devMcpPresetTools("lead", CATALOG), [
			"add_to_github_org",
			"create_mailbox",
			"create_notion_page",
			"whoami",
		]);
		assert.deepEqual(devMcpPresetTools("admin", CATALOG), [
			"add_to_github_org",
			"create_mailbox",
			"create_notion_page",
			"create_shared_mailbox",
			"whoami",
		]);
	});

	test("the allowed tools include destructive ones", () => {
		assert.ok(
			devMcpToolsAllowedFor("admin", CATALOG).includes("suspend_mailbox"),
		);
		assert.ok(
			!devMcpToolsAllowedFor("lead", CATALOG).includes("suspend_mailbox"),
		);
	});
});

describe("devMcpCatalogSchema", () => {
	test("normalizes missing optional fields and ignores extra ones", () => {
		const parsed = devMcpCatalogSchema.parse({
			tools: [
				{
					name: "whoami",
					title: "Who am I",
					description: "Shows your access",
					minRole: "member",
					destructive: false,
					codeEnabled: true,
				},
			],
		});
		assert.deepEqual(parsed.tools[0], {
			name: "whoami",
			title: "Who am I",
			description: "Shows your access",
			minRole: "member",
			requestableBy: null,
			destructive: false,
			maxCallsPerDay: null,
		});
	});

	test("rejects unknown roles and bad tool names", () => {
		for (const tool of [
			{ name: "whoami", minRole: "owner" },
			{ name: "Who Am I", minRole: "member" },
		]) {
			assert.equal(
				devMcpCatalogSchema.safeParse({
					tools: [{ title: "", description: "", destructive: false, ...tool }],
				}).success,
				false,
			);
		}
	});
});

describe("devMcpAccessActionSchema", () => {
	test("approving and changing the role need a dev-mcp role", () => {
		for (const action of ["approve", "reapprove", "set_role"] as const) {
			assert.deepEqual(
				devMcpAccessActionSchema.parse({ action, role: "lead" }),
				{
					action,
					role: "lead",
				},
			);
			assert.equal(
				devMcpAccessActionSchema.safeParse({ action, role: "editor" }).success,
				false,
			);
		}
	});

	test("set_tools takes tool names", () => {
		assert.deepEqual(
			devMcpAccessActionSchema.parse({
				action: "set_tools",
				tools: ["whoami"],
			}),
			{ action: "set_tools", tools: ["whoami"] },
		);
		assert.equal(
			devMcpAccessActionSchema.safeParse({
				action: "set_tools",
				tools: ["DROP TABLE"],
			}).success,
			false,
		);
	});

	test("suspend and deny take an optional, trimmed note", () => {
		assert.deepEqual(devMcpAccessActionSchema.parse({ action: "suspend" }), {
			action: "suspend",
			note: null,
		});
		assert.deepEqual(
			devMcpAccessActionSchema.parse({ action: "deny", note: "  later  " }),
			{ action: "deny", note: "later" },
		);
		assert.equal(
			devMcpAccessActionSchema.safeParse({
				action: "deny",
				note: "x".repeat(DEV_MCP_ACCESS_NOTE_MAX_LENGTH + 1),
			}).success,
			false,
		);
	});

	test("each action applies to the statuses it can change", () => {
		assert.deepEqual(DEV_MCP_ACCESS_ACTION_FROM, {
			approve: ["requested"],
			reapprove: ["suspended", "denied"],
			set_role: ["active"],
			set_tools: ["active"],
			suspend: ["active"],
			deny: ["requested"],
		});
	});
});

describe("the access record", () => {
	const record = {
		user_id: "00000000-0000-0000-0000-000000000019",
		slack_user_id: "U0DEVSEED19",
		display_name: "Sofia Software",
		member_status: "active",
		slack_team_ok: true,
		status: "active",
		role: "lead",
		tools: ["whoami"],
	};

	test("parses the contract shape", () => {
		assert.deepEqual(devMcpAccessRecordSchema.parse(record), record);
		assert.equal(
			devMcpAccessRecordSchema.safeParse({
				...record,
				status: "none",
				role: null,
			}).success,
			true,
		);
	});

	test("rejects a Slack ID that isn't one", () => {
		assert.equal(
			devMcpAccessRecordSchema.safeParse({ ...record, slack_user_id: "u123" })
				.success,
			false,
		);
	});

	test("a request body is optional", () => {
		assert.deepEqual(devMcpAccessRequestBodySchema.parse(undefined), {});
		assert.deepEqual(
			devMcpAccessRequestBodySchema.parse({ display_name: " Sofia " }),
			{ display_name: "Sofia" },
		);
	});
});
