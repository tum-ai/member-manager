import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	MCP_ACCESS_ACTION_FROM,
	MCP_ACCESS_NOTE_MAX_LENGTH,
	mcpAccessDecisionSchema,
} from "../dist/index.js";

describe("mcpAccessDecisionSchema", () => {
	test("approving or changing the role needs a valid role", () => {
		assert.deepEqual(
			mcpAccessDecisionSchema.parse({ action: "approve", role: "editor" }),
			{ action: "approve", role: "editor" },
		);
		assert.deepEqual(
			mcpAccessDecisionSchema.parse({ action: "set_role", role: "reader" }),
			{ action: "set_role", role: "reader" },
		);
		for (const body of [
			{ action: "approve" },
			{ action: "approve", role: "admin" },
			{ action: "set_role", role: null },
		]) {
			assert.equal(mcpAccessDecisionSchema.safeParse(body).success, false);
		}
	});

	test("deny and revoke take an optional, trimmed note", () => {
		assert.deepEqual(mcpAccessDecisionSchema.parse({ action: "deny" }), {
			action: "deny",
			note: null,
		});
		assert.deepEqual(
			mcpAccessDecisionSchema.parse({ action: "revoke", note: "  left  " }),
			{ action: "revoke", note: "left" },
		);
		assert.deepEqual(
			mcpAccessDecisionSchema.parse({ action: "deny", note: "   " }),
			{ action: "deny", note: null },
		);
		assert.equal(
			mcpAccessDecisionSchema.safeParse({
				action: "deny",
				note: "x".repeat(MCP_ACCESS_NOTE_MAX_LENGTH + 1),
			}).success,
			false,
		);
	});

	test("rejects unknown actions", () => {
		assert.equal(
			mcpAccessDecisionSchema.safeParse({ action: "delete" }).success,
			false,
		);
		assert.equal(mcpAccessDecisionSchema.safeParse({}).success, false);
	});

	test("each action applies to the statuses it can change", () => {
		assert.deepEqual(MCP_ACCESS_ACTION_FROM, {
			approve: ["pending", "denied"],
			set_role: ["approved"],
			deny: ["pending"],
			revoke: ["approved"],
		});
	});
});
