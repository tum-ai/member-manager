import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizedAgentTraceSchema } from "@member-manager/shared";
import {
	AGENT_TRACE_LIMITS,
	sanitizeAgentTrace,
} from "../../src/lib/agentTrace.js";

test("sanitizeAgentTrace removes sensitive fields and tool output recursively", () => {
	const sanitized = sanitizeAgentTrace({
		rounds: [
			{
				tool_calls: [
					{
						name: "lookup_member",
						args: {
							profile: {
								phone: "+49 170 1234567",
								dateOfBirth: "2000-01-01",
								address: { street: "Private road", city: "Munich" },
								payment_iban: "DE89370400440532013000",
								public_location: "Munich",
							},
						},
						result: "raw tool output with private member data",
					},
				],
			},
		],
		finalAnswer: "Call +49 170 1234567 or use DE89370400440532013000",
	});
	const serialized = JSON.stringify(sanitized);
	assert.equal(sanitizedAgentTraceSchema.safeParse(sanitized).success, true);
	assert.doesNotMatch(serialized, /Private road|2000-01-01|1234567|DE8937/);
	assert.doesNotMatch(serialized, /raw tool output/);
	assert.match(serialized, /public_location/);
	assert.match(serialized, /\[redacted\]/);
});

test("sanitizeAgentTrace caps strings, collections, depth, and cycles", () => {
	const cyclic: Record<string, unknown> = {};
	cyclic.self = cyclic;
	const deep: Record<string, unknown> = {};
	let cursor = deep;
	for (let index = 0; index < AGENT_TRACE_LIMITS.maxDepth + 2; index++) {
		const child: Record<string, unknown> = {};
		cursor.child = child;
		cursor = child;
	}
	const sanitized = sanitizeAgentTrace({
		long: "x".repeat(AGENT_TRACE_LIMITS.maxStringLength + 500),
		items: Array.from(
			{ length: AGENT_TRACE_LIMITS.maxItems + 10 },
			(_, index) => index,
		),
		deep,
		cyclic,
	}) as {
		long: string;
		items: number[];
		deep: unknown;
		cyclic: { self: string };
	};
	assert.equal(sanitized.items.length, AGENT_TRACE_LIMITS.maxItems);
	assert.ok(sanitized.long.endsWith("[truncated]"));
	assert.match(JSON.stringify(sanitized.deep), /\[truncated\]/);
	assert.equal(sanitized.cyclic.self, "[circular]");
	assert.equal(sanitizedAgentTraceSchema.safeParse(sanitized).success, true);
});

test("sanitizeAgentTrace replaces traces above the serialized-size cap", () => {
	const sanitized = sanitizeAgentTrace({
		rows: Array.from(
			{ length: AGENT_TRACE_LIMITS.maxItems },
			(_, index) =>
				`${index}-${"x".repeat(AGENT_TRACE_LIMITS.maxStringLength)}`,
		),
	});
	assert.deepEqual(sanitized, {
		truncated: true,
		reason: "agent trace exceeded persistence limit",
	});
	assert.ok(
		Buffer.byteLength(JSON.stringify(sanitized), "utf8") <=
			AGENT_TRACE_LIMITS.maxSerializedBytes,
	);
	assert.equal(sanitizedAgentTraceSchema.safeParse(sanitized).success, true);
});
