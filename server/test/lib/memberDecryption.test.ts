import "../setup.js";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FastifyRequest } from "fastify";
import { decryptMemberForResponse } from "../../src/lib/memberDecryption.js";
import {
	encryptRecord,
	SENSITIVE_MEMBER_FIELDS,
} from "../../src/lib/sensitiveData.js";

// Shaped like an `enc-v1:` value, but no configured key can decrypt it.
const UNDECRYPTABLE_VALUE =
	"enc-v1:AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBBBBBBBB:CCCC";

function makeRequest() {
	const warnings: Array<{ context: Record<string, unknown>; message: string }> =
		[];
	const request = {
		log: {
			warn(context: Record<string, unknown>, message: string) {
				warnings.push({ context, message });
			},
		},
	} as unknown as FastifyRequest;
	return { request, warnings };
}

describe("decryptMemberForResponse", () => {
	test("decrypts sensitive fields and leaves the rest untouched", () => {
		const { request, warnings } = makeRequest();
		const stored = encryptRecord(
			{ user_id: "user-1", city: "Munich", department: "Community" },
			SENSITIVE_MEMBER_FIELDS,
		);

		const member = decryptMemberForResponse(stored, "user-1", request);

		assert.equal(member.city, "Munich");
		assert.equal(member.department, "Community");
		assert.equal(warnings.length, 0);
	});

	test("blanks an undecryptable field and logs which one, without its value", () => {
		const { request, warnings } = makeRequest();
		const stored = {
			user_id: "user-1",
			city: UNDECRYPTABLE_VALUE,
			department: "Community",
		};

		const member = decryptMemberForResponse(stored, "user-1", request);

		assert.equal(member.city, "");
		assert.equal(member.department, "Community");
		// The stored row is not mutated.
		assert.equal(stored.city, UNDECRYPTABLE_VALUE);
		assert.equal(warnings.length, 1);
		assert.equal(warnings[0]?.context.userId, "user-1");
		assert.equal(warnings[0]?.context.field, "city");
		assert.ok(!JSON.stringify(warnings[0]).includes(UNDECRYPTABLE_VALUE));
	});
});
