import type { DevMcpAccessActionInput } from "@member-manager/shared";
import { describe, expect, it } from "vitest";
import {
	DEV_MCP_CATALOG,
	devMcpAccessEntry,
} from "@/test/devMcpAccessFixtures";
import {
	describeDevMcpDecision,
	describeSavedDevMcpAction,
	devMcpToolChoices,
	groupDevMcpAccess,
} from "./adminDevMcpAccessUtils";

describe("groupDevMcpAccess", () => {
	it("groups by status: oldest request first, active by name, latest decision first", () => {
		const older = devMcpAccessEntry({
			user_id: "a",
			requested_at: "2026-11-01T10:00:00Z",
		});
		const newer = devMcpAccessEntry({
			user_id: "b",
			requested_at: "2026-11-05T10:00:00Z",
		});
		const zed = devMcpAccessEntry({
			user_id: "c",
			name: "Zed",
			status: "active",
		});
		const amy = devMcpAccessEntry({
			user_id: "d",
			name: "Amy",
			status: "active",
		});
		const suspendedEarly = devMcpAccessEntry({
			user_id: "e",
			status: "suspended",
			decided_at: "2026-11-01T10:00:00Z",
		});
		const suspendedLate = devMcpAccessEntry({
			user_id: "f",
			status: "suspended",
			decided_at: "2026-11-08T10:00:00Z",
		});
		const denied = devMcpAccessEntry({ user_id: "g", status: "denied" });

		expect(
			groupDevMcpAccess([
				newer,
				zed,
				suspendedEarly,
				older,
				amy,
				denied,
				suspendedLate,
			]),
		).toEqual({
			requested: [older, newer],
			active: [amy, zed],
			suspended: [suspendedLate, suspendedEarly],
			denied: [denied],
		});
	});
});

describe("devMcpToolChoices", () => {
	it("offers only the tools the role allows, destructive ones included", () => {
		expect(
			devMcpToolChoices("member", DEV_MCP_CATALOG).map((tool) => tool.name),
		).toEqual(["create_notion_page", "whoami"]);
		expect(
			devMcpToolChoices("lead", DEV_MCP_CATALOG).map((tool) => tool.name),
		).toEqual([
			"add_to_github_org",
			"create_mailbox",
			"create_notion_page",
			"whoami",
		]);
		expect(devMcpToolChoices("admin", DEV_MCP_CATALOG)).toHaveLength(6);
	});
});

describe("describeDevMcpDecision", () => {
	it("says what happened, when and by whom", () => {
		expect(describeDevMcpDecision(devMcpAccessEntry())).toBe(
			"Requested 9 Nov 2026, 11:00",
		);
		expect(
			describeDevMcpDecision(
				devMcpAccessEntry({
					status: "active",
					role: "lead",
					decided_at: "2026-11-09T12:00:00Z",
					decided_by_name: "Grace Hopper",
				}),
			),
		).toBe("Active as lead since 9 Nov 2026, 13:00 by Grace Hopper");
		expect(
			describeDevMcpDecision(
				devMcpAccessEntry({ status: "active", role: "admin" }),
			),
		).toBe("Active as admin");
		expect(
			describeDevMcpDecision(
				devMcpAccessEntry({
					status: "suspended",
					decided_at: "2026-11-09T12:00:00Z",
				}),
			),
		).toBe("Suspended 9 Nov 2026, 13:00");
		expect(
			describeDevMcpDecision(devMcpAccessEntry({ status: "denied" })),
		).toBe("Declined");
	});
});

describe("describeSavedDevMcpAction", () => {
	const entry = devMcpAccessEntry({ name: "Ada" });

	it.each([
		[
			{ action: "approve", role: "admin" },
			"Ada can now use Dev MCP as an admin.",
		],
		[
			{ action: "reapprove", role: "lead" },
			"Ada can now use Dev MCP as a lead.",
		],
		[{ action: "set_role", role: "member" }, "Ada is now a member in Dev MCP."],
		[{ action: "set_tools", tools: [] }, "Ada's Dev MCP tools were saved."],
		[{ action: "suspend" }, "Ada's Dev MCP access was suspended."],
		[{ action: "deny" }, "Ada's Dev MCP request was declined."],
	] satisfies Array<
		[DevMcpAccessActionInput, string]
	>)("%o", (action, text) => {
		expect(describeSavedDevMcpAction(entry, action)).toBe(text);
	});
});
