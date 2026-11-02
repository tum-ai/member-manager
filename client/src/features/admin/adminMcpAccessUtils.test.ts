import { describe, expect, it } from "vitest";
import { mcpAccessEntry } from "@/test/mcpAccessFixtures";
import {
	describeDecision,
	describeLastUse,
	describeSavedDecision,
	formatMcpAccessTime,
	groupMcpAccess,
} from "./adminMcpAccessUtils";

describe("groupMcpAccess", () => {
	it("splits by status: oldest request, then name, then latest decision first", () => {
		const groups = groupMcpAccess([
			mcpAccessEntry({ user_id: "p2", requested_at: "2026-11-02T12:00:00Z" }),
			mcpAccessEntry({ user_id: "p1", requested_at: "2026-11-01T12:00:00Z" }),
			mcpAccessEntry({ user_id: "a2", name: "Zoe", status: "approved" }),
			mcpAccessEntry({ user_id: "a1", name: "Bob", status: "approved" }),
			mcpAccessEntry({
				user_id: "d1",
				status: "denied",
				decided_at: "2026-10-01T00:00:00Z",
			}),
			mcpAccessEntry({
				user_id: "d2",
				status: "denied",
				decided_at: "2026-11-01T00:00:00Z",
			}),
		]);

		expect(groups.pending.map((entry) => entry.user_id)).toEqual(["p1", "p2"]);
		expect(groups.approved.map((entry) => entry.user_id)).toEqual(["a1", "a2"]);
		expect(groups.denied.map((entry) => entry.user_id)).toEqual(["d2", "d1"]);
	});
});

describe("formatting", () => {
	it("shows times in Munich time", () => {
		expect(formatMcpAccessTime("2026-11-02T10:00:00Z")).toBe(
			"2 Nov 2026, 11:00",
		);
		expect(formatMcpAccessTime(null)).toBeNull();
		expect(formatMcpAccessTime("soon")).toBe("soon");
	});

	it("describes the last use with the app's name, or its id", () => {
		expect(describeLastUse(mcpAccessEntry())).toBe(
			"Last used 2 Nov 2026, 11:00 with Claude Code",
		);
		expect(describeLastUse(mcpAccessEntry({ last_client_name: null }))).toBe(
			"Last used 2 Nov 2026, 11:00 with client-1",
		);
		expect(
			describeLastUse(
				mcpAccessEntry({ last_client_name: null, last_client_id: null }),
			),
		).toBe("Last used 2 Nov 2026, 11:00");
		expect(describeLastUse(mcpAccessEntry({ last_seen_at: null }))).toBe(
			"Hasn't used it yet",
		);
	});

	it("describes each decision", () => {
		expect(describeDecision(mcpAccessEntry())).toBe(
			"Requested 2 Nov 2026, 11:00",
		);
		expect(
			describeDecision(
				mcpAccessEntry({
					status: "approved",
					role: "reader",
					decided_at: "2026-11-02T12:30:00Z",
					decided_by_name: "Grace Hopper",
				}),
			),
		).toBe("Approved as reader 2 Nov 2026, 13:30 by Grace Hopper");
		expect(
			describeDecision(mcpAccessEntry({ status: "approved", role: "editor" })),
		).toBe("Approved as editor");
		expect(
			describeDecision(
				mcpAccessEntry({
					status: "denied",
					decided_at: "2026-11-02T12:30:00Z",
				}),
			),
		).toBe("Declined 2 Nov 2026, 13:30");
	});

	it("confirms each saved decision", () => {
		const entry = mcpAccessEntry();
		expect(
			describeSavedDecision(entry, { action: "approve", role: "editor" }),
		).toBe("Ada Lovelace can now use the Notion MCP as editor.");
		expect(
			describeSavedDecision(entry, { action: "set_role", role: "reader" }),
		).toBe("Ada Lovelace is now a reader.");
		expect(
			describeSavedDecision(entry, { action: "set_role", role: "editor" }),
		).toBe("Ada Lovelace is now an editor.");
		expect(describeSavedDecision(entry, { action: "deny" })).toBe(
			"Ada Lovelace's request was declined.",
		);
		expect(describeSavedDecision(entry, { action: "revoke" })).toBe(
			"Ada Lovelace no longer has Notion MCP access.",
		);
	});
});
